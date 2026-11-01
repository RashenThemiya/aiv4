const crypto = require("crypto");

function base64UrlDecode(value) {
  let normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");

  while (normalized.length % 4) {
    normalized += "=";
  }

  return Buffer.from(normalized, "base64").toString("utf8");
}

function base64UrlEncode(buffer) {
  return Buffer.from(buffer)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function safeCompare(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));

  if (left.length !== right.length) return false;

  return crypto.timingSafeEqual(left, right);
}

function verifyExternalUserToken(token, company) {
  if (!token || typeof token !== "string") {
    throw new Error("External user token is required");
  }

  if (!company.externalAuth?.enabled) {
    throw new Error("Company user login is not enabled for this company");
  }

  const secret = company.externalAuth?.tokenSecret;

  if (!secret) {
    throw new Error("Company external auth secret is not configured");
  }

  const parts = token.split(".");

  if (parts.length !== 3) {
    throw new Error("Invalid external user token");
  }

  const [encodedHeader, encodedPayload, signature] = parts;

  const header = JSON.parse(base64UrlDecode(encodedHeader));
  const payload = JSON.parse(base64UrlDecode(encodedPayload));

  if (header.alg !== "HS256") {
    throw new Error("Only HS256 external user tokens are supported");
  }

  const expectedSignature = base64UrlEncode(
    crypto
      .createHmac("sha256", secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest()
  );

  if (!safeCompare(signature, expectedSignature)) {
    throw new Error("Invalid external user token signature");
  }

  const now = Math.floor(Date.now() / 1000);

  if (payload.exp && payload.exp < now) {
    throw new Error("External user token has expired");
  }

  if (company.externalAuth.tokenIssuer && payload.iss !== company.externalAuth.tokenIssuer) {
    throw new Error("Invalid external user token issuer");
  }

  if (company.externalAuth.tokenAudience && payload.aud !== company.externalAuth.tokenAudience) {
    throw new Error("Invalid external user token audience");
  }

  const externalUserId = payload.sub || payload.userId || payload.id;

  if (!externalUserId) {
    throw new Error("External user token must include sub, userId, or id");
  }

  return {
    externalUserId: String(externalUserId),
    name: payload.name || "",
    email: payload.email || "",
    phone: payload.phone || "",
  };
}

module.exports = {
  verifyExternalUserToken,
};
