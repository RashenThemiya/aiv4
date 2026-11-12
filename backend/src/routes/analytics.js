const express = require("express");
const mongoose = require("mongoose");
const Company = require("../models/Company");
const Conversation = require("../models/Conversation");
const Order = require("../models/Order");
const TokenUsage = require("../models/TokenUsage");
const CreditTransaction = require("../models/CreditTransaction");
const CreditPurchaseRequest = require("../models/CreditPurchaseRequest");
const WhatsAppIntegration = require("../models/WhatsAppIntegration");
const MessengerIntegration = require("../models/MessengerIntegration");
const SmsIntegration = require("../models/SmsIntegration");
const { requireSuperAdmin } = require("../middleware/auth");

const router = express.Router();
router.use(requireSuperAdmin);

function period(date) {
  return date.toISOString().slice(0, 7);
}

function shiftMonth(value, change) {
  const [year, month] = value.split("-").map(Number);
  return period(new Date(Date.UTC(year, month - 1 + change, 1)));
}

function periodRange(query = {}) {
  const current = period(new Date());
  const from = /^\d{4}-\d{2}$/.test(query.dateFrom || "") ? query.dateFrom : shiftMonth(current, -5);
  const to = /^\d{4}-\d{2}$/.test(query.dateTo || "") ? query.dateTo : current;
  const first = from <= to ? from : to;
  const last = from <= to ? to : from;
  const [startYear, startMonth] = first.split("-").map(Number);
  const [endYear, endMonth] = last.split("-").map(Number);
  return {
    from: first,
    to: last,
    startDate: new Date(Date.UTC(startYear, startMonth - 1, 1)),
    endDate: new Date(Date.UTC(endYear, endMonth, 1)),
  };
}

function companyObjectId(value) {
  return value && mongoose.isValidObjectId(value) ? new mongoose.Types.ObjectId(value) : null;
}

function monthSeries(from, to) {
  const result = [];
  let cursor = from;
  while (cursor <= to && result.length < 60) {
    result.push(cursor);
    cursor = shiftMonth(cursor, 1);
  }
  return result;
}

function mapCurrencyGroups(groups = []) {
  return groups.map((item) => ({
    currency: item._id || "LKR",
    amount: Number(item.amount || 0),
    count: Number(item.count || 0),
  })).sort((a, b) => b.amount - a.amount);
}

function primaryMoney(groups = []) {
  const preferred = groups.find((item) => item.currency === "LKR") || groups[0];
  return preferred || { currency: "LKR", amount: 0, count: 0 };
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function platformReport() {
  const current = period(new Date());
  const from = shiftMonth(current, -11);
  const [
    totalCompanies,
    activeCompanies,
    conversations,
    orders,
    orderCurrenciesRaw,
    paymentCurrenciesRaw,
    whatsAppConnections,
    messengerConnections,
    smsConnections,
    websiteConnections,
    companyMonthly,
    conversationMonthly,
    orderMonthly,
    paymentMonthly,
    conversationChannels,
  ] = await Promise.all([
    Company.countDocuments(),
    Company.countDocuments({ isActive: true }),
    Conversation.countDocuments(),
    Order.countDocuments(),
    Order.aggregate([
      { $match: { status: { $ne: "cancelled" } } },
      { $group: { _id: "$currency", amount: { $sum: "$total" }, count: { $sum: 1 } } },
    ]),
    CreditPurchaseRequest.aggregate([
      { $match: { status: "approved" } },
      { $group: { _id: "$currency", amount: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    WhatsAppIntegration.countDocuments({ isActive: true }),
    MessengerIntegration.countDocuments({ isActive: true }),
    SmsIntegration.countDocuments({ isActive: true }),
    Company.countDocuments({ isActive: true, widgetApiKeyHash: { $exists: true, $ne: "" } }),
    Company.aggregate([
      { $match: { createdAt: { $gte: new Date(`${from}-01T00:00:00.000Z`) } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, value: { $sum: 1 } } },
    ]),
    Conversation.aggregate([
      { $match: { createdAt: { $gte: new Date(`${from}-01T00:00:00.000Z`) } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, value: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: new Date(`${from}-01T00:00:00.000Z`) } } },
      { $group: { _id: { period: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, currency: "$currency" }, orders: { $sum: 1 }, orderValue: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 0, "$total"] } } } },
    ]),
    CreditPurchaseRequest.aggregate([
      { $match: { status: "approved", reviewedAt: { $gte: new Date(`${from}-01T00:00:00.000Z`) } } },
      { $group: { _id: { period: { $dateToString: { format: "%Y-%m", date: "$reviewedAt" } }, currency: "$currency" }, value: { $sum: "$amount" } } },
    ]),
    Conversation.aggregate([{ $group: { _id: "$channel", value: { $sum: 1 } } }]),
  ]);

  const orderCurrencies = mapCurrencyGroups(orderCurrenciesRaw);
  const paymentCurrencies = mapCurrencyGroups(paymentCurrenciesRaw);
  const primaryOrderValue = primaryMoney(orderCurrencies);
  const primaryPaymentRevenue = primaryMoney(paymentCurrencies);
  const companyMap = new Map(companyMonthly.map((item) => [item._id, item.value]));
  const conversationMap = new Map(conversationMonthly.map((item) => [item._id, item.value]));
  const orderMap = new Map();
  for (const item of orderMonthly) {
    const key = item._id.period;
    const currentValue = orderMap.get(key) || { orders: 0, values: {} };
    currentValue.orders += Number(item.orders || 0);
    currentValue.values[item._id.currency || "LKR"] = Number(item.orderValue || 0);
    orderMap.set(key, currentValue);
  }
  const paymentMap = new Map();
  for (const item of paymentMonthly) {
    const key = item._id.period;
    const currentValue = paymentMap.get(key) || {};
    currentValue[item._id.currency || "LKR"] = Number(item.value || 0);
    paymentMap.set(key, currentValue);
  }
  const monthly = monthSeries(from, current).map((item) => ({
    period: item,
    companies: Number(companyMap.get(item) || 0),
    conversations: Number(conversationMap.get(item) || 0),
    orders: Number(orderMap.get(item)?.orders || 0),
    orderValue: Number(orderMap.get(item)?.values?.[primaryOrderValue.currency] || 0),
    paymentRevenue: Number(paymentMap.get(item)?.[primaryPaymentRevenue.currency] || 0),
  }));
  const connectionMap = {
    whatsapp: whatsAppConnections,
    messenger: messengerConnections,
    sms: smsConnections,
    web: websiteConnections,
  };
  const conversationChannelMap = new Map(conversationChannels.map((item) => [item._id, item.value]));
  const channels = ["whatsapp", "messenger", "web", "sms", "voice"].map((channel) => ({
    channel,
    connections: Number(connectionMap[channel] || 0),
    conversations: Number(conversationChannelMap.get(channel) || 0),
  }));

  return {
    summary: {
      totalCompanies,
      activeCompanies,
      conversations,
      orders,
      connectedChannels: whatsAppConnections + messengerConnections + smsConnections + websiteConnections,
      orderValue: primaryOrderValue,
      paymentRevenue: primaryPaymentRevenue,
    },
    orderValueByCurrency: orderCurrencies,
    paymentRevenueByCurrency: paymentCurrencies,
    monthly,
    channels,
  };
}

async function usageReport(query = {}, paginate = true) {
  const range = periodRange(query);
  const selectedCompany = companyObjectId(query.companyId);
  const usageMatch = { period: { $gte: range.from, $lte: range.to } };
  const creditMatch = {
    type: "usage",
    direction: "debit",
    status: "completed",
    createdAt: { $gte: range.startDate, $lt: range.endDate },
  };
  if (selectedCompany) {
    usageMatch.companyId = selectedCompany;
    creditMatch.companyId = selectedCompany;
  }

  const [usageRows, creditRows, usageMonthly, creditMonthly] = await Promise.all([
    TokenUsage.aggregate([
      { $match: usageMatch },
      { $group: {
        _id: "$companyId",
        inputTokens: { $sum: "$inputTokens" }, outputTokens: { $sum: "$outputTokens" },
        totalTokens: { $sum: "$totalTokens" }, requestCount: { $sum: "$requestCount" },
        estimatedCostUsd: { $sum: "$estimatedCostUsd" },
        rag: { $sum: "$sources.rag" }, preprocessing: { $sum: "$sources.preprocessing" },
        realtime: { $sum: "$sources.realtime" }, ingestion: { $sum: "$sources.ingestion" },
        embedding: { $sum: "$sources.embedding" }, vision: { $sum: "$sources.vision" },
      } },
      { $lookup: { from: "companies", localField: "_id", foreignField: "_id", as: "company" } },
      { $unwind: { path: "$company", preserveNullAndEmptyArrays: true } },
      { $sort: { totalTokens: -1 } },
    ]),
    CreditTransaction.aggregate([
      { $match: creditMatch },
      { $group: { _id: "$companyId", creditsConsumed: { $sum: "$credits" } } },
    ]),
    TokenUsage.aggregate([
      { $match: usageMatch },
      { $group: {
        _id: "$period", inputTokens: { $sum: "$inputTokens" }, outputTokens: { $sum: "$outputTokens" },
        totalTokens: { $sum: "$totalTokens" }, estimatedCostUsd: { $sum: "$estimatedCostUsd" },
        rag: { $sum: "$sources.rag" }, preprocessing: { $sum: "$sources.preprocessing" },
        realtime: { $sum: "$sources.realtime" }, ingestion: { $sum: "$sources.ingestion" },
      } },
      { $sort: { _id: 1 } },
    ]),
    CreditTransaction.aggregate([
      { $match: creditMatch },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, creditsConsumed: { $sum: "$credits" } } },
    ]),
  ]);

  const creditMap = new Map(creditRows.map((item) => [String(item._id), Number(item.creditsConsumed || 0)]));
  const companies = usageRows.map((item) => ({
    companyId: item._id,
    companyName: item.company?.name || "Deleted company",
    companySlug: item.company?.slug || "",
    inputTokens: Number(item.inputTokens || 0), outputTokens: Number(item.outputTokens || 0),
    totalTokens: Number(item.totalTokens || 0), requestCount: Number(item.requestCount || 0),
    estimatedCostUsd: Number(item.estimatedCostUsd || 0),
    creditsConsumed: creditMap.get(String(item._id)) || 0,
    sources: {
      rag: Number(item.rag || 0), preprocessing: Number(item.preprocessing || 0),
      realtime: Number(item.realtime || 0), ingestion: Number(item.ingestion || 0),
      embedding: Number(item.embedding || 0), vision: Number(item.vision || 0),
    },
  }));
  const creditsByMonth = new Map(creditMonthly.map((item) => [item._id, Number(item.creditsConsumed || 0)]));
  const usageByMonth = new Map(usageMonthly.map((item) => [item._id, item]));
  const monthly = monthSeries(range.from, range.to).map((item) => {
    const row = usageByMonth.get(item) || {};
    return {
      period: item,
      inputTokens: Number(row.inputTokens || 0), outputTokens: Number(row.outputTokens || 0),
      totalTokens: Number(row.totalTokens || 0), estimatedCostUsd: Number(row.estimatedCostUsd || 0),
      creditsConsumed: creditsByMonth.get(item) || 0,
      sources: {
        rag: Number(row.rag || 0), preprocessing: Number(row.preprocessing || 0),
        realtime: Number(row.realtime || 0), ingestion: Number(row.ingestion || 0),
      },
    };
  });
  const summary = companies.reduce((total, item) => ({
    inputTokens: total.inputTokens + item.inputTokens,
    outputTokens: total.outputTokens + item.outputTokens,
    totalTokens: total.totalTokens + item.totalTokens,
    requestCount: total.requestCount + item.requestCount,
    estimatedCostUsd: total.estimatedCostUsd + item.estimatedCostUsd,
    creditsConsumed: total.creditsConsumed + item.creditsConsumed,
    sources: Object.fromEntries(Object.keys(total.sources).map((key) => [key, total.sources[key] + item.sources[key]])),
  }), { inputTokens: 0, outputTokens: 0, totalTokens: 0, requestCount: 0, estimatedCostUsd: 0, creditsConsumed: 0, sources: { rag: 0, preprocessing: 0, realtime: 0, ingestion: 0, embedding: 0, vision: 0 } });

  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20));
  const total = companies.length;
  return {
    range: { from: range.from, to: range.to }, summary, monthly,
    companies: paginate ? companies.slice((page - 1) * limit, page * limit) : companies,
    page, limit, total, pages: Math.max(1, Math.ceil(total / limit)),
    costTrackingEnabled: Boolean(Number(process.env.OPENAI_INPUT_COST_PER_1M || 0) || Number(process.env.OPENAI_OUTPUT_COST_PER_1M || 0)),
  };
}

router.get("/platform", async (_req, res, next) => {
  try { res.json(await platformReport()); } catch (error) { next(error); }
});

router.get("/usage/export", async (req, res, next) => {
  try {
    const report = await usageReport(req.query, false);
    const rows = [["Company", "Slug", "Input tokens", "Output tokens", "Total tokens", "Credits consumed", "Estimated cost USD", "RAG", "Preprocessing", "Voice", "PDF ingestion", "Embedding", "Vision"]];
    for (const item of report.companies) {
      rows.push([item.companyName, item.companySlug, item.inputTokens, item.outputTokens, item.totalTokens, item.creditsConsumed, item.estimatedCostUsd.toFixed(6), item.sources.rag, item.sources.preprocessing, item.sources.realtime, item.sources.ingestion, item.sources.embedding, item.sources.vision]);
    }
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="pentarix-ai-usage-${report.range.from}-to-${report.range.to}.csv"`);
    res.send(`\uFEFF${csv}`);
  } catch (error) { next(error); }
});

router.get("/usage", async (req, res, next) => {
  try { res.json(await usageReport(req.query)); } catch (error) { next(error); }
});

module.exports = router;
