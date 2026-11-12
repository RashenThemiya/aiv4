const test = require("node:test");
const assert = require("node:assert/strict");

const { addCredits, calculateCredits, normalizedUsage } = require("../src/services/tokenUsage");
const TokenWallet = require("../src/models/TokenWallet");
const CreditTransaction = require("../src/models/CreditTransaction");

test("normalizes Chat Completions and Responses usage fields", () => {
  assert.deepEqual(
    normalizedUsage({ prompt_tokens: 100, completion_tokens: 25, total_tokens: 125 }),
    { inputTokens: 100, outputTokens: 25, totalTokens: 125 }
  );
  assert.deepEqual(
    normalizedUsage({ input_tokens: 80, output_tokens: 20, total_tokens: 100 }),
    { inputTokens: 80, outputTokens: 20, totalTokens: 100 }
  );
});

test("weights output credits separately from input credits", () => {
  const previousInput = process.env.PENTARIX_INPUT_CREDITS_PER_1M;
  const previousOutput = process.env.PENTARIX_OUTPUT_CREDITS_PER_1M;
  process.env.PENTARIX_INPUT_CREDITS_PER_1M = "1000000";
  process.env.PENTARIX_OUTPUT_CREDITS_PER_1M = "4000000";
  try {
    assert.equal(calculateCredits({ input_tokens: 1000, output_tokens: 250 }), 2000);
  } finally {
    if (previousInput === undefined) delete process.env.PENTARIX_INPUT_CREDITS_PER_1M;
    else process.env.PENTARIX_INPUT_CREDITS_PER_1M = previousInput;
    if (previousOutput === undefined) delete process.env.PENTARIX_OUTPUT_CREDITS_PER_1M;
    else process.env.PENTARIX_OUTPUT_CREDITS_PER_1M = previousOutput;
  }
});

test("wallet and immutable ledger schemas accept prepaid records", async () => {
  const companyId = "507f1f77bcf86cd799439011";
  const wallet = new TokenWallet({ companyId, availableCredits: 500000, lifetimePurchased: 500000 });
  await wallet.validate();
  const transaction = new CreditTransaction({
    companyId,
    walletId: wallet._id,
    type: "purchase",
    direction: "credit",
    credits: 500000,
    balanceAfter: 500000,
    reference: "INV-TEST-1",
  });
  await transaction.validate();
  assert.equal(transaction.balanceAfter, 500000);
});

test("credit ledger accepts a debit reversal without deleting the purchase", async () => {
  const companyId = "507f1f77bcf86cd799439011";
  const transaction = new CreditTransaction({
    companyId,
    walletId: "507f1f77bcf86cd799439012",
    type: "reversal",
    direction: "debit",
    credits: 160000,
    balanceAfter: 340000,
    reference: "REV-507f1f77bcf86cd799439013",
  });
  await transaction.validate();
  assert.equal(transaction.type, "reversal");
  assert.equal(transaction.direction, "debit");
});

test("paid top-up creates its ledger entry before changing the wallet", async () => {
  const originalFindOne = TokenWallet.findOne;
  const originalFindOneAndUpdate = TokenWallet.findOneAndUpdate;
  const originalCreate = CreditTransaction.create;
  const calls = [];
  const wallet = {
    _id: "507f1f77bcf86cd799439012",
    companyId: "507f1f77bcf86cd799439011",
    availableCredits: 1000,
  };
  TokenWallet.findOne = async () => wallet;
  CreditTransaction.create = async (payload) => {
    calls.push("ledger");
    return { ...payload, _id: "507f1f77bcf86cd799439013", save: async () => calls.push("ledger-complete") };
  };
  TokenWallet.findOneAndUpdate = async () => {
    calls.push("wallet");
    return { ...wallet, availableCredits: 161000 };
  };
  try {
    const result = await addCredits(wallet.companyId, {
      credits: 160000,
      type: "purchase",
      reference: "INV-2000-TEST",
      paymentAmount: 5000,
      paymentCurrency: "LKR",
    });
    assert.deepEqual(calls, ["ledger", "wallet", "ledger-complete"]);
    assert.equal(result.transaction.balanceAfter, 161000);
  } finally {
    TokenWallet.findOne = originalFindOne;
    TokenWallet.findOneAndUpdate = originalFindOneAndUpdate;
    CreditTransaction.create = originalCreate;
  }
});
