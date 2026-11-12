const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeOrderUpdate } = require("../src/services/orderEditor");

test("admin order edits recalculate every total on the server", () => {
  const result = normalizeOrderUpdate({
    customer: { name: "  Nimal  ", phone: "0771234567", deliveryAddress: "Colombo" },
    items: [
      { name: "Kettle", sku: "K-1", variant: "Black", quantity: 2, unitPrice: 6500, lineTotal: 1 },
      { name: "Fan", quantity: 1, unitPrice: 8900, lineTotal: 1 },
    ],
    deliveryFee: 500,
    subtotal: 1,
    total: 1,
    currency: "lkr",
    paymentMethod: "Cash on delivery",
    priceStatus: "confirmed",
    status: "processing",
    notes: "Call before delivery",
  });

  assert.equal(result.customer.name, "Nimal");
  assert.equal(result.items[0].lineTotal, 13000);
  assert.equal(result.subtotal, 21900);
  assert.equal(result.total, 22400);
  assert.equal(result.currency, "LKR");
});

test("admin order edits reject invalid quantities and empty orders", () => {
  const validBase = {
    customer: { name: "Nimal", deliveryAddress: "Colombo" },
    deliveryFee: 0,
    paymentMethod: "Cash on delivery",
    priceStatus: "confirmed",
    status: "new",
  };
  assert.throws(
    () => normalizeOrderUpdate({ ...validBase, items: [] }),
    /at least one item/
  );
  assert.throws(
    () => normalizeOrderUpdate({
      ...validBase,
      items: [{ name: "Fan", quantity: 1.5, unitPrice: 8900 }],
    }),
    /whole number/
  );
});
