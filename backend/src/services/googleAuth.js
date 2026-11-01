const { OAuth2Client } = require("google-auth-library");
const config = require("../config");

const googleClient = new OAuth2Client();

async function verifyGoogleIdToken(credential) {
  if (!credential || typeof credential !== "string") {
    throw new Error("Google credential is required");
  }

  if (!config.googleClientIds || config.googleClientIds.length === 0) {
    throw new Error("GOOGLE_CLIENT_IDS is not configured");
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: config.googleClientIds,
  });

  const payload = ticket.getPayload();

  if (!payload?.sub) {
    throw new Error("Invalid Google token payload");
  }

  if (payload.email && payload.email_verified === false) {
    throw new Error("Google email is not verified");
  }

  return {
    googleSub: payload.sub,
    email: payload.email || "",
    name: payload.name || "",
    picture: payload.picture || "",
  };
}

module.exports = {
  verifyGoogleIdToken,
};
