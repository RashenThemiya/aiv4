const mongoose = require("mongoose");

const usageReceiptSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    operationId: { type: String, required: true, trim: true },
    source: { type: String, required: true, trim: true },
    status: { type: String, enum: ["processing", "completed", "failed"], default: "processing" },
  },
  { timestamps: true }
);

usageReceiptSchema.index({ companyId: 1, operationId: 1 }, { unique: true });

module.exports = mongoose.models.UsageReceipt || mongoose.model("UsageReceipt", usageReceiptSchema);
