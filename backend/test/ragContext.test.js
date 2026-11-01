const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildConversationRagContext,
  updateConversationRagContext,
} = require("../src/services/ragClient");


test("uses the closest sourced answer as the preferred document scope", () => {
  const context = buildConversationRagContext([
    { role: "user", content: "What is SunSaver?" },
    {
      role: "assistant",
      content: "It is a solar controller.",
      sources: [{ documentId: "sun-manual" }, { documentId: "sun-manual" }],
    },
    { role: "user", content: "Thanks" },
    { role: "assistant", content: "You're welcome!", sources: [] },
  ]);

  assert.deepEqual(context.preferredDocumentIds, ["sun-manual"]);
  assert.equal(context.history.length, 4);
});

test("persisted RAG context survives answers without sources", () => {
  const context = buildConversationRagContext(
    [
      { role: "user", content: "What AC output versions are available?" },
      { role: "assistant", content: "I couldn't confirm that.", sources: [] },
    ],
    {
      productNames: ["suresine"],
      modelIds: [],
      documentIds: ["suresine-datasheet"],
    }
  );

  assert.deepEqual(context.preferredProductNames, ["suresine"]);
  assert.deepEqual(context.preferredDocumentIds, ["suresine-datasheet"]);
});

test("an explicitly named new product replaces the previous RAG topic", () => {
  const conversation = {
    ragContext: {
      productNames: ["suresine"],
      modelIds: ["SI300220V"],
      documentIds: ["suresine-manual"],
    },
  };

  updateConversationRagContext(conversation, {
    sources: [],
    diagnostics: {
      retrieval: {
        explicit_product_names: "sunkeeper",
        required_product_names: "sunkeeper",
        explicit_model_ids: "",
        required_model_ids: "",
      },
    },
  });

  assert.deepEqual(conversation.ragContext, {
    productNames: ["sunkeeper"],
    modelIds: [],
    documentIds: [],
  });
});
