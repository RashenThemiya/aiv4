const express = require("express");
const Order = require("../models/Order");
const { canAccessCompany } = require("../middleware/auth");
const { normalizeOrderUpdate } = require("../services/orderEditor");
const { notifyOrderTracking } = require("../services/orderTrackingNotifier");

const router = express.Router({ mergeParams: true });
router.use(canAccessCompany);
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

const STATUSES = ["new", "confirmed", "processing", "shipped", "delivered", "cancelled"];

router.get("/summary", asyncRoute(async (req, res) => {
  const grouped = await Order.aggregate([
    { $match: { companyId: new (require("mongoose").Types.ObjectId)(req.params.companyId) } },
    { $group: { _id: "$status", count: { $sum: 1 }, total: { $sum: "$total" } } },
  ]);
  const counts = Object.fromEntries(STATUSES.map((status) => [status, 0]));
  let revenue = 0;
  grouped.forEach((item) => {
    counts[item._id] = item.count;
    if (item._id !== "cancelled") revenue += item.total;
  });
  res.json({ counts, revenue, total: grouped.reduce((sum, item) => sum + item.count, 0) });
}));

router.get("/", asyncRoute(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 30));
  const filter = { companyId: req.params.companyId };
  if (STATUSES.includes(req.query.status)) filter.status = req.query.status;
  if (req.query.channel) filter.channel = req.query.channel;
  if (req.query.search) {
    const safe = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { orderNumber: new RegExp(safe, "i") },
      { "customer.name": new RegExp(safe, "i") },
      { "customer.phone": new RegExp(safe, "i") },
    ];
  }
  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Order.countDocuments(filter),
  ]);
  res.json({ orders, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) });
}));

router.get("/:orderId", asyncRoute(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.orderId, companyId: req.params.companyId });
  if (!order) return res.status(404).json({ error: "Order not found" });
  return res.json(order);
}));

router.patch("/:orderId", asyncRoute(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.orderId, companyId: req.params.companyId });
  if (!order) return res.status(404).json({ error: "Order not found" });

  const expectedUpdatedAt = String(req.body.expectedUpdatedAt || "").trim();
  if (expectedUpdatedAt) {
    const expected = new Date(expectedUpdatedAt);
    if (Number.isNaN(expected.getTime())) {
      return res.status(400).json({ error: "The order version is invalid. Refresh and try again." });
    }
    if (expected.getTime() !== order.updatedAt.getTime()) {
      return res.status(409).json({
        error: "This order was changed by another user. Refresh it before saving your changes.",
      });
    }
  }

  const update = normalizeOrderUpdate(req.body);
  const changedBy = req.user?.email || req.user?._id?.toString() || "admin";
  if (update.status !== order.status) {
    order.statusHistory.push({ status: update.status, changedAt: new Date(), changedBy });
  }
  order.customer.name = update.customer.name;
  order.customer.phone = update.customer.phone;
  order.customer.deliveryAddress = update.customer.deliveryAddress;
  order.items = update.items;
  order.subtotal = update.subtotal;
  order.deliveryFee = update.deliveryFee;
  order.total = update.total;
  order.currency = update.currency;
  order.paymentMethod = update.paymentMethod;
  order.priceStatus = update.priceStatus;
  order.notes = update.notes;
  order.tracking.courierName = update.tracking.courierName;
  order.tracking.trackingId = update.tracking.trackingId;
  order.tracking.trackingUrl = update.tracking.trackingUrl;
  order.status = update.status;
  order.editHistory.push({
    changedAt: new Date(),
    changedBy,
    summary: "Order details updated",
  });
  await order.save();
  const trackingNotificationResult = await notifyOrderTracking(order);
  return res.json({ ...order.toObject(), trackingNotificationResult });
}));

router.post("/:orderId/tracking-notification/retry", asyncRoute(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.orderId, companyId: req.params.companyId });
  if (!order) return res.status(404).json({ error: "Order not found" });
  const trackingNotificationResult = await notifyOrderTracking(order, { force: true });
  if (!trackingNotificationResult.attempted) {
    return res.status(400).json({
      error: "Set a tracking ID or tracking link and mark the order as shipped before sending the notification.",
      order,
      trackingNotificationResult,
    });
  }
  return res.json({ ...order.toObject(), trackingNotificationResult });
}));

router.patch("/:orderId/status", asyncRoute(async (req, res) => {
  const status = String(req.body.status || "");
  if (!STATUSES.includes(status)) return res.status(400).json({ error: "Invalid order status" });
  const order = await Order.findOne({ _id: req.params.orderId, companyId: req.params.companyId });
  if (!order) return res.status(404).json({ error: "Order not found" });
  order.status = status;
  order.statusHistory.push({
    status,
    changedAt: new Date(),
    changedBy: req.user?.email || req.user?._id?.toString() || "admin",
  });
  await order.save();
  const trackingNotificationResult = await notifyOrderTracking(order);
  return res.json({ ...order.toObject(), trackingNotificationResult });
}));

module.exports = router;
