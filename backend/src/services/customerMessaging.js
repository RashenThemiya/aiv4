const {
  commercialProductAnswer,
  processCommerceMessage,
  withContactOwnerSuggestion,
  withPlaceOrderSuggestion,
} = require("./commerce");
const { preprocessUserMessage } = require("./messagePreprocessor");
const Company = require("../models/Company");
const ragClient = require("./ragClient");
const { findQuestionMedia, mapSourcesWithMedia } = require("./sourceMedia");
const { assertTokenAllowance } = require("./tokenUsage");
const { customerFacingAnswer, unknownAnswer } = require("./customerResponse");

async function processCustomerMessage({ companyId, sessionId, channel, text, customer }) {
  const commerce = await processCommerceMessage({
    companyId,
    sessionId,
    channel,
    text,
    customer,
  });
  if (commerce.handled) {
    const catalogMedia = Array.isArray(commerce.media) ? commerce.media : [];
    const pdfMedia = catalogMedia.length ? [] : await findQuestionMedia(companyId, text);
    const media = catalogMedia.length ? catalogMedia : pdfMedia;
    if (media.length && commerce.conversation?.messages?.length) {
      commerce.conversation.messages[commerce.conversation.messages.length - 1].media = media;
      await commerce.conversation.save();
    }
    return { ...commerce, media };
  }

  const { conversation, language } = commerce;
  await assertTokenAllowance(companyId);
  const preprocessed = commerce.understanding
    ? { type: "support", question: commerce.normalizedMessage || text }
    : await preprocessUserMessage(text, {
      responseLanguage: language,
      companyId: String(companyId),
    });
  if (preprocessed.type === "small_talk") {
    const reply = customerFacingAnswer(preprocessed.reply);
    conversation.messages.push({ role: "assistant", content: reply });
    await conversation.save();
    return {
      answer: reply,
      sources: [],
      conversation,
      language,
    };
  }

  const ragContext = ragClient.buildConversationRagContext(
    conversation.messages.slice(0, -1),
    conversation.ragContext
  );
  if (commerce.catalogProduct) {
    ragContext.preferredProductNames = [
      commerce.catalogProduct.name,
      ...(commerce.catalogProduct.alternateNames || []),
    ].filter(Boolean);
    ragContext.preferredModelIds = [commerce.catalogProduct.sku].filter(Boolean);
    ragContext.preferredDocumentIds = [];
  }
  const ragResult = await ragClient.queryKnowledge({
    companyId: String(companyId),
    question: preprocessed.question,
    responseLanguage: language,
    catalogProductNames: commerce.catalogProduct
      ? [commerce.catalogProduct.name, ...(commerce.catalogProduct.alternateNames || [])]
      : [],
    catalogModelIds: commerce.catalogProduct?.sku ? [commerce.catalogProduct.sku] : [],
    ...ragContext,
  });
  const mapped = await mapSourcesWithMedia(companyId, ragResult.sources || []);
  const fallbackMedia = await findQuestionMedia(companyId, text);
  const { sources } = mapped;
  const media = mapped.media.length ? mapped.media : fallbackMedia;
  const ragAnswer = ragResult.answer || "";
  const hasGroundedKnowledge = sources.length > 0 || media.length > 0;
  const rawAnswer = commerce.catalogProduct && !hasGroundedKnowledge
    ? commercialProductAnswer(commerce.catalogProduct, language)
    : hasGroundedKnowledge
      ? ragAnswer
      : unknownAnswer(await Company.findById(companyId).lean(), language);
  const answer = customerFacingAnswer(rawAnswer);
  const suggestions = commerce.catalogProduct
    ? withPlaceOrderSuggestion(ragResult.suggestions || [], commerce.catalogProduct, language)
    : sources.length === 0 && media.length === 0
      ? withContactOwnerSuggestion(ragResult.suggestions || [], language)
      : (ragResult.suggestions || []);
  ragClient.updateConversationRagContext(conversation, ragResult);
  conversation.messages.push({ role: "assistant", content: answer, sources, media });
  await conversation.save();
  return { answer, sources, media, conversation, language, suggestions };
}

module.exports = { processCustomerMessage };
