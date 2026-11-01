const crypto = require("crypto");
const config = require("../config");

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function sign(data) {
  return crypto.createHmac("sha256", config.jwtSecret).update(data).digest("base64url");
}

function createToken(user) {
  const header = base64url({ alg: "HS256", typ: "JWT" });
  const payload = base64url({
    sub: user._id.toString(),
    role: user.role,
    companyId: user.companyId?.toString() || null,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12,
  });
  const signature = sign(`${header}.${payload}`);
  return `${header}.${payload}.${signature}`;
}

function verifyToken(token) {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) return null;
  const expected = sign(`${header}.${payload}`);
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (data.exp && data.exp < Math.floor(Date.now() / 1000)) return null;
  return data;
}

module.exports = { createToken, verifyToken };
