function stripSourceCitations(value) {
  return String(value || "")
    .replace(/\s*\[Source(?:s)?\s+\d+(?:\s*[,;&]\s*\d+)*\]/gi, "")
    .replace(/[ \t]+([,.;:!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function supportDetails(company) {
  const assistant = company?.assistantSettings || {};
  return {
    business: String(company?.name || "the shop").trim(),
    phone: String(assistant.supportPhone || company?.shippingDetails?.phone || "").trim(),
    whatsapp: String(assistant.supportWhatsApp || "").trim(),
    hours: String(assistant.businessHours || "").trim(),
  };
}

function unknownAnswer(company, language = "en") {
  const { business, phone, whatsapp, hours } = supportDetails(company);
  const contacts = [];
  if (phone) contacts.push(language === "si" ? `දුරකථන: ${phone}` : language === "ta" ? `தொலைபேசி: ${phone}` : `Call: ${phone}`);
  if (whatsapp && whatsapp !== phone) contacts.push(`WhatsApp: ${whatsapp}`);
  if (hours) contacts.push(language === "si" ? `සේවා වේලාවන්: ${hours}` : language === "ta" ? `சேவை நேரம்: ${hours}` : `Business hours: ${hours}`);

  if (language === "si") {
    const base = "ඒ ගැන නිවැරදිව තහවුරු කළ තොරතුරු මට දැනට නැහැ, ඒ නිසා මිලක් හෝ ලබාගත හැකි බවක් අනුමාන කරන්න කැමති නැහැ.";
    return contacts.length
      ? `${base}\n\n${business} කණ්ඩායමෙන් තහවුරු කරගන්න:\n${contacts.join("\n")}`
      : `${base}\n\nඔබගේ ප්‍රශ්නය වෙළඳසැල් කණ්ඩායමට පරීක්ෂා කිරීමට සුරකින ලදී.`;
  }
  if (language === "ta") {
    const base = "அதைப் பற்றிய உறுதிப்படுத்தப்பட்ட தகவல் தற்போது என்னிடம் இல்லை. அதனால் விலை அல்லது கிடைப்பை ஊகிக்க விரும்பவில்லை.";
    return contacts.length
      ? `${base}\n\n${business} குழுவிடம் உறுதிப்படுத்த:\n${contacts.join("\n")}`
      : `${base}\n\nஉங்கள் கேள்வி கடை குழுவின் பார்வைக்காக சேமிக்கப்பட்டுள்ளது.`;
  }

  const base = "I don’t have confirmed information about that yet, so I don’t want to guess the price or availability.";
  return contacts.length
    ? `${base}\n\nYou can confirm it with the ${business} team:\n${contacts.join("\n")}`
    : `${base}\n\nI’ve saved your question so the shop team can review it.`;
}

function customerFacingAnswer(value) {
  return stripSourceCitations(value);
}

module.exports = {
  customerFacingAnswer,
  stripSourceCitations,
  supportDetails,
  unknownAnswer,
};
