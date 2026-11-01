const express = require("express");

const Company = require("../models/Company");
const SmsIntegration = require("../models/SmsIntegration");
const smsService = require("../modules/sms/sms.service");

const router = express.Router({ mergeParams: true });

async function ensureCompany(companyId) {
  const company = await Company.findById(companyId);
  if (!company) {
    const err = new Error("Company not found");
    err.status = 404;
    throw err;
  }
  return company;
}

async function findIntegration(companyId, includeSecret = false) {
  const query = SmsIntegration.findOne({ companyId });
  if (includeSecret) query.select("+encryptedAuthToken +authTokenIv +authTokenAuthTag");
  return query;
}

function getSmsPayload(body) {
  return {
    accountSid: body.accountSid || body.TWILIO_ACCOUNT_SID,
    authToken: body.authToken || body.TWILIO_AUTH_TOKEN,
    phoneNumber: body.phoneNumber || body.TWILIO_PHONE_NUMBER,
    isActive: body.isActive,
  };
}

router.post("/", async (req, res) => {
  try {
    await ensureCompany(req.params.companyId);
    const { accountSid, authToken, phoneNumber, isActive } = getSmsPayload(req.body);
    if (!accountSid || !String(accountSid).trim()) return res.status(400).json({ error: "Twilio Account SID is required" });
    if (!authToken || !String(authToken).trim()) return res.status(400).json({ error: "Twilio Auth Token is required" });
    if (!phoneNumber || !String(phoneNumber).trim()) return res.status(400).json({ error: "Twilio phone number is required" });

    const existingPhoneOwner = await SmsIntegration.findOne({ phoneNumber: String(phoneNumber).trim(), companyId: { $ne: req.params.companyId } });
    if (existingPhoneOwner) return res.status(409).json({ error: "Twilio phone number is already configured" });

    let integration = await findIntegration(req.params.companyId, true);
    const statusCode = integration ? 200 : 201;
    if (!integration) integration = new SmsIntegration({ companyId: req.params.companyId });

    integration.accountSid = String(accountSid).trim();
    integration.phoneNumber = String(phoneNumber).trim();
    integration.isActive = typeof isActive === "boolean" ? isActive : integration.isActive;
    integration.setAuthToken(authToken);
    await integration.save();
    res.status(statusCode).json(integration.toSafeJSON());
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get("/", async (req, res) => {
  try {
    await ensureCompany(req.params.companyId);
    const integration = await findIntegration(req.params.companyId);
    if (!integration) return res.status(404).json({ error: "SMS integration not found" });
    res.json(integration.toSafeJSON());
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post("/validate", async (req, res) => {
  try {
    await ensureCompany(req.params.companyId);
    const result = await smsService.validateIntegration({ companyId: req.params.companyId });
    res.json(result);
  } catch (err) {
    res.status(err.status || err.statusCode || 500).json({
      status: "invalid",
      error: err.message,
      companyId: err.smsContext?.companyId,
      accountSid: err.smsContext?.accountSid,
      phoneNumber: err.smsContext?.phoneNumber,
      authTokenLast4: err.smsContext?.authTokenLast4,
      code: err.code,
      moreInfo: err.moreInfo,
    });
  }
});

router.put("/", async (req, res) => {
  try {
    await ensureCompany(req.params.companyId);
    const integration = await findIntegration(req.params.companyId, true);
    if (!integration) return res.status(404).json({ error: "SMS integration not found" });
    const { accountSid, authToken, phoneNumber, isActive } = getSmsPayload(req.body);
    if (!accountSid && !authToken && !phoneNumber && typeof isActive !== "boolean") return res.status(400).json({ error: "At least one SMS integration field is required" });

    if (phoneNumber && String(phoneNumber).trim() !== integration.phoneNumber) {
      const existingPhoneOwner = await SmsIntegration.findOne({ phoneNumber: String(phoneNumber).trim(), companyId: { $ne: req.params.companyId } });
      if (existingPhoneOwner) return res.status(409).json({ error: "Twilio phone number is already configured" });
      integration.phoneNumber = String(phoneNumber).trim();
    }
    if (accountSid) integration.accountSid = String(accountSid).trim();
    if (typeof isActive === "boolean") integration.isActive = isActive;
    if (authToken) integration.setAuthToken(authToken);
    await integration.save();
    res.json(integration.toSafeJSON());
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.delete("/", async (req, res) => {
  try {
    await ensureCompany(req.params.companyId);
    const integration = await findIntegration(req.params.companyId);
    if (!integration) return res.status(404).json({ error: "SMS integration not found" });
    await SmsIntegration.deleteOne({ _id: integration._id });
    res.json({ status: "deleted" });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
