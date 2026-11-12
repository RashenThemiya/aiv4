const crypto = require("crypto");

const config = require("../config");
const Conversation = require("../models/Conversation");
const { sendTextMessage: sendWhatsAppText, sendOrderTrackingTemplate } = require("../modules/whatsapp/whatsapp.service");
const { sendText: sendMessengerText } = require("../modules/messenger/messenger.service");
const { sendTextMessage: sendSmsText } = require("../modules/sms/sms.service");

function trackingSignature(order) {
  return crypto.createHash("sha256").update(JSON.stringify({
    orderNumber: order.orderNumber,
    courierName: order.tracking?.courierName || "",
    trackingId: order.tracking?.trackingId || "",
    trackingUrl: order.tracking?.trackingUrl || "",
  })).digest("hex");
}

function trackingMessage(order) {
  const language = order.language || "en";
  const courier = order.tracking?.courierName || "the delivery service";
  const lines = language === "si"
    ? [`ඔබගේ ${order.orderNumber} ඇණවුම බෙදාහැරීම සඳහා ${courier} වෙත භාරදී ඇත.`]
    : language === "ta"
      ? [`உங்கள் ${order.orderNumber} ஆர்டர் விநியோகத்திற்காக ${courier} நிறுவனத்திடம் ஒப்படைக்கப்பட்டுள்ளது.`]
      : [`Your order ${order.orderNumber} has been handed over to ${courier} for delivery.`];

  if (order.tracking?.trackingId) {
    lines.push(language === "si"
      ? `ලුහුබැඳීමේ අංකය: ${order.tracking.trackingId}`
      : language === "ta"
        ? `கண்காணிப்பு எண்: ${order.tracking.trackingId}`
        : `Tracking ID: ${order.tracking.trackingId}`);
  }
  if (order.tracking?.trackingUrl) {
    lines.push(language === "si"
      ? `ඔබගේ පාර්සලය ලුහුබඳින්න: ${order.tracking.trackingUrl}`
      : language === "ta"
        ? `உங்கள் பார்சலைக் கண்காணிக்க: ${order.tracking.trackingUrl}`
        : `Track your parcel: ${order.tracking.trackingUrl}`);
  }
  return lines.join("\n");
}

function recipientFromSession(order, prefix) {
  const sessionId = String(order.sessionId || "");
  return sessionId.startsWith(prefix) ? sessionId.slice(prefix.length) : "";
}

function providerMessageId(result) {
  return String(
    result?.messages?.[0]?.id
    || result?.message_id
    || result?.recipient_id
    || result?.sid
    || ""
  );
}

async function sendToOrderChannel(order, message) {
  if (order.channel === "whatsapp") {
    const to = order.customer?.externalId
      || recipientFromSession(order, "whatsapp:")
      || order.customer?.phone;
    if (!to) throw new Error("The order does not contain a WhatsApp recipient number");
    const result = config.whatsappTrackingTemplateName
      ? await sendOrderTrackingTemplate({
        to,
        companyId: order.companyId,
        orderNumber: order.orderNumber,
        courierName: order.tracking?.courierName || "-",
        trackingId: order.tracking?.trackingId || "-",
        trackingUrl: order.tracking?.trackingUrl || "-",
      })
      : await sendWhatsAppText({ to, text: message, companyId: order.companyId });
    return { messageId: providerMessageId(result) };
  }

  if (order.channel === "messenger") {
    const recipientId = order.customer?.externalId || recipientFromSession(order, "messenger:");
    if (!recipientId) throw new Error("The order does not contain a Messenger recipient ID");
    const result = await sendMessengerText({
      recipientId,
      text: message,
      companyId: order.companyId,
      messagingType: "MESSAGE_TAG",
      tag: "POST_PURCHASE_UPDATE",
    });
    return { messageId: providerMessageId(result) };
  }

  if (order.channel === "sms") {
    const to = order.customer?.phone || recipientFromSession(order, "sms:");
    if (!to) throw new Error("The order does not contain a customer phone number");
    const result = await sendSmsText({
      to,
      text: message,
      companyId: order.companyId,
      conversationId: order.conversationId,
    });
    return { messageId: providerMessageId(result) };
  }

  if (order.channel === "web") {
    const conversation = order.conversationId
      ? await Conversation.findOne({ _id: order.conversationId, companyId: order.companyId })
      : await Conversation.findOne({ companyId: order.companyId, sessionId: order.sessionId });
    if (!conversation) throw new Error("The website conversation for this order could not be found");
    conversation.messages.push({ role: "assistant", content: message });
    await conversation.save();
    return { messageId: conversation._id.toString() };
  }

  throw new Error(`Automatic tracking notifications are not supported for channel: ${order.channel}`);
}

async function recordTrackingInConversation(order, message) {
  if (order.channel === "web") return;
  const conversation = order.conversationId
    ? await Conversation.findOne({ _id: order.conversationId, companyId: order.companyId })
    : await Conversation.findOne({ companyId: order.companyId, sessionId: order.sessionId });
  if (!conversation) return;
  const lastMessage = conversation.messages.at(-1);
  if (lastMessage?.role === "assistant" && lastMessage.content === message) return;
  conversation.messages.push({ role: "assistant", content: message });
  await conversation.save();
}

function eligibleForTrackingNotification(order) {
  const hasTracking = Boolean(order.tracking?.trackingId || order.tracking?.trackingUrl);
  return hasTracking && ["shipped", "delivered"].includes(order.status);
}

async function notifyOrderTracking(order, { force = false } = {}) {
  if (!eligibleForTrackingNotification(order)) {
    return { attempted: false, status: order.tracking?.notification?.status || "not_sent" };
  }

  const signature = trackingSignature(order);
  const previous = order.tracking?.notification || {};
  if (!force && previous.status === "sent" && previous.signature === signature) {
    return { attempted: false, status: "sent", duplicate: true };
  }
  if (!force && previous.status === "failed" && previous.signature === signature) {
    return { attempted: false, status: "failed", requiresRetry: true };
  }

  const attemptedAt = new Date();
  order.tracking.notification = {
    ...previous,
    status: "pending",
    channel: order.channel,
    signature,
    attemptedAt,
    lastError: "",
  };
  await order.save();

  const message = trackingMessage(order);
  try {
    const result = await sendToOrderChannel(order, message);
    try {
      await recordTrackingInConversation(order, message);
    } catch (historyError) {
      console.warn("Tracking notification was sent but could not be added to conversation history:", historyError.message);
    }
    order.tracking.notification = {
      status: "sent",
      channel: order.channel,
      signature,
      attemptedAt,
      sentAt: new Date(),
      messageId: result.messageId || "",
      lastError: "",
    };
    await order.save();
    return { attempted: true, status: "sent", message };
  } catch (error) {
    order.tracking.notification = {
      status: "failed",
      channel: order.channel,
      signature,
      attemptedAt,
      sentAt: null,
      messageId: "",
      lastError: String(error.response?.data?.error?.message || error.message || "Notification failed").slice(0, 1000),
    };
    await order.save();
    return {
      attempted: true,
      status: "failed",
      error: order.tracking.notification.lastError,
    };
  }
}

module.exports = {
  eligibleForTrackingNotification,
  notifyOrderTracking,
  trackingMessage,
};
