const axios = require("axios");
const config = require("../../config");
const MessengerIntegration = require("../../models/MessengerIntegration");
const { processCustomerMessage } = require("../../services/customerMessaging");

function splitMessage(text, limit = 1900) {
  const chunks = [];
  let rest = String(text || "").trim();
  while (rest.length > limit) {
    const window = rest.slice(0, limit + 1);
    const breakAt = Math.max(window.lastIndexOf("\n"), window.lastIndexOf(" "));
    const end = breakAt >= Math.floor(limit * 0.6) ? breakAt : limit;
    chunks.push(rest.slice(0, end).trim());
    rest = rest.slice(end).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

async function integrationForPage(pageId) {
  const integration = await MessengerIntegration.findOne({ pageId, isActive: true })
    .select("+encryptedPageAccessToken +pageAccessTokenIv +pageAccessTokenAuthTag");
  if (!integration) throw new Error("Messenger integration not found for Facebook Page");
  return integration;
}

async function integrationForCompany(companyId) {
  const integration = await MessengerIntegration.findOne({ companyId, isActive: true })
    .select("+encryptedPageAccessToken +pageAccessTokenIv +pageAccessTokenAuthTag");
  if (!integration) throw new Error("Active Messenger integration not found for company");
  return integration;
}

async function sendText({
  recipientId,
  text,
  integration,
  companyId,
  suggestions = [],
  messagingType = "RESPONSE",
  tag = "",
}) {
  if (!recipientId || !String(recipientId).trim()) {
    throw new Error("Messenger recipient ID is required");
  }
  const activeIntegration = integration || (await integrationForCompany(companyId));
  const version = String(config.graphApiVersion || "v20.0").replace(/^v?/, "v");
  const response = await axios.post(
    `https://graph.facebook.com/${version}/me/messages`,
    {
      recipient: { id: recipientId },
      messaging_type: messagingType,
      ...(tag ? { tag } : {}),
      message: {
        text: String(text).slice(0, 2000),
        ...(suggestions.length ? {
          quick_replies: suggestions.slice(0, 13).map((suggestion, index) => ({
            content_type: "text",
            title: String(suggestion.label).slice(0, 20),
            payload: String(suggestion.message || suggestion.label || `choice_${index + 1}`).slice(0, 1000),
          })),
        } : {}),
      },
    },
    {
      headers: { Authorization: `Bearer ${activeIntegration.getPageAccessToken()}` },
      timeout: 20000,
    }
  );
  return response.data;
}

async function sendImage({ recipientId, imageUrl, integration }) {
  const version = String(config.graphApiVersion || "v20.0").replace(/^v?/, "v");
  const response = await axios.post(
    `https://graph.facebook.com/${version}/me/messages`,
    {
      recipient: { id: recipientId },
      messaging_type: "RESPONSE",
      message: { attachment: { type: "image", payload: { url: imageUrl, is_reusable: true } } },
    },
    {
      headers: { Authorization: `Bearer ${integration.getPageAccessToken()}` },
      timeout: 20000,
    }
  );
  return response.data;
}

async function replyToMessage(message) {
  const integration = await integrationForPage(message.pageId);
  const result = await processCustomerMessage({
    companyId: integration.companyId,
    sessionId: `messenger:${message.senderId}`,
    channel: "messenger",
    text: message.text,
    customer: { externalId: message.senderId },
  });
  const chunks = splitMessage(result.answer);
  const providerResults = [];
  for (let index = 0; index < chunks.length; index += 1) {
    providerResults.push(await sendText({
      recipientId: message.senderId,
      text: chunks[index],
      integration,
      suggestions: index === chunks.length - 1 ? (result.suggestions || []) : [],
    }));
  }
  const mediaResults = [];
  for (const media of (result.media || []).slice(0, 3)) {
    mediaResults.push(await sendImage({ recipientId: message.senderId, imageUrl: media.url, integration }));
  }
  return {
    answer: result.answer,
    conversationId: result.conversation?._id,
    orderId: result.order?._id,
    providerResult: providerResults.at(-1) || null,
    providerResults,
    media: result.media || [],
    mediaResults,
  };
}

async function validateIntegration(companyId) {
  const integration = await MessengerIntegration.findOne({ companyId, isActive: true })
    .select("+encryptedPageAccessToken +pageAccessTokenIv +pageAccessTokenAuthTag");
  if (!integration) throw new Error("Active Messenger integration not found");
  const version = String(config.graphApiVersion || "v20.0").replace(/^v?/, "v");
  const response = await axios.get(`https://graph.facebook.com/${version}/${integration.pageId}/subscribed_apps`, {
    headers: { Authorization: `Bearer ${integration.getPageAccessToken()}` },
    timeout: 20000,
  });
  const subscriptions = Array.isArray(response.data?.data) ? response.data.data : [];
  const appSubscription = subscriptions.find((item) => String(item.id) === String(config.metaAppId));
  if (!appSubscription) {
    const error = new Error("This Facebook Page is not subscribed to the Pentarix Messenger webhook. Reconnect the Page and try again.");
    error.status = 409;
    throw error;
  }
  const subscribedFields = Array.isArray(appSubscription.subscribed_fields)
    ? appSubscription.subscribed_fields
    : [];
  const requiredFields = ["messages", "messaging_postbacks"];
  const missingFields = requiredFields.filter((field) => !subscribedFields.includes(field));
  if (missingFields.length) {
    const error = new Error(`Messenger webhook subscription is missing: ${missingFields.join(", ")}. Reconnect the Page and try again.`);
    error.status = 409;
    throw error;
  }
  return {
    status: "valid",
    page: { id: integration.pageId, name: integration.pageName || integration.pageId },
    webhook: { subscribed: true, fields: subscribedFields },
  };
}

module.exports = { replyToMessage, sendImage, sendText, validateIntegration };
