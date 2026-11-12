const test = require("node:test");
const assert = require("node:assert/strict");

const { dedupeProductsBySku, normalizeSku } = require("../src/services/productIdentity");

test("normalizeSku removes pasted formatting and canonicalizes case", () => {
  assert.equal(normalizeSku(" `lhs-ktl-17` "), "LHS-KTL-17");
  assert.equal(normalizeSku("“lhs-fan-16”"), "LHS-FAN-16");
});

test("dedupeProductsBySku treats decorated and clean SKUs as one product", () => {
  const products = dedupeProductsBySku([
    { _id: "bad", sku: "`LHS-KTL-17`", name: { en: "QuickBoil Glass Kettle" } },
    { _id: "clean", sku: "LHS-KTL-17", name: { en: "QuickBoil Glass Kettle" } },
    { _id: "fan", sku: "LHS-FAN-16", name: { en: "AeroBreeze Table Fan" } },
  ]);

  assert.equal(products.length, 2);
  assert.equal(products.find((product) => normalizeSku(product.sku) === "LHS-KTL-17")._id, "clean");
});
