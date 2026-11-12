const test = require("node:test");
const assert = require("node:assert/strict");

const {
  customerFacingAnswer,
  supportDetails,
  unknownAnswer,
} = require("../src/services/customerResponse");

test("customer-facing answers remove internal RAG citation markers", () => {
  assert.equal(
    customerFacingAnswer("The kettle holds 1.7 litres [Source 1]. It has auto shut-off [Source 2]."),
    "The kettle holds 1.7 litres. It has auto shut-off."
  );
});

test("unknown answers provide configured human support details", () => {
  const company = {
    name: "Lanka Home Store",
    assistantSettings: {
      supportPhone: "0756727000",
      supportWhatsApp: "0771234567",
      businessHours: "Mon-Sat 9 AM-6 PM",
    },
  };
  const answer = unknownAnswer(company, "en");
  assert.match(answer, /don’t have confirmed information/i);
  assert.match(answer, /0756727000/);
  assert.match(answer, /0771234567/);
  assert.match(answer, /Mon-Sat 9 AM-6 PM/);
  assert.equal(supportDetails(company).business, "Lanka Home Store");
});

test("parcel phone remains a safe fallback for legacy companies", () => {
  const answer = unknownAnswer({ name: "Legacy Shop", shippingDetails: { phone: "0112345678" } }, "en");
  assert.match(answer, /0112345678/);
});
