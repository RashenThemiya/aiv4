const GREETING =
  /^(hi+!?|hey+!?|hello+!?|howdy|good\s+(morning|evening|afternoon)|greetings|how\s+are\s+you)\s*$/i;
const THANKS = /^(thanks?|thank\s+you|thx|ty)\s*$/i;
const GOODBYE = /^(bye+!?|goodbye|see\s+you|see\s+ya|cya)\s*$/i;
const EXPLICIT_INTRODUCTION_PATTERNS = [
  /^(?:(?:(?:hi+|hey+|hello+|good\s+(?:morning|afternoon|evening))[,\s]+)+)?(?:my\s+name(?:\s+is)?\s+|this\s+is\s+)([a-z][a-z .'-]{0,49})$/i,
  /^([a-z][a-z .'-]{0,49}?)\s+is\s+my\s+name$/i,
  /^([a-z][a-z .'-]{0,49}?)\s+my\s+name$/i,
  /^(?:call\s+me|you\s+can\s+call\s+me)\s+([a-z][a-z .'-]{0,49})$/i,
];
const CASUAL_INTRODUCTION =
  /^(?:(?:(?:hi+|hey+|hello+)[,\s]+)+)?(?:i\s*am|i['’]?m|iam)\s+([a-z][a-z .'-]{0,49})$/i;
const NON_NAME_WORDS = new Set([
  "having", "looking", "trying", "using", "unable", "facing",
  "experiencing", "interested", "searching", "asking", "getting",
  "not", "concerned", "unsure", "sure", "ready", "here", "fine",
  "good", "okay", "ok", "wondering", "wanting", "planning", "installing",
  "connecting", "charging", "working", "seeking", "checking",
]);

function normalizeForMatch(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[!?.]+$/g, "")
    .replace(/\bgud\b|\bgd\b/g, "good")
    .replace(/\bmorn(?:in|ing)?\b|\bmoring\b|\bmrning\b/g, "morning")
    .replace(/\baft(?:ernoon)?\b/g, "afternoon")
    .replace(/\bevning\b|\bevenin\b/g, "evening")
    .replace(/\bhelo+\b|\bhllo\b/g, "hello")
    .replace(/\bhw\s+r\s+u\b|\bhow\s+r\s+u\b/g, "how are you")
    .replace(/\bthanx\b|\bthnks\b|\btnx\b/g, "thanks")
    .replace(/\bgudbye\b/g, "goodbye");
}

function looksLikePersonalName(value, maxWords) {
  const words = String(value || "").trim().split(/\s+/).filter(Boolean);
  return words.length > 0
    && words.length <= maxWords
    && words.every((word) => !NON_NAME_WORDS.has(word.toLowerCase()));
}

function getSmallTalkReply(message) {
  const text = normalizeForMatch(message);
  if (!text) return null;

  const explicitIntroduction = EXPLICIT_INTRODUCTION_PATTERNS
    .map((pattern) => text.match(pattern))
    .find(Boolean);
  const casualIntroduction = text.match(CASUAL_INTRODUCTION);
  const introduction = explicitIntroduction || casualIntroduction;
  const maxWords = explicitIntroduction ? 4 : 2;
  if (introduction && looksLikePersonalName(introduction[1], maxWords)) {
    const name = introduction[1].trim().replace(/\s+/g, " ");
    const displayName = name.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
    return `Nice to meet you, ${displayName}! How can I help you today?`;
  }

  if (GREETING.test(text)) {
    if (/^how\s+are\s+you/i.test(text)) {
      return "I'm doing well, thanks for asking! What can I help you with today?";
    }
    return "Hi there! What can I help you with today?";
  }

  if (THANKS.test(text)) {
    return "You're very welcome! Is there anything else you'd like help with?";
  }

  if (GOODBYE.test(text)) {
    return "Take care! I'm here whenever you need help.";
  }

  return null;
}

module.exports = { getSmallTalkReply };
