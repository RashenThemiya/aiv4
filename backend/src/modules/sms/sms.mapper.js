function getMessageText(body) {
  return String(body?.Body || body?.body || "").trim();
}

function getUnsupportedFallback(body) {
  const mediaCount = Number(body?.NumMedia || 0);
  if (mediaCount > 0) return "Unsupported SMS message type. Please send a text SMS message.";
  return "Please send a text SMS message so I can help you.";
}

function mapIncomingWebhook(body) {
  const textBody = getMessageText(body);
  const mediaCount = Number(body?.NumMedia || 0);
  const isSupported = mediaCount === 0 && Boolean(textBody);
  return {
    senderPhoneNumber: body?.From || "",
    receiverPhoneNumber: body?.To || "",
    smsMessageId: body?.MessageSid || body?.SmsSid || "",
    accountSid: body?.AccountSid || "",
    messageType: mediaCount > 0 ? "mms" : "sms",
    textBody,
    isSupported,
    fallbackText: isSupported ? "" : getUnsupportedFallback(body),
    rawPayload: body || {},
  };
}

module.exports = { mapIncomingWebhook };
