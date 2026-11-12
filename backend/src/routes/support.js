const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const config = require("../config");
const AdminUser = require("../models/AdminUser");
const Company = require("../models/Company");
const SupportTicket = require("../models/SupportTicket");
const { requireSuperAdmin } = require("../middleware/auth");

const router = express.Router();
const supportDir = path.resolve(config.uploadDir, "support-attachments");
fs.mkdirSync(supportDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, supportDir),
    filename: (_req, file, callback) => callback(null, `${Date.now()}-${crypto.randomBytes(12).toString("hex")}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, callback) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain"];
    const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".pdf", ".txt"];
    const valid = allowedTypes.includes(file.mimetype) && allowedExtensions.includes(path.extname(file.originalname).toLowerCase());
    callback(valid ? null : new Error("Attachments must be JPG, PNG, WebP, PDF, or TXT files"), valid);
  },
});

function removeFiles(files = []) {
  for (const file of files) fs.unlink(file.path, () => {});
}

function attachmentFromFile(file) {
  return {
    originalName: file.originalname,
    storedName: file.filename,
    mimeType: file.mimetype,
    size: file.size,
    path: file.path,
  };
}

function safeAttachment(ticketId, attachment) {
  return {
    _id: attachment._id,
    originalName: attachment.originalName,
    mimeType: attachment.mimeType,
    size: attachment.size,
    createdAt: attachment.createdAt,
    url: `/api/support/tickets/${ticketId}/attachments/${attachment._id}`,
  };
}

function ticketView(item, includeMessages = false, role = "superadmin") {
  const value = item.toObject ? item.toObject() : item;
  const result = { ...value, messages: undefined };
  if (role !== "superadmin") {
    result.messageCount = value.publicMessageCount ?? value.messageCount;
    result.attachmentCount = value.publicAttachmentCount ?? value.attachmentCount;
    delete result.publicMessageCount;
    delete result.publicAttachmentCount;
  }
  if (includeMessages) {
    result.messages = (value.messages || [])
      .filter((message) => role === "superadmin" || !message.isInternal)
      .map((message) => ({
        ...message,
        attachments: (message.attachments || []).map((attachment) => safeAttachment(value._id, attachment)),
      }));
  }
  return result;
}

function ticketNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `SUP-${date}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

function applyFilters(req, filter) {
  if (req.user.role === "superadmin" && req.query.companyId && mongoose.isValidObjectId(req.query.companyId)) {
    filter.companyId = new mongoose.Types.ObjectId(req.query.companyId);
  }
  if (req.query.priority && req.query.priority !== "all") filter.priority = req.query.priority;
  if (req.query.status && req.query.status !== "all") filter.status = req.query.status;
  if (req.query.assignedTo === "unassigned") filter.assignedTo = null;
  else if (req.query.assignedTo && mongoose.isValidObjectId(req.query.assignedTo)) {
    filter.assignedTo = new mongoose.Types.ObjectId(req.query.assignedTo);
  }
  if (req.query.dateFrom || req.query.dateTo) {
    filter.createdAt = {};
    if (req.query.dateFrom) filter.createdAt.$gte = new Date(`${req.query.dateFrom}T00:00:00.000Z`);
    if (req.query.dateTo) filter.createdAt.$lte = new Date(`${req.query.dateTo}T23:59:59.999Z`);
  }
  if (req.query.search) {
    const escaped = String(req.query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (escaped) filter.$or = [
      { ticketNumber: { $regex: escaped, $options: "i" } },
      { subject: { $regex: escaped, $options: "i" } },
      { description: { $regex: escaped, $options: "i" } },
    ];
  }
  return filter;
}

function accessFilter(req, id) {
  const filter = { _id: id };
  if (req.user.role !== "superadmin") filter.companyId = req.user.companyId;
  return filter;
}

async function populatedTicket(filter) {
  return SupportTicket.findOne(filter)
    .populate("companyId", "name slug")
    .populate("assignedTo", "name email")
    .populate("createdBy", "name email role");
}

router.param("ticketId", (req, res, next, ticketId) => {
  if (!mongoose.isValidObjectId(ticketId)) {
    return res.status(404).json({ error: "Support ticket not found" });
  }
  return next();
});

router.get("/assignees", requireSuperAdmin, async (_req, res, next) => {
  try {
    const users = await AdminUser.find({ role: "superadmin", isActive: true }).select("name email role").sort({ name: 1 }).lean();
    res.json(users);
  } catch (error) { next(error); }
});

router.get("/summary", async (req, res, next) => {
  try {
    const filter = applyFilters(req, req.user.role === "superadmin" ? {} : { companyId: req.user.companyId });
    delete filter.status;
    const [byStatus, timing] = await Promise.all([
      SupportTicket.aggregate([
        { $match: filter },
        { $group: { _id: "$status", value: { $sum: 1 } } },
      ]),
      SupportTicket.aggregate([
        { $match: filter },
        { $group: {
          _id: null,
          total: { $sum: 1 },
          averageFirstResponseMs: { $avg: { $cond: [{ $ne: ["$firstResponseAt", null] }, { $subtract: ["$firstResponseAt", "$createdAt"] }, null] } },
          averageResolutionMs: { $avg: { $cond: [{ $ne: ["$resolvedAt", null] }, { $subtract: ["$resolvedAt", "$createdAt"] }, null] } },
        } },
      ]),
    ]);
    const statuses = Object.fromEntries(byStatus.map((item) => [item._id, item.value]));
    res.json({
      total: timing[0]?.total || 0,
      byStatus: statuses,
      averageFirstResponseMs: Number(timing[0]?.averageFirstResponseMs || 0),
      averageResolutionMs: Number(timing[0]?.averageResolutionMs || 0),
    });
  } catch (error) { next(error); }
});

router.get("/tickets", async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const filter = applyFilters(req, req.user.role === "superadmin" ? {} : { companyId: req.user.companyId });
    const [items, total] = await Promise.all([
      SupportTicket.find(filter)
        .select("-messages")
        .populate("companyId", "name slug")
        .populate("assignedTo", "name email")
        .sort({ lastActivityAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      SupportTicket.countDocuments(filter),
    ]);
    const tickets = req.user.role === "superadmin"
      ? items
      : items.map((item) => ticketView(item, false, req.user.role));
    res.json({ tickets, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (error) { next(error); }
});

router.post("/tickets", upload.array("attachments", 5), async (req, res, next) => {
  let persisted = false;
  try {
    const companyId = req.user.role === "superadmin" ? req.body.companyId : req.user.companyId;
    if (!companyId || !mongoose.isValidObjectId(companyId) || !(await Company.exists({ _id: companyId }))) {
      removeFiles(req.files);
      return res.status(400).json({ error: "A valid company is required" });
    }
    const subject = String(req.body.subject || "").trim();
    const description = String(req.body.description || "").trim();
    if (!subject || !description) {
      removeFiles(req.files);
      return res.status(400).json({ error: "Subject and description are required" });
    }
    const attachments = (req.files || []).map(attachmentFromFile);
    const message = {
      authorId: req.user._id,
      authorName: req.user.name,
      authorRole: req.user.role,
      message: description,
      isInternal: false,
      attachments,
    };
    let ticket;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        ticket = await SupportTicket.create({
          companyId,
          ticketNumber: ticketNumber(),
          subject,
          description,
          category: req.body.category || "technical",
          priority: req.body.priority || "normal",
          createdBy: req.user._id,
          messages: [message],
          messageCount: 1,
          attachmentCount: attachments.length,
          publicMessageCount: 1,
          publicAttachmentCount: attachments.length,
          lastActivityAt: new Date(),
        });
        persisted = true;
        break;
      } catch (error) {
        if (error?.code !== 11000 || attempt === 2) throw error;
      }
    }
    res.status(201).json(ticketView(await populatedTicket({ _id: ticket._id }), true, req.user.role));
  } catch (error) {
    if (!persisted) removeFiles(req.files);
    next(error);
  }
});

router.get("/tickets/:ticketId", async (req, res, next) => {
  try {
    const ticket = await populatedTicket(accessFilter(req, req.params.ticketId));
    if (!ticket) return res.status(404).json({ error: "Support ticket not found" });
    res.json(ticketView(ticket, true, req.user.role));
  } catch (error) { next(error); }
});

router.post("/tickets/:ticketId/replies", upload.array("attachments", 5), async (req, res, next) => {
  let persisted = false;
  try {
    const ticket = await SupportTicket.findOne(accessFilter(req, req.params.ticketId));
    if (!ticket) {
      removeFiles(req.files);
      return res.status(404).json({ error: "Support ticket not found" });
    }
    const messageText = String(req.body.message || "").trim();
    const attachments = (req.files || []).map(attachmentFromFile);
    if (!messageText && !attachments.length) {
      removeFiles(req.files);
      return res.status(400).json({ error: "Write a reply or attach a file" });
    }
    const isInternal = req.user.role === "superadmin" && String(req.body.isInternal) === "true";
    ticket.messages.push({
      authorId: req.user._id,
      authorName: req.user.name,
      authorRole: req.user.role,
      message: messageText,
      isInternal,
      attachments,
    });
    ticket.messageCount += 1;
    ticket.attachmentCount += attachments.length;
    if (!isInternal) {
      ticket.publicMessageCount += 1;
      ticket.publicAttachmentCount += attachments.length;
    }
    ticket.lastActivityAt = new Date();
    if (req.user.role === "superadmin" && !isInternal && !ticket.firstResponseAt) ticket.firstResponseAt = new Date();
    await ticket.save();
    persisted = true;
    res.json(ticketView(await populatedTicket({ _id: ticket._id }), true, req.user.role));
  } catch (error) {
    if (!persisted) removeFiles(req.files);
    next(error);
  }
});

router.patch("/tickets/:ticketId", requireSuperAdmin, async (req, res, next) => {
  try {
    const ticket = await SupportTicket.findById(req.params.ticketId);
    if (!ticket) return res.status(404).json({ error: "Support ticket not found" });
    if (req.body.status !== undefined) {
      const allowed = ["open", "in_progress", "waiting", "resolved", "closed"];
      if (!allowed.includes(req.body.status)) return res.status(400).json({ error: "Invalid support status" });
      ticket.status = req.body.status;
      if (req.body.status === "resolved" && !ticket.resolvedAt) ticket.resolvedAt = new Date();
      if (["open", "in_progress", "waiting"].includes(req.body.status)) {
        ticket.resolvedAt = null;
        ticket.closedAt = null;
      }
      if (req.body.status === "closed") {
        if (!ticket.resolvedAt) ticket.resolvedAt = new Date();
        ticket.closedAt = new Date();
      }
    }
    if (req.body.priority !== undefined) {
      const priorities = ["low", "normal", "high", "urgent"];
      if (!priorities.includes(req.body.priority)) return res.status(400).json({ error: "Invalid support priority" });
      ticket.priority = req.body.priority;
    }
    if (req.body.assignedTo !== undefined) {
      if (!req.body.assignedTo) ticket.assignedTo = null;
      else {
        const assignee = await AdminUser.findOne({ _id: req.body.assignedTo, role: "superadmin", isActive: true });
        if (!assignee) return res.status(400).json({ error: "Select an active Pentarix team member" });
        ticket.assignedTo = assignee._id;
      }
    }
    ticket.lastActivityAt = new Date();
    await ticket.save();
    res.json(ticketView(await populatedTicket({ _id: ticket._id }), true, req.user.role));
  } catch (error) { next(error); }
});

router.get("/tickets/:ticketId/attachments/:attachmentId", async (req, res, next) => {
  try {
    const ticket = await SupportTicket.findOne(accessFilter(req, req.params.ticketId));
    if (!ticket) return res.status(404).json({ error: "Support ticket not found" });
    let attachment = null;
    for (const message of ticket.messages) {
      if (req.user.role !== "superadmin" && message.isInternal) continue;
      const found = message.attachments.id(req.params.attachmentId);
      if (found) { attachment = found; break; }
    }
    if (!attachment || !fs.existsSync(attachment.path)) return res.status(404).json({ error: "Attachment file not found" });
    res.type(attachment.mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(attachment.originalName)}"`);
    res.sendFile(path.resolve(attachment.path));
  } catch (error) { next(error); }
});

router.use((error, _req, res, next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      error: error.code === "LIMIT_FILE_SIZE"
        ? "Each attachment must be smaller than 8 MB"
        : error.code === "LIMIT_FILE_COUNT"
          ? "You can attach up to 5 files"
          : "The support attachment could not be uploaded",
      code: error.code,
    });
  }
  if (error?.name === "ValidationError" || error?.message?.startsWith("Attachments must")) {
    return res.status(400).json({ error: error.message });
  }
  return next(error);
});

module.exports = router;
