const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const multer = require("multer");
const config = require("../config");
const Company = require("../models/Company");
const PricingPlan = require("../models/PricingPlan");
const BillingSettings = require("../models/BillingSettings");
const CreditPurchaseRequest = require("../models/CreditPurchaseRequest");
const { requireSuperAdmin } = require("../middleware/auth");
const { addCredits, reversePurchasedCredits } = require("../services/tokenUsage");

const router = express.Router();
const slipDir = path.resolve(config.uploadDir, "payment-slips");
fs.mkdirSync(slipDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, slipDir),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(12).toString("hex")}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    const extensions = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];
    const valid = allowed.includes(file.mimetype) && extensions.includes(path.extname(file.originalname).toLowerCase());
    cb(valid ? null : new Error("Payment slip must be a JPG, PNG, WebP, or PDF"), valid);
  },
});

function requestView(item) {
  const value = item.toObject ? item.toObject() : item;
  return { ...value, slipPath: undefined, slipUrl: `/api/billing/requests/${value._id}/slip` };
}

function applyRequestFilters(req, filter = {}) {
  if (req.user.role === "superadmin" && req.query.companyId) {
    filter.companyId = req.query.companyId;
  }
  if (req.query.status && req.query.status !== "all") {
    filter.status = req.query.status;
  }
  if (req.query.dateFrom || req.query.dateTo) {
    filter.createdAt = {};
    if (req.query.dateFrom) filter.createdAt.$gte = new Date(`${req.query.dateFrom}T00:00:00.000Z`);
    if (req.query.dateTo) filter.createdAt.$lte = new Date(`${req.query.dateTo}T23:59:59.999Z`);
  }
  return filter;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

router.get("/plans", async (req, res, next) => {
  try {
    const filter = req.user.role === "superadmin" ? {} : { isActive: true };
    res.json(await PricingPlan.find(filter).sort({ sortOrder: 1, price: 1 }).lean());
  } catch (error) { next(error); }
});

router.post("/plans", requireSuperAdmin, async (req, res, next) => {
  try {
    const plan = await PricingPlan.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json(plan);
  } catch (error) { next(error); }
});

router.put("/plans/:planId", requireSuperAdmin, async (req, res, next) => {
  try {
    const allowed = ["name", "description", "price", "currency", "credits", "isActive", "sortOrder"];
    const update = Object.fromEntries(allowed.filter((key) => req.body[key] !== undefined).map((key) => [key, req.body[key]]));
    const plan = await PricingPlan.findByIdAndUpdate(req.params.planId, update, { new: true, runValidators: true });
    if (!plan) return res.status(404).json({ error: "Pricing plan not found" });
    res.json(plan);
  } catch (error) { next(error); }
});

router.delete("/plans/:planId", requireSuperAdmin, async (req, res, next) => {
  try {
    const plan = await PricingPlan.findByIdAndDelete(req.params.planId);
    if (!plan) return res.status(404).json({ error: "Pricing plan not found" });
    res.json({ deleted: true, id: plan._id });
  } catch (error) { next(error); }
});

router.get("/settings", async (_req, res, next) => {
  try { res.json(await BillingSettings.findOne({ key: "default" }).lean() || {}); } catch (error) { next(error); }
});

router.put("/settings", requireSuperAdmin, async (req, res, next) => {
  try {
    const allowed = ["bankName", "accountName", "accountNumber", "branch", "instructions"];
    const update = Object.fromEntries(allowed.map((key) => [key, String(req.body[key] || "").trim()]));
    res.json(await BillingSettings.findOneAndUpdate({ key: "default" }, update, { upsert: true, new: true, setDefaultsOnInsert: true }));
  } catch (error) { next(error); }
});

router.get("/requests", async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const filter = applyRequestFilters(
      req,
      req.user.role === "superadmin" ? {} : { companyId: req.user.companyId }
    );
    const [items, total] = await Promise.all([
      CreditPurchaseRequest.find(filter)
        .populate("companyId", "name")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CreditPurchaseRequest.countDocuments(filter),
    ]);
    res.json({
      requests: items.map(requestView),
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) { next(error); }
});

router.get("/allocations", requireSuperAdmin, async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const filter = applyRequestFilters(req, {
      status: req.query.status && req.query.status !== "all"
        ? req.query.status
        : { $in: ["approved", "reversed"] },
    });
    const [items, total] = await Promise.all([
      CreditPurchaseRequest.find(filter)
        .populate("companyId", "name slug")
        .populate("reviewedBy", "name email")
        .populate("reversedBy", "name email")
        .sort({ reviewedAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CreditPurchaseRequest.countDocuments(filter),
    ]);
    res.json({
      allocations: items.map(requestView),
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) { next(error); }
});

router.get("/allocations/export", requireSuperAdmin, async (req, res, next) => {
  try {
    const filter = applyRequestFilters(req, {
      status: req.query.status && req.query.status !== "all"
        ? req.query.status
        : { $in: ["approved", "reversed"] },
    });
    const items = await CreditPurchaseRequest.find(filter)
      .populate("companyId", "name slug")
      .populate("reviewedBy", "name email")
      .populate("reversedBy", "name email")
      .sort({ reviewedAt: -1, createdAt: -1 })
      .limit(10000)
      .lean();
    const rows = [[
      "Submitted", "Reviewed", "Company", "Company slug", "Package", "Credits",
      "Amount", "Currency", "Bank reference", "Status", "Reviewed by",
      "Reversed", "Reversed by", "Reversal reason",
    ]];
    for (const item of items) {
      rows.push([
        item.createdAt?.toISOString?.() || "",
        item.reviewedAt?.toISOString?.() || "",
        item.companyId?.name || "",
        item.companyId?.slug || "",
        item.planName,
        item.credits,
        item.amount,
        item.currency,
        item.bankReference,
        item.status,
        item.reviewedBy?.name || item.reviewedBy?.email || "",
        item.reversedAt?.toISOString?.() || "",
        item.reversedBy?.name || item.reversedBy?.email || "",
        item.reversalReason || "",
      ]);
    }
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="pentarix-credit-allocations-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(`\uFEFF${csv}`);
  } catch (error) { next(error); }
});

router.post("/companies/:companyId/requests", upload.single("slip"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "A payment slip is required" });
    const allowedCompany = req.user.role === "superadmin"
      || String(req.user.companyId || "") === String(req.params.companyId);
    if (!allowedCompany || !(await Company.exists({ _id: req.params.companyId }))) {
      fs.unlink(req.file.path, () => {});
      return res.status(403).json({ error: "You cannot submit a payment for this company" });
    }
    const plan = await PricingPlan.findOne({ _id: req.body.planId, isActive: true });
    if (!plan) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: "The selected pricing plan is no longer available" });
    }
    const item = await CreditPurchaseRequest.create({
      companyId: req.params.companyId, planId: plan._id, planName: plan.name,
      credits: plan.credits, amount: plan.price, currency: plan.currency,
      bankReference: req.body.bankReference, note: req.body.note,
      slipPath: req.file.path, slipOriginalName: req.file.originalname,
      slipMimeType: req.file.mimetype, submittedBy: req.user._id,
    });
    res.status(201).json(requestView(item));
  } catch (error) {
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    next(error);
  }
});

router.get("/requests/:requestId/slip", async (req, res, next) => {
  try {
    const item = await CreditPurchaseRequest.findById(req.params.requestId).select("+slipPath");
    if (!item) return res.status(404).json({ error: "Payment request not found" });
    if (req.user.role !== "superadmin" && String(item.companyId) !== String(req.user.companyId)) return res.status(403).json({ error: "Access denied" });
    if (!fs.existsSync(item.slipPath)) return res.status(404).json({ error: "Payment slip file is missing" });
    res.type(item.slipMimeType).sendFile(path.resolve(item.slipPath));
  } catch (error) { next(error); }
});

router.post("/requests/:requestId/approve", requireSuperAdmin, async (req, res, next) => {
  let item;
  try {
    item = await CreditPurchaseRequest.findOneAndUpdate(
      { _id: req.params.requestId, status: "pending" },
      { status: "processing", reviewedBy: req.user._id, reviewedAt: new Date(), reviewNote: String(req.body.note || "").trim() },
      { new: true }
    );
    if (!item) {
      item = await CreditPurchaseRequest.findOne({ _id: req.params.requestId, status: "processing" });
    }
    if (!item) return res.status(409).json({ error: "This payment request has already been reviewed" });
    const result = await addCredits(item.companyId, {
      credits: item.credits, type: "purchase", reference: `PAY-${item._id}`,
      paymentAmount: item.amount, paymentCurrency: item.currency,
      note: `Approved payment for ${item.planName}`, source: "payment-request", createdBy: req.user._id,
    });
    item.status = "approved";
    item.creditTransactionId = result.transaction._id;
    await item.save();
    res.json(requestView(item));
  } catch (error) {
    if (item?._id) await CreditPurchaseRequest.updateOne({ _id: item._id, status: "processing" }, { status: "pending" });
    next(error);
  }
});

router.post("/requests/:requestId/reject", requireSuperAdmin, async (req, res, next) => {
  try {
    const note = String(req.body.note || "").trim();
    if (!note) return res.status(400).json({ error: "A rejection reason is required" });
    const item = await CreditPurchaseRequest.findOneAndUpdate(
      { _id: req.params.requestId, status: "pending" },
      { status: "rejected", reviewedBy: req.user._id, reviewedAt: new Date(), reviewNote: note },
      { new: true }
    );
    if (!item) return res.status(409).json({ error: "This payment request has already been reviewed" });
    res.json(requestView(item));
  } catch (error) { next(error); }
});

router.post("/requests/:requestId/reverse", requireSuperAdmin, async (req, res, next) => {
  let item;
  try {
    const reason = String(req.body.reason || "").trim();
    if (!reason) return res.status(400).json({ error: "A reversal reason is required" });
    item = await CreditPurchaseRequest.findOneAndUpdate(
      { _id: req.params.requestId, status: "approved", creditTransactionId: { $ne: null } },
      { status: "reversing" },
      { new: true }
    );
    if (!item) return res.status(409).json({ error: "This allocation is not available for reversal" });

    const result = await reversePurchasedCredits(item.companyId, item.creditTransactionId, {
      reason,
      createdBy: req.user._id,
    });
    item.status = "reversed";
    item.reversalTransactionId = result.transaction._id;
    item.reversedBy = req.user._id;
    item.reversedAt = new Date();
    item.reversalReason = reason;
    await item.save();
    res.json(requestView(item));
  } catch (error) {
    if (item?._id) {
      await CreditPurchaseRequest.updateOne(
        { _id: item._id, status: "reversing" },
        { status: "approved" }
      );
    }
    next(error);
  }
});

router.use((error, _req, res, next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      error: error.code === "LIMIT_FILE_SIZE"
        ? "Payment slip must be smaller than 8 MB"
        : "The payment slip could not be uploaded",
      code: error.code,
    });
  }
  if (error?.name === "ValidationError" || error?.message?.startsWith("Payment slip must")) {
    return res.status(400).json({ error: error.message });
  }
  if (error?.statusCode) {
    return res.status(error.statusCode).json({ error: error.message, code: error.code || "BILLING_REQUEST_FAILED" });
  }
  return next(error);
});

module.exports = router;
