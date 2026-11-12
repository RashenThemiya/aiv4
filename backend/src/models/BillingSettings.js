const mongoose = require("mongoose");

const billingSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "default", unique: true },
    bankName: { type: String, default: "", trim: true },
    accountName: { type: String, default: "", trim: true },
    accountNumber: { type: String, default: "", trim: true },
    branch: { type: String, default: "", trim: true },
    instructions: { type: String, default: "", trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

module.exports = mongoose.models.BillingSettings || mongoose.model("BillingSettings", billingSettingsSchema);
