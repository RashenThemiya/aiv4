const crypto = require("crypto");
const mongoose = require("mongoose");

const config = require("../config");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

function getEncryptionKey() {
  if (!config.smsTokenEncryptionKey) {
    throw new Error("Missing SMS token encryption key");
  }
  return crypto.scryptSync(config.smsTokenEncryptionKey, "sms-auth-token", KEY_LENGTH);
}

function encryptToken(token) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(token), "utf8"), cipher.final()]);
  return {
    encryptedAuthToken: encrypted.toString("base64"),
    authTokenIv: iv.toString("base64"),
    authTokenAuthTag: cipher.getAuthTag().toString("base64"),
    authTokenLast4: String(token).slice(-4),
  };
}

function decryptToken({ encryptedAuthToken, authTokenIv, authTokenAuthTag }) {
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), Buffer.from(authTokenIv, "base64"));
  decipher.setAuthTag(Buffer.from(authTokenAuthTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedAuthToken, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

const smsIntegrationSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, unique: true, index: true },
    accountSid: { type: String, required: true, trim: true, index: true },
    phoneNumber: { type: String, required: true, unique: true, trim: true, index: true },
    phoneNumberSid: { type: String, default: "", trim: true },
    encryptedAuthToken: { type: String, required: true, select: false },
    authTokenIv: { type: String, required: true, select: false },
    authTokenAuthTag: { type: String, required: true, select: false },
    authTokenLast4: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

smsIntegrationSchema.methods.setAuthToken = function setAuthToken(token) {
  if (!token || !String(token).trim()) throw new Error("Twilio Auth Token is required");
  Object.assign(this, encryptToken(String(token).trim()));
};

smsIntegrationSchema.methods.getAuthToken = function getAuthToken() {
  return decryptToken(this);
};

smsIntegrationSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    _id: this._id,
    companyId: this.companyId,
    accountSid: this.accountSid,
    phoneNumber: this.phoneNumber,
    phoneNumberSid: this.phoneNumberSid,
    authTokenLast4: this.authTokenLast4,
    hasAuthToken: Boolean(this.encryptedAuthToken || this.authTokenLast4),
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports =
  mongoose.models.SmsIntegration ||
  mongoose.model("SmsIntegration", smsIntegrationSchema);