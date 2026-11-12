const mongoose = require("mongoose");

const ORDER_STATUSES = ["new", "confirmed", "processing", "shipped", "delivered", "cancelled"];
const PRICE_STATUSES = ["pending", "confirmed"];

function invalid(message) {
  const error = new Error(message);
  error.status = 400;
  throw error;
}

function requiredText(value, label, maxLength) {
  const text = String(value ?? "").trim();
  if (!text) invalid(`${label} is required`);
  if (text.length > maxLength) invalid(`${label} must be ${maxLength} characters or fewer`);
  return text;
}

function optionalText(value, label, maxLength) {
  const text = String(value ?? "").trim();
  if (text.length > maxLength) invalid(`${label} must be ${maxLength} characters or fewer`);
  return text;
}

function amount(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) invalid(`${label} must be zero or greater`);
  return Math.round(parsed * 100) / 100;
}

function optionalHttpUrl(value, label, maxLength) {
  const text = optionalText(value, label, maxLength);
  if (!text) return "";
  try {
    const parsed = new URL(text);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("unsupported protocol");
  } catch (_error) {
    invalid(`${label} must be a complete http:// or https:// link`);
  }
  return text;
}

function normalizeOrderUpdate(body = {}) {
  const customer = body.customer && typeof body.customer === "object" ? body.customer : {};
  const tracking = body.tracking && typeof body.tracking === "object" ? body.tracking : {};
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) invalid("An order must contain at least one item");
  if (items.length > 100) invalid("An order cannot contain more than 100 product lines");

  const normalizedItems = items.map((item, index) => {
    if (!item || typeof item !== "object") invalid(`Item ${index + 1} is invalid`);
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) {
      invalid(`Item ${index + 1} quantity must be a whole number between 1 and 1000`);
    }
    const productId = String(item.productId || "").trim();
    if (productId && !mongoose.Types.ObjectId.isValid(productId)) {
      invalid(`Item ${index + 1} product reference is invalid`);
    }
    const unitPrice = amount(item.unitPrice, `Item ${index + 1} unit price`);
    return {
      productId: productId || null,
      sku: optionalText(item.sku, `Item ${index + 1} SKU`, 100),
      name: requiredText(item.name, `Item ${index + 1} name`, 200),
      variant: optionalText(item.variant, `Item ${index + 1} option`, 120),
      quantity,
      unitPrice,
      lineTotal: Math.round(quantity * unitPrice * 100) / 100,
    };
  });

  const currency = String(body.currency || "LKR").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) invalid("Currency must use a three-letter code such as LKR");
  const priceStatus = String(body.priceStatus || "pending").trim();
  if (!PRICE_STATUSES.includes(priceStatus)) invalid("Invalid price status");
  const status = String(body.status || "new").trim();
  if (!ORDER_STATUSES.includes(status)) invalid("Invalid order status");
  const deliveryFee = amount(body.deliveryFee || 0, "Delivery fee");
  const subtotal = Math.round(normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0) * 100) / 100;

  return {
    customer: {
      name: requiredText(customer.name, "Customer name", 160),
      phone: optionalText(customer.phone, "Customer phone", 50),
      deliveryAddress: requiredText(customer.deliveryAddress, "Delivery address", 1000),
    },
    items: normalizedItems,
    subtotal,
    deliveryFee,
    total: Math.round((subtotal + deliveryFee) * 100) / 100,
    currency,
    paymentMethod: requiredText(body.paymentMethod, "Payment method", 120),
    priceStatus,
    notes: optionalText(body.notes, "Notes", 2000),
    tracking: {
      courierName: optionalText(tracking.courierName, "Courier service", 160),
      trackingId: optionalText(tracking.trackingId, "Tracking ID", 200),
      trackingUrl: optionalHttpUrl(tracking.trackingUrl, "Tracking URL", 2000),
    },
    status,
  };
}

module.exports = { normalizeOrderUpdate, ORDER_STATUSES, PRICE_STATUSES };
