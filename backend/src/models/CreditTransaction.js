const mongoose = require("mongoose");

const creditTransactionSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    walletId: { type: mongoose.Schema.Types.ObjectId, ref: "TokenWallet", required: true },
    type: { type: String, enum: ["purchase", "bonus", "usage", "refund", "adjustment", "migration", "reversal"], required: true },
    status: { type: String, enum: ["pending", "completed", "failed"], default: "completed" },
    direction: { type: String, enum: ["credit", "debit"], required: true },
    credits: { type: Number, required: true, min: 0 },
    balanceAfter: { type: Number, required: true, min: 0 },
    source: { type: String, default: "", trim: true },
    reference: { type: String, default: "", trim: true },
    paymentAmount: { type: Number, default: 0, min: 0 },
    paymentCurrency: { type: String, default: "LKR", uppercase: true, trim: true },
    note: { type: String, default: "", trim: true },
    inputTokens: { type: Number, default: 0, min: 0 },
    outputTokens: { type: Number, default: 0, min: 0 },
    totalTokens: { type: Number, default: 0, min: 0 },
    calculatedCredits: { type: Number, default: 0, min: 0 },
    uncoveredCredits: { type: Number, default: 0, min: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", default: null },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

creditTransactionSchema.index({ companyId: 1, createdAt: -1 });
creditTransactionSchema.index(
  { companyId: 1, type: 1, reference: 1 },
  { unique: true, partialFilterExpression: { type: "purchase", reference: { $type: "string", $gt: "" } } }
);

module.exports = mongoose.models.CreditTransaction || mongoose.model("CreditTransaction", creditTransactionSchema);
