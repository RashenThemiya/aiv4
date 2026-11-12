const mongoose = require("mongoose");

const schema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: "PricingPlan", required: true },
    planName: { type: String, required: true, trim: true },
    credits: { type: Number, required: true, min: 1 },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, uppercase: true, trim: true },
    bankReference: { type: String, default: "", trim: true, maxlength: 150 },
    note: { type: String, default: "", trim: true, maxlength: 500 },
    slipPath: { type: String, required: true, select: false },
    slipOriginalName: { type: String, required: true },
    slipMimeType: { type: String, required: true },
    status: { type: String, enum: ["pending", "processing", "approved", "rejected", "reversing", "reversed"], default: "pending", index: true },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", required: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: "", trim: true, maxlength: 500 },
    creditTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: "CreditTransaction", default: null },
    reversalTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: "CreditTransaction", default: null },
    reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", default: null },
    reversedAt: { type: Date, default: null },
    reversalReason: { type: String, default: "", trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

schema.index({ companyId: 1, createdAt: -1 });
schema.index({ status: 1, createdAt: -1 });
schema.index({ createdAt: -1 });

module.exports = mongoose.models.CreditPurchaseRequest || mongoose.model("CreditPurchaseRequest", schema);
