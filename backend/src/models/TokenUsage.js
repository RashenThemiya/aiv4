const mongoose = require("mongoose");

const tokenUsageSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    period: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}$/,
    },
    inputTokens: { type: Number, default: 0, min: 0 },
    outputTokens: { type: Number, default: 0, min: 0 },
    totalTokens: { type: Number, default: 0, min: 0 },
    requestCount: { type: Number, default: 0, min: 0 },
    estimatedCostUsd: { type: Number, default: 0, min: 0 },
    sources: {
      rag: { type: Number, default: 0, min: 0 },
      preprocessing: { type: Number, default: 0, min: 0 },
      realtime: { type: Number, default: 0, min: 0 },
      embedding: { type: Number, default: 0, min: 0 },
      vision: { type: Number, default: 0, min: 0 },
      ingestion: { type: Number, default: 0, min: 0 },
    },
  },
  { timestamps: true }
);

tokenUsageSchema.index({ companyId: 1, period: 1 }, { unique: true });

module.exports =
  mongoose.models.TokenUsage || mongoose.model("TokenUsage", tokenUsageSchema);
