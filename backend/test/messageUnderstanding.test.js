const test = require("node:test");
const assert = require("node:assert/strict");

const { SYSTEM_PROMPT, parseUnderstanding } = require("../src/services/messageUnderstanding");

test("classifier separates specific buying interest from catalogue discovery", () => {
  assert.match(SYSTEM_PROMPT, /mata kettle ekk gnn puluwnda/);
  assert.match(SYSTEM_PROMPT, /not list_products/);
  assert.match(SYSTEM_PROMPT, /fan eka gana sinhalen wisthara oni/);
});

test("parses a structured Singlish catalogue intent", () => {
  const result = parseUnderstanding(JSON.stringify({
    language: "si",
    style: "romanized",
    intent: "list_products",
    normalizedMessage: "What products are available?",
    productSku: "",
    productQuery: "",
    refersToPreviousProduct: false,
    confidence: 0.97,
  }));

  assert.equal(result.language, "si");
  assert.equal(result.intent, "list_products");
  assert.equal(result.normalizedMessage, "What products are available?");
});

test("preserves contextual product references from structured output", () => {
  const result = parseUnderstanding({
    language: "si",
    style: "romanized",
    intent: "product_details",
    normalizedMessage: "Give me more details about the active product.",
    productSku: "LHS-BLN-20",
    productQuery: "PowerMix Blender",
    refersToPreviousProduct: true,
    confidence: 0.92,
  });

  assert.equal(result.productSku, "LHS-BLN-20");
  assert.equal(result.refersToPreviousProduct, true);
});

test("rejects output outside the allowed intent schema", () => {
  assert.equal(parseUnderstanding({
    language: "si",
    style: "romanized",
    intent: "invent_product",
    normalizedMessage: "",
    productSku: "",
    productQuery: "",
    refersToPreviousProduct: false,
    confidence: 1,
  }), null);
});

test("normalizes an invalid confidence value into the supported range", () => {
  const result = parseUnderstanding({
    language: "en",
    style: "latin",
    intent: "general_support",
    normalizedMessage: "What is your return policy?",
    productSku: "",
    productQuery: "",
    refersToPreviousProduct: false,
    confidence: 4,
  });

  assert.equal(result.confidence, 1);
});
