const express = require("express");
const multer = require("multer");
const ExcelJS = require("exceljs");
const Product = require("../models/Product");
const { canAccessCompany } = require("../middleware/auth");
const { normalizeSku } = require("../services/productIdentity");
const { removeProductImage, saveProductImage } = require("../services/productMedia");

const router = express.Router({ mergeParams: true });
router.use(canAccessCompany);
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const spreadsheetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const valid = file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      || file.originalname.toLowerCase().endsWith(".xlsx");
    cb(valid ? null : new Error("Choose an Excel .xlsx catalogue file"), valid);
  },
});
const productImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
    const valid = allowed.has(String(file.mimetype || "").toLowerCase());
    const error = valid ? null : new Error("Choose a JPG, PNG or WebP product image");
    if (error) error.code = "PRODUCT_IMAGE_TYPE";
    cb(error, valid);
  },
});

function payload(body) {
  const variants = Array.isArray(body.variants)
    ? body.variants.map((variant) => ({
      name: String(variant?.name || "").trim(),
      sku: normalizeSku(variant?.sku),
      priceAdjustment: Number(variant?.priceAdjustment || 0),
      stock: variant?.stock === "" || variant?.stock === null || variant?.stock === undefined
        ? null
        : Number(variant.stock),
      isActive: variant?.isActive !== false,
    })).filter((variant) => variant.name)
    : [];
  return {
    sku: normalizeSku(body.sku),
    name: {
      en: String(body.name?.en || body.nameEn || "").trim(),
      si: String(body.name?.si || body.nameSi || "").trim(),
      ta: String(body.name?.ta || body.nameTa || "").trim(),
    },
    price: Number(body.price),
    currency: String(body.currency || "LKR").trim().toUpperCase(),
    stock: body.stock === "" || body.stock === null || body.stock === undefined
      ? null
      : Number(body.stock),
    variants,
    isActive: body.isActive !== false,
  };
}

function validate(data) {
  if (!data.sku) return "SKU is required";
  if (!data.name.en && !data.name.si && !data.name.ta) return "At least one product name is required";
  if (!Number.isFinite(data.price) || data.price < 0) return "Price must be zero or greater";
  if (data.stock !== null && (!Number.isInteger(data.stock) || data.stock < 0)) {
    return "Stock must be a non-negative whole number";
  }
  if (data.variants.some((variant) => !Number.isFinite(variant.priceAdjustment))) {
    return "Variant price adjustments must be valid numbers";
  }
  if (data.variants.some((variant) => variant.stock !== null && (!Number.isInteger(variant.stock) || variant.stock < 0))) {
    return "Variant stock must be blank or a non-negative whole number";
  }
  return "";
}

async function hasLogicalSkuConflict(companyId, sku, excludeProductId = "") {
  const products = await Product.find({ companyId }).select("_id sku").lean();
  return products.some((product) => (
    String(product._id) !== String(excludeProductId || "")
    && normalizeSku(product.sku) === normalizeSku(sku)
  ));
}

function cellText(row, column) {
  const value = row.getCell(column).value;
  if (value && typeof value === "object") {
    if (value.text !== undefined) return String(value.text).trim();
    if (value.result !== undefined) return String(value.result).trim();
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text).join("").trim();
  }
  return value === null || value === undefined ? "" : String(value).trim();
}

function booleanValue(value, fallback = true) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return fallback;
  return !["false", "no", "n", "0", "inactive"].includes(normalized);
}

function parseVariants(value) {
  if (!String(value || "").trim()) return [];
  return String(value).split(";").map((entry) => {
    const [name = "", sku = "", adjustment = "0", stock = "", active = "yes"] = entry.split("|").map((part) => part.trim());
    return { name, sku, priceAdjustment: Number(adjustment || 0), stock: stock === "" ? null : Number(stock), isActive: booleanValue(active) };
  }).filter((variant) => variant.name);
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function productFilter(companyId, { search = "", status = "all" } = {}) {
  const filter = { companyId };
  if (status === "active") filter.isActive = true;
  if (status === "inactive") filter.isActive = false;
  const term = String(search || "").trim();
  if (term) {
    const match = new RegExp(escapeRegExp(term), "i");
    filter.$or = [
      { sku: match }, { "name.en": match }, { "name.si": match }, { "name.ta": match },
      { "variants.name": match }, { "variants.sku": match },
    ];
  }
  return filter;
}

function catalogueSummary(products, lowStockThreshold = 5) {
  return products.reduce((summary, product) => {
    summary.total += 1;
    if (product.isActive !== false) summary.active += 1;
    const variants = (product.variants || []).filter((variant) => variant.isActive !== false);
    const stockedVariants = variants.filter((variant) => Number.isInteger(variant.stock));
    if (product.isActive !== false && (
      stockedVariants.some((variant) => variant.stock <= lowStockThreshold)
      || (Number.isInteger(product.stock) && product.stock <= lowStockThreshold)
    )) summary.lowStock += 1;
    if (stockedVariants.length) {
      summary.inventoryValue += stockedVariants.reduce((total, variant) => (
        total + Math.max(0, Number(product.price || 0) + Number(variant.priceAdjustment || 0)) * variant.stock
      ), 0);
    } else if (Number.isInteger(product.stock)) {
      summary.inventoryValue += Number(product.price || 0) * product.stock;
    }
    return summary;
  }, { total: 0, active: 0, lowStock: 0, inventoryValue: 0 });
}

async function parseSpreadsheet(buffer) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    const error = new Error("This Excel workbook could not be read. Download a fresh template and try again.");
    error.code = "INVALID_PRODUCT_WORKBOOK";
    throw error;
  }
  const sheet = workbook.getWorksheet("Products") || workbook.worksheets[0];
  if (!sheet) {
    const error = new Error("The workbook does not contain a product sheet");
    error.code = "INVALID_PRODUCT_WORKBOOK";
    throw error;
  }
  const headers = Array.from({ length: 9 }, (_, index) => cellText(sheet.getRow(1), index + 1).toLowerCase());
  const required = ["sku", "english name", "sinhala name", "tamil name", "price", "currency", "stock", "options", "active"];
  if (required.some((header, index) => headers[index] !== header)) {
    const error = new Error("The product columns do not match the Pentarix template. Download a fresh template and try again.");
    error.code = "INVALID_PRODUCT_WORKBOOK";
    throw error;
  }
  if (sheet.rowCount - 1 > 5000) {
    const error = new Error("A single import can contain up to 5,000 product rows");
    error.code = "INVALID_PRODUCT_WORKBOOK";
    throw error;
  }
  const rows = [];
  const errors = [];
  const seen = new Set();
  let totalRows = 0;
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const values = Array.from({ length: 9 }, (_, index) => cellText(sheet.getRow(rowNumber), index + 1));
    if (values.every((value) => !value)) continue;
    totalRows += 1;
    const [sku, nameEn, nameSi, nameTa, price, currency, stock, options, active] = values;
    const data = payload({ sku, nameEn, nameSi, nameTa, price, currency: currency || "LKR", stock, variants: parseVariants(options), isActive: booleanValue(active) });
    const validationError = validate(data);
    const key = normalizeSku(data.sku);
    if (validationError) errors.push({ row: rowNumber, sku, error: validationError });
    else if (seen.has(key)) errors.push({ row: rowNumber, sku: data.sku, error: "Duplicate SKU appears more than once in this file" });
    else {
      seen.add(key);
      rows.push({ rowNumber, data });
    }
  }
  return { rows, errors, totalRows };
}

router.get("/dashboard", asyncRoute(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 9));
  const status = ["active", "inactive"].includes(req.query.status) ? req.query.status : "all";
  const filter = productFilter(req.params.companyId, { search: req.query.search, status });
  const [allProducts, products, total] = await Promise.all([
    Product.find({ companyId: req.params.companyId }).lean(),
    Product.find(filter).sort({ updatedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Product.countDocuments(filter),
  ]);
  res.json({
    summary: catalogueSummary(allProducts),
    products,
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  });
}));

router.get("/template", asyncRoute(async (_req, res) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Pentarix AI Assistant";
  const sheet = workbook.addWorksheet("Products", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [
    { header: "SKU", key: "sku", width: 22 }, { header: "English Name", key: "nameEn", width: 30 },
    { header: "Sinhala Name", key: "nameSi", width: 30 }, { header: "Tamil Name", key: "nameTa", width: 30 },
    { header: "Price", key: "price", width: 14 }, { header: "Currency", key: "currency", width: 12 },
    { header: "Stock", key: "stock", width: 14 }, { header: "Options", key: "options", width: 55 },
    { header: "Active", key: "active", width: 12 },
  ];
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF047857" } };
  sheet.autoFilter = "A1:I1";
  sheet.addRow({ sku: "LHS-FAN-16", nameEn: "AeroBreeze Table Fan", nameSi: "AeroBreeze මේස විදුලි පංකාව", nameTa: "AeroBreeze மேசை மின்விசிறி", price: 8900, currency: "LKR", stock: 20, options: "Black|LHS-FAN-16-BLK|0|10|Yes; White|LHS-FAN-16-WHT|0|10|Yes", active: "Yes" });
  sheet.addRow({ sku: "LHS-KTL-17", nameEn: "QuickBoil Glass Kettle", price: 6500, currency: "LKR", stock: "", options: "Clear|||10|Yes; Smoke Grey||500||Yes", active: "Yes" });
  sheet.getColumn(5).numFmt = "0.00";
  const instructions = workbook.addWorksheet("Instructions");
  instructions.columns = [{ width: 28 }, { width: 100 }];
  [
    ["Column", "How to fill it"], ["SKU", "Required. Must be unique within this company."],
    ["Names", "At least one of English, Sinhala, or Tamil name is required."], ["Price", "Required. A number zero or greater."],
    ["Currency", "Three-letter code such as LKR or USD. Defaults to LKR."], ["Stock", "Leave blank for unlimited stock, or enter a whole number zero or greater."],
    ["Options", "Optional. Separate options with semicolons. Each option is Name|SKU|Price adjustment|Stock|Active. Example: Black|FAN-BLK|0|10|Yes; White|FAN-WHT|500||Yes"],
    ["Active", "Yes/No. Defaults to Yes."], ["Duplicate SKUs", "When uploading, choose whether existing products should be updated or skipped."],
  ].forEach((values) => instructions.addRow(values));
  instructions.getRow(1).font = { bold: true };
  const buffer = await workbook.xlsx.writeBuffer();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=product-catalogue-template.xlsx");
  res.send(Buffer.from(buffer));
}));

router.post("/import/preview", spreadsheetUpload.single("file"), asyncRoute(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Choose an Excel catalogue file" });
  const parsed = await parseSpreadsheet(req.file.buffer);
  return res.json({
    fileName: req.file.originalname,
    fileSize: req.file.size,
    totalRows: parsed.totalRows,
    validRows: parsed.rows.length,
    errorRows: parsed.errors.length,
    errors: parsed.errors.slice(0, 100),
  });
}));

router.post("/import", spreadsheetUpload.single("file"), asyncRoute(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Choose an Excel catalogue file" });
  const mode = req.body.duplicateMode === "skip" ? "skip" : "update";
  const parsed = await parseSpreadsheet(req.file.buffer);
  const existing = new Map();
  for (const product of await Product.find({ companyId: req.params.companyId })) {
    const key = normalizeSku(product.sku);
    const current = existing.get(key);
    const rawSku = String(product.sku || "").normalize("NFKC").trim();
    const currentRawSku = String(current?.sku || "").normalize("NFKC").trim();
    if (!current || (rawSku === key && currentRawSku !== key)) existing.set(key, product);
  }
  const results = { created: 0, updated: 0, skipped: 0, errors: [...parsed.errors] };
  for (const { rowNumber, data } of parsed.rows) {
    const key = normalizeSku(data.sku);
    const current = existing.get(key);
    if (current && mode === "skip") { results.skipped += 1; continue; }
    try {
      if (current) { Object.assign(current, data); await current.save(); results.updated += 1; }
      else { const created = await Product.create({ ...data, companyId: req.params.companyId }); existing.set(key, created); results.created += 1; }
    } catch (error) {
      results.errors.push({ row: rowNumber, sku: data.sku, error: error.code === 11000 ? "SKU already exists" : error.message });
    }
  }
  res.json({ ...results, processed: results.created + results.updated + results.skipped, totalRows: parsed.totalRows });
}));

router.get("/", asyncRoute(async (req, res) => {
  const products = await Product.find({ companyId: req.params.companyId }).sort({ updatedAt: -1 });
  res.json(products);
}));

router.post("/", asyncRoute(async (req, res) => {
  try {
    const data = payload(req.body);
    const error = validate(data);
    if (error) return res.status(400).json({ error });
    if (await hasLogicalSkuConflict(req.params.companyId, data.sku)) {
      return res.status(409).json({ error: "This SKU already exists. Remove any duplicated or formatted SKU entry first." });
    }
    const product = await Product.create({ ...data, companyId: req.params.companyId });
    return res.status(201).json(product);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: "This SKU already exists" });
    return res.status(500).json({ error: error.message });
  }
}));

router.put("/:productId", asyncRoute(async (req, res) => {
  try {
    const data = payload(req.body);
    const error = validate(data);
    if (error) return res.status(400).json({ error });
    if (await hasLogicalSkuConflict(req.params.companyId, data.sku, req.params.productId)) {
      return res.status(409).json({ error: "This SKU already exists. Remove any duplicated or formatted SKU entry first." });
    }
    const product = await Product.findOneAndUpdate(
      { _id: req.params.productId, companyId: req.params.companyId },
      { $set: data },
      { new: true, runValidators: true }
    );
    if (!product) return res.status(404).json({ error: "Product not found" });
    return res.json(product);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: "This SKU already exists" });
    return res.status(500).json({ error: error.message });
  }
}));

router.post("/:productId/image", productImageUpload.single("image"), asyncRoute(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Choose a product image to upload" });
  const product = await Product.findOne({
    _id: req.params.productId,
    companyId: req.params.companyId,
  });
  if (!product) return res.status(404).json({ error: "Product not found" });

  const previousImage = product.image?.fileName ? product.image.toObject() : null;
  const fallbackAltText = product.name?.en || product.name?.si || product.name?.ta || product.sku;
  const stored = await saveProductImage({
    companyId: product.companyId.toString(),
    productId: product._id.toString(),
    buffer: req.file.buffer,
    altText: req.body.altText || fallbackAltText,
  });

  try {
    product.image = {
      fileName: stored.fileName,
      mimeType: stored.mimeType,
      fileSize: stored.fileSize,
      width: stored.width,
      height: stored.height,
      altText: stored.altText,
    };
    product.imageUrl = stored.imageUrl;
    await product.save();
  } catch (error) {
    await removeProductImage(product.companyId, product._id, stored).catch(() => {});
    throw error;
  }

  if (previousImage) {
    await removeProductImage(product.companyId, product._id, previousImage).catch((error) => {
      console.error("Unable to remove replaced product image:", error);
    });
  }
  return res.json(product);
}));

router.delete("/:productId/image", asyncRoute(async (req, res) => {
  const product = await Product.findOne({
    _id: req.params.productId,
    companyId: req.params.companyId,
  });
  if (!product) return res.status(404).json({ error: "Product not found" });
  const previousImage = product.image?.fileName ? product.image.toObject() : null;
  product.image = null;
  product.imageUrl = "";
  await product.save();
  if (previousImage) {
    await removeProductImage(product.companyId, product._id, previousImage).catch((error) => {
      console.error("Unable to remove deleted product image:", error);
    });
  }
  return res.json(product);
}));

router.delete("/:productId", asyncRoute(async (req, res) => {
  const product = await Product.findOneAndDelete({
    _id: req.params.productId,
    companyId: req.params.companyId,
  });
  if (!product) return res.status(404).json({ error: "Product not found" });
  if (product.image?.fileName) {
    await removeProductImage(product.companyId, product._id, product.image).catch((error) => {
      console.error("Unable to remove product image after product deletion:", error);
    });
  }
  return res.json({ message: "Product deleted" });
}));

router.use((error, _req, res, next) => {
  if (error instanceof multer.MulterError) {
    const isProductImage = error.field === "image";
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: isProductImage ? "Product images must be smaller than 5 MB" : "Excel file must be smaller than 10 MB" });
    }
    return res.status(400).json({ error: isProductImage ? "The product image could not be uploaded" : "The Excel file could not be uploaded" });
  }
  if (error?.code === "PRODUCT_IMAGE_TYPE" || error?.code === "INVALID_PRODUCT_IMAGE") {
    return res.status(400).json({ error: error.message, code: error.code });
  }
  if (error?.code === "INVALID_PRODUCT_WORKBOOK") {
    return res.status(400).json({ error: error.message, code: error.code });
  }
  if (error?.message === "Choose an Excel .xlsx catalogue file") return res.status(400).json({ error: error.message });
  return next(error);
});

module.exports = router;
