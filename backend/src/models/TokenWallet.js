const mongoose = require("mongoose");

const tokenWalletSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, unique: true, index: true },
    availableCredits: { type: Number, default: 0, min: 0 },
    lifetimePurchased: { type: Number, default: 0, min: 0 },
    lifetimeBonus: { type: Number, default: 0, min: 0 },
    lifetimeAdjusted: { type: Number, default: 0 },
    lifetimeUsed: { type: Number, default: 0, min: 0 },
    lowBalanceThreshold: { type: Number, default: 100000, min: 0 },
    status: { type: String, enum: ["active", "suspended"], default: "active" },
  },
  { timestamps: true }
);

module.exports = mongoose.models.TokenWallet || mongoose.model("TokenWallet", tokenWalletSchema);
