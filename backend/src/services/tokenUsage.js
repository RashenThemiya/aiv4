const Company = require("../models/Company");
const TokenUsage = require("../models/TokenUsage");
const TokenWallet = require("../models/TokenWallet");
const CreditTransaction = require("../models/CreditTransaction");
const UsageReceipt = require("../models/UsageReceipt");

function currentPeriod(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function normalizedUsage(usage = {}) {
  const inputTokens = Math.max(0, Number(usage.input_tokens ?? usage.prompt_tokens ?? 0) || 0);
  const outputTokens = Math.max(0, Number(usage.output_tokens ?? usage.completion_tokens ?? 0) || 0);
  const totalTokens = Math.max(0, Number(usage.total_tokens ?? inputTokens + outputTokens) || 0);
  return { inputTokens, outputTokens, totalTokens };
}

function rateFor(source, direction) {
  const realtime = source === "realtime";
  const key = realtime
    ? `PENTARIX_REALTIME_${direction.toUpperCase()}_CREDITS_PER_1M`
    : `PENTARIX_${direction.toUpperCase()}_CREDITS_PER_1M`;
  const fallback = direction === "input" ? 1000000 : 4000000;
  return Math.max(0, Number(process.env[key] || fallback) || 0);
}

function calculateCredits(usage, source = "rag") {
  const values = normalizedUsage(usage);
  if (!values.totalTokens) return 0;
  return Math.max(1, Math.ceil(
    (values.inputTokens * rateFor(source, "input") +
      values.outputTokens * rateFor(source, "output")) / 1000000
  ));
}

function estimateCostUsd({ inputTokens, outputTokens }) {
  const inputRate = Math.max(0, Number(process.env.OPENAI_INPUT_COST_PER_1M || 0) || 0);
  const outputRate = Math.max(0, Number(process.env.OPENAI_OUTPUT_COST_PER_1M || 0) || 0);
  return (inputTokens * inputRate + outputTokens * outputRate) / 1000000;
}

async function ensureWallet(companyId) {
  let wallet = await TokenWallet.findOne({ companyId });
  if (wallet) return wallet;

  const [company, usage] = await Promise.all([
    Company.findById(companyId).select("monthlyTokenLimit"),
    TokenUsage.findOne({ companyId, period: currentPeriod() }).lean(),
  ]);
  if (!company) return null;

  const legacyLimit = Math.max(0, Number(company.monthlyTokenLimit || 0));
  const legacyUsed = Math.max(0, Number(usage?.totalTokens || 0));
  const migrationCredits = legacyLimit === 0 ? 0 : Math.max(0, legacyLimit - legacyUsed);
  let created = false;
  try {
    wallet = await TokenWallet.create({
      companyId,
      availableCredits: migrationCredits,
      lifetimeBonus: migrationCredits,
      status: migrationCredits > 0 ? "active" : "suspended",
    });
    created = true;
  } catch (error) {
    if (error?.code !== 11000) throw error;
    wallet = await TokenWallet.findOne({ companyId });
  }

  if (created && migrationCredits > 0) {
    await CreditTransaction.create({
      companyId,
      walletId: wallet._id,
      type: "migration",
      direction: "credit",
      credits: migrationCredits,
      balanceAfter: migrationCredits,
      source: "legacy-monthly-allowance",
      note: "Opening credit migrated from the previous monthly token allowance",
    });
  }
  return wallet;
}

async function addCredits(companyId, options = {}) {
  const credits = Math.floor(Number(options.credits || 0));
  if (!Number.isFinite(credits) || credits <= 0) {
    const error = new Error("Credit amount must be a positive whole number");
    error.statusCode = 400;
    throw error;
  }
  const type = ["purchase", "bonus", "refund", "adjustment"].includes(options.type)
    ? options.type
    : "purchase";
  if (type === "purchase" && !String(options.reference || "").trim()) {
    const error = new Error("A payment or invoice reference is required for purchased credits");
    error.statusCode = 400;
    throw error;
  }
  if (type === "purchase" && !(Number(options.paymentAmount) > 0)) {
    const error = new Error("The paid amount is required for purchased credits");
    error.statusCode = 400;
    throw error;
  }
  const wallet = await ensureWallet(companyId);
  if (!wallet) {
    const error = new Error("Company not found");
    error.statusCode = 404;
    throw error;
  }

  const lifetimeField = type === "purchase"
    ? "lifetimePurchased"
    : type === "bonus"
      ? "lifetimeBonus"
      : "lifetimeAdjusted";
  let transaction;
  try {
    transaction = await CreditTransaction.create({
      companyId,
      walletId: wallet._id,
      type,
      status: "pending",
      direction: "credit",
      credits,
      balanceAfter: wallet.availableCredits,
      source: options.source || "admin",
      reference: options.reference || "",
      paymentAmount: Number(options.paymentAmount || 0),
      paymentCurrency: String(options.paymentCurrency || "LKR").toUpperCase(),
      note: options.note || "",
      createdBy: options.createdBy || null,
      expiresAt: options.expiresAt || null,
    });
  } catch (error) {
    if (error?.code === 11000 && type === "purchase") {
      const existing = await CreditTransaction.findOne({ companyId, type, reference: options.reference });
      if (existing?.status === "completed") {
        return { wallet: await TokenWallet.findById(wallet._id), transaction: existing, duplicate: true };
      }
      const conflict = new Error("This payment reference is already being processed");
      conflict.statusCode = 409;
      throw conflict;
    }
    throw error;
  }

  try {
    const updated = await TokenWallet.findOneAndUpdate(
      { _id: wallet._id },
      { $inc: { availableCredits: credits, [lifetimeField]: credits }, $set: { status: "active" } },
      { new: true }
    );
    transaction.balanceAfter = updated.availableCredits;
    transaction.status = "completed";
    await transaction.save();
    return { wallet: updated, transaction };
  } catch (error) {
    await CreditTransaction.updateOne(
      { _id: transaction._id },
      { $set: { status: "failed", note: error.message } }
    );
    throw error;
  }
}

async function chargeWallet(companyId, usage, source = "rag") {
  const values = normalizedUsage(usage);
  const calculatedCredits = calculateCredits(usage, source);
  if (!calculatedCredits) return null;
  const wallet = await ensureWallet(companyId);
  if (!wallet) return null;

  const before = await TokenWallet.findOneAndUpdate(
    { _id: wallet._id },
    [
      {
        $set: {
          availableCredits: { $max: [0, { $subtract: ["$availableCredits", calculatedCredits] }] },
          lifetimeUsed: { $add: ["$lifetimeUsed", { $min: ["$availableCredits", calculatedCredits] }] },
          status: {
            $cond: [{ $gte: ["$availableCredits", calculatedCredits] }, "$status", "suspended"],
          },
          updatedAt: "$$NOW",
        },
      },
    ],
    { new: false }
  );
  const chargedCredits = Math.min(Number(before.availableCredits), calculatedCredits);
  const uncoveredCredits = Math.max(0, calculatedCredits - chargedCredits);
  const balanceAfter = Math.max(0, Number(before.availableCredits) - calculatedCredits);

  try {
    await CreditTransaction.create({
      companyId,
      walletId: before._id,
      type: "usage",
      direction: "debit",
      credits: chargedCredits,
      balanceAfter,
      source,
      inputTokens: values.inputTokens,
      outputTokens: values.outputTokens,
      totalTokens: values.totalTokens,
      calculatedCredits,
      uncoveredCredits,
      note: uncoveredCredits ? "Usage exceeded the remaining prepaid balance" : "AI usage charge",
    });
  } catch (error) {
    await TokenWallet.updateOne(
      { _id: before._id },
      {
        $inc: { availableCredits: chargedCredits, lifetimeUsed: -chargedCredits },
        $set: { status: before.status },
      }
    );
    throw error;
  }
  return { balanceAfter, chargedCredits, calculatedCredits, uncoveredCredits };
}

async function recordTokenUsage(companyId, usage, source = "rag", options = {}) {
  const values = normalizedUsage(usage);
  if (!companyId || values.totalTokens <= 0) return null;
  const allowedSource = ["rag", "preprocessing", "realtime", "embedding", "vision", "ingestion"].includes(source)
    ? source
    : "rag";
  let receipt = null;
  if (options.operationId) {
    try {
      receipt = await UsageReceipt.create({
        companyId,
        operationId: String(options.operationId).slice(0, 200),
        source: allowedSource,
      });
    } catch (error) {
      if (error?.code === 11000) return { duplicate: true };
      throw error;
    }
  }
  try {
    const usageRecord = await TokenUsage.findOneAndUpdate(
      { companyId, period: currentPeriod() },
      {
        $inc: {
          inputTokens: values.inputTokens,
          outputTokens: values.outputTokens,
          totalTokens: values.totalTokens,
          requestCount: 1,
          estimatedCostUsd: estimateCostUsd(values),
          [`sources.${allowedSource}`]: values.totalTokens,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    const charge = await chargeWallet(companyId, usage, allowedSource);
    if (receipt) await UsageReceipt.updateOne({ _id: receipt._id }, { $set: { status: "completed" } });
    return { usage: usageRecord, charge };
  } catch (error) {
    if (receipt) await UsageReceipt.updateOne({ _id: receipt._id }, { $set: { status: "failed" } });
    throw error;
  }
}

async function walletSummary(companyId) {
  const wallet = await ensureWallet(companyId);
  if (!wallet) return null;
  return {
    availableCredits: wallet.availableCredits,
    lifetimePurchased: wallet.lifetimePurchased,
    lifetimeBonus: wallet.lifetimeBonus,
    lifetimeAdjusted: wallet.lifetimeAdjusted,
    lifetimeUsed: wallet.lifetimeUsed,
    lifetimeGranted: wallet.lifetimePurchased + wallet.lifetimeBonus + wallet.lifetimeAdjusted,
    lowBalanceThreshold: wallet.lowBalanceThreshold,
    lowBalance: wallet.availableCredits <= wallet.lowBalanceThreshold,
    status: wallet.status,
    inputCreditsPerMillion: rateFor("rag", "input"),
    outputCreditsPerMillion: rateFor("rag", "output"),
  };
}

async function getTokenUsage(companyId) {
  const [usage, wallet] = await Promise.all([
    TokenUsage.findOne({ companyId, period: currentPeriod() }).lean(),
    walletSummary(companyId),
  ]);
  if (!wallet) return null;
  return {
    period: currentPeriod(),
    inputTokens: Number(usage?.inputTokens || 0),
    outputTokens: Number(usage?.outputTokens || 0),
    totalTokens: Number(usage?.totalTokens || 0),
    requestCount: Number(usage?.requestCount || 0),
    estimatedCostUsd: Number(usage?.estimatedCostUsd || 0),
    costTrackingEnabled: Boolean(Number(process.env.OPENAI_INPUT_COST_PER_1M || 0) || Number(process.env.OPENAI_OUTPUT_COST_PER_1M || 0)),
    sources: usage?.sources || {},
    wallet,
  };
}

async function listTransactions(companyId, { limit = 50, page = 1 } = {}) {
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
  const safePage = Math.max(1, Number(page) || 1);
  const [transactions, total] = await Promise.all([
    CreditTransaction.find({ companyId }).sort({ createdAt: -1 }).skip((safePage - 1) * safeLimit).limit(safeLimit).lean(),
    CreditTransaction.countDocuments({ companyId }),
  ]);
  return { transactions, total, page: safePage, limit: safeLimit };
}

async function assertTokenAllowance(companyId) {
  const wallet = await ensureWallet(companyId);
  if (!wallet) {
    const error = new Error("Company not found");
    error.statusCode = 404;
    throw error;
  }
  if (wallet.status !== "active" || wallet.availableCredits <= 0) {
    const error = new Error("This company's prepaid AI credit balance is empty. Please contact the account administrator.");
    error.statusCode = 402;
    error.code = "CREDIT_BALANCE_EMPTY";
    throw error;
  }
  return wallet;
}

module.exports = {
  currentPeriod,
  normalizedUsage,
  calculateCredits,
  ensureWallet,
  addCredits,
  recordTokenUsage,
  walletSummary,
  getTokenUsage,
  listTransactions,
  assertTokenAllowance,
};
