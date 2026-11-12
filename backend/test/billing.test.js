const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const PricingPlan = require("../src/models/PricingPlan");
const CreditPurchaseRequest = require("../src/models/CreditPurchaseRequest");

test("pricing plans validate a positive credit package", async () => {
  const plan = new PricingPlan({ name: "Growth", price: 5000, currency: "lkr", credits: 160000 });
  await plan.validate();
  assert.equal(plan.currency, "LKR");
  assert.equal(plan.credits, 160000);
});

test("payment requests snapshot plan value and start pending", async () => {
  const id = new mongoose.Types.ObjectId();
  const request = new CreditPurchaseRequest({
    companyId: id,
    planId: new mongoose.Types.ObjectId(),
    planName: "Growth",
    credits: 160000,
    amount: 5000,
    currency: "LKR",
    slipPath: "payment-slips/example.png",
    slipOriginalName: "receipt.png",
    slipMimeType: "image/png",
    submittedBy: new mongoose.Types.ObjectId(),
  });
  await request.validate();
  assert.equal(request.status, "pending");
  assert.equal(request.credits, 160000);
  assert.equal(request.amount, 5000);
});

test("approved payment requests can retain a permanent reversal audit record", async () => {
  const request = new CreditPurchaseRequest({
    companyId: new mongoose.Types.ObjectId(),
    planId: new mongoose.Types.ObjectId(),
    planName: "Growth",
    credits: 160000,
    amount: 5000,
    currency: "LKR",
    slipPath: "payment-slips/example.png",
    slipOriginalName: "receipt.png",
    slipMimeType: "image/png",
    submittedBy: new mongoose.Types.ObjectId(),
    status: "reversed",
    creditTransactionId: new mongoose.Types.ObjectId(),
    reversalTransactionId: new mongoose.Types.ObjectId(),
    reversedBy: new mongoose.Types.ObjectId(),
    reversedAt: new Date(),
    reversalReason: "Duplicate bank payment allocation",
  });
  await request.validate();
  assert.equal(request.status, "reversed");
  assert.equal(request.reversalReason, "Duplicate bank payment allocation");
});
