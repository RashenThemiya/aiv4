const mongoose = require("mongoose");

const pricingPlanSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: "", trim: true, maxlength: 500 },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "LKR", uppercase: true, trim: true, maxlength: 3 },
    credits: { type: Number, required: true, min: 1 },
    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", default: null },
  },
  { timestamps: true }
);

pricingPlanSchema.index({ isActive: 1, sortOrder: 1, price: 1 });

module.exports = mongoose.models.PricingPlan || mongoose.model("PricingPlan", pricingPlanSchema);
