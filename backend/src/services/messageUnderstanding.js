const axios = require("axios");

const config = require("../config");
const { assertTokenAllowance, recordTokenUsage } = require("./tokenUsage");

const UNDERSTANDING_TIMEOUT_MS = Number(process.env.MESSAGE_UNDERSTANDING_TIMEOUT_MS || 15000);

const INTENTS = [
  "greeting",
  "thanks",
  "goodbye",
  "contact_owner",
  "list_products",
  "product_details",
  "product_availability",
  "product_order_interest",
  "general_support",
  "change_language",
  "cancel_order",
  "go_back",
  "change_order",
  "help",
  "order_field_answer",
  "unclear",
];

const LANGUAGES = ["en", "si", "ta"];
const STYLES = ["native", "romanized", "mixed", "latin", "unknown"];

const UNDERSTANDING_SCHEMA = {
  type: "object",
  properties: {
    language: {
      type: "string",
      enum: LANGUAGES,
      description: "Language the assistant should use for this reply: English, Sinhala, or Tamil.",
    },
    style: {
      type: "string",
      enum: STYLES,
      description: "Whether the customer used native script, romanized Sinhala/Tamil, mixed language, Latin-script English, or an unknown style.",
    },
    intent: {
      type: "string",
      enum: INTENTS,
      description: "The single best interpretation of the customer's current message in conversation context.",
    },
    normalizedMessage: {
      type: "string",
      description: "A faithful standalone English query for search. Preserve names, SKUs, numbers, addresses, and order-field answers exactly.",
    },
    productSku: {
      type: "string",
      description: "An exact SKU from the supplied catalogue when the customer clearly refers to it; otherwise an empty string.",
    },
    productQuery: {
      type: "string",
      description: "The normalized product/category phrase the customer refers to; otherwise an empty string.",
    },
    refersToPreviousProduct: {
      type: "boolean",
      description: "True when phrases such as it, that one, more details, or their multilingual equivalents refer to the active product.",
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
      description: "Confidence in the interpretation.",
    },
  },
  required: [
    "language",
    "style",
    "intent",
    "normalizedMessage",
    "productSku",
    "productQuery",
    "refersToPreviousProduct",
    "confidence",
  ],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You are the multilingual message-understanding router for a Sri Lankan commerce assistant.

Interpret English, Sinhala, Tamil, Singlish (Sinhala written with Latin letters), Tanglish, spelling mistakes, slang, code-switching, and short contextual follow-ups. Return classification data only; never answer the customer.

Important rules:
- Use the recent conversation, active product, order stage, and catalogue together.
- A request asking generally what the shop has, what items can be bought, "monwda thiyena dewal", "badu monawada", and semantic equivalents is list_products even without the words product or catalogue.
- list_products is only for a broad catalogue request. If the customer names or implies one product or category, classify that specific intent instead. For example, "mata kettle ekk gnn puluwnda" is product_order_interest for a kettle, not list_products.
- Resolve transliterations semantically. For example, "kethalaya/kethalayak" may mean kettle, and "thawath wisthara oni" means the customer wants more details about the active product.
- Explicit response-language phrases override surrounding English product words. "sinhalen", "Sinhala walin", and semantic equivalents require language si; their Tamil equivalents require language ta. For example, "fan eka gana sinhalen wisthara oni" is language si and product_details for the fan.
- productSku must be copied exactly from the supplied catalogue. Never invent an SKU.
- product_order_interest means the customer expresses interest in buying. It does not authorize collecting an order; ordering begins only through the application's explicit Place order action.
- In a non-browsing order stage, ordinary names, phone numbers, addresses, quantities, variants, and payment answers are order_field_answer. Only classify a control intent when it is clear.
- For an ambiguous short follow-up, keep the current response language and use conversation context rather than inventing a new topic.
- normalizedMessage must preserve the customer's meaning. Do not add specifications, products, symptoms, or goals they did not mention.
- Use unclear only when no reasonable interpretation is possible.

Classification examples:
- "oyala laga thawa monwd thiyenne" -> language si, intent list_products, no specific product.
- "mata kettle ekk gnn puluwnda" -> language si, intent product_order_interest, productQuery "kettle".
- "fan eka gana sinhalen wisthara oni" -> language si, intent product_details, productQuery "fan".
- "Tell me about LHS-FAN-16" while the current response language is Sinhala and the message came from a catalogue suggestion -> keep language si when the conversation context clearly remains Sinhala.`;

function compactCatalog(catalog = {}) {
  return (catalog.products || []).slice(0, 100).map((product) => ({
    sku: product.sku || "",
    names: [product.name, ...(product.alternateNames || [])].filter(Boolean).slice(0, 6),
  }));
}

function compactHistory(messages = []) {
  return messages.slice(-10).map((item) => ({
    role: item.role,
    content: String(item.content || "").slice(0, 800),
  }));
}

function parseUnderstanding(content) {
  if (!content) return null;
  try {
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    if (!LANGUAGES.includes(parsed.language)
      || !STYLES.includes(parsed.style)
      || !INTENTS.includes(parsed.intent)) return null;
    return {
      language: parsed.language,
      style: parsed.style,
      intent: parsed.intent,
      normalizedMessage: String(parsed.normalizedMessage || "").trim(),
      productSku: String(parsed.productSku || "").trim(),
      productQuery: String(parsed.productQuery || "").trim(),
      refersToPreviousProduct: parsed.refersToPreviousProduct === true,
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
    };
  } catch (_error) {
    return null;
  }
}

async function understandCustomerMessage({
  message,
  companyId,
  currentLanguage = "",
  orderStage = "browsing",
  recentMessages = [],
  activeProduct = null,
  catalog = { products: [] },
}) {
  const original = String(message || "").trim();
  if (!original || !config.openaiApiKey) return null;

  await assertTokenAllowance(companyId);
  try {
    const { data } = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: config.openaiChatModel,
        temperature: 0,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "customer_message_understanding",
            strict: true,
            schema: UNDERSTANDING_SCHEMA,
          },
        },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify({
              message: original,
              currentResponseLanguage: currentLanguage || "not selected",
              orderStage,
              activeProduct: activeProduct ? {
                sku: activeProduct.sku || "",
                name: activeProduct.name || "",
              } : null,
              catalogue: compactCatalog(catalog),
              recentConversation: compactHistory(recentMessages),
            }),
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${config.openaiApiKey}`,
          "Content-Type": "application/json",
        },
        timeout: UNDERSTANDING_TIMEOUT_MS,
      }
    );
    await recordTokenUsage(companyId, data?.usage, "preprocessing");
    if (data?.choices?.[0]?.message?.refusal) return null;
    return parseUnderstanding(data?.choices?.[0]?.message?.content);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[messageUnderstanding] fallback: ${error.message}`);
    }
    return null;
  }
}

module.exports = {
  INTENTS,
  SYSTEM_PROMPT,
  UNDERSTANDING_SCHEMA,
  parseUnderstanding,
  understandCustomerMessage,
};
