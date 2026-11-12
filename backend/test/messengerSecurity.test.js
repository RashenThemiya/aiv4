const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const axios = require("axios");

const config = require("../src/config");
const metaOnboarding = require("../src/services/metaOnboarding");
const messengerController = require("../src/modules/messenger/messenger.controller");
const messengerService = require("../src/modules/messenger/messenger.service");
const MessengerIntegration = require("../src/models/MessengerIntegration");

function responseRecorder() {
  return {
    statusCode: 200,
    body: undefined,
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; },
    send(value) { this.body = value; return this; },
    sendStatus(value) { this.statusCode = value; return this; },
  };
}

test("Messenger authorization codes are exchanged only by the backend", async (t) => {
  const originalGet = axios.get;
  const previousAppId = config.metaAppId;
  const previousAppSecret = config.metaAppSecret;
  t.after(() => {
    axios.get = originalGet;
    config.metaAppId = previousAppId;
    config.metaAppSecret = previousAppSecret;
  });
  config.metaAppId = "test-app-id";
  config.metaAppSecret = "test-app-secret";
  let request;
  axios.get = async (url, options) => {
    request = { url, options };
    return { data: { access_token: "server-side-access-token" } };
  };

  const token = await metaOnboarding.exchangeAuthorizationCode("one-time-code");

  assert.equal(token, "server-side-access-token");
  assert.equal(request.url, "https://graph.facebook.com/oauth/access_token");
  assert.deepEqual(request.options.params, {
    client_id: "test-app-id",
    client_secret: "test-app-secret",
    code: "one-time-code",
  });
});

test("Messenger webhook verification accepts only the configured token", () => {
  const previousToken = config.messengerVerifyToken;
  config.messengerVerifyToken = "expected-token";
  try {
    const accepted = responseRecorder();
    messengerController.verifyWebhook({ query: {
      "hub.mode": "subscribe",
      "hub.verify_token": "expected-token",
      "hub.challenge": "challenge-value",
    } }, accepted);
    assert.equal(accepted.statusCode, 200);
    assert.equal(accepted.body, "challenge-value");

    const rejected = responseRecorder();
    messengerController.verifyWebhook({ query: {
      "hub.mode": "subscribe",
      "hub.verify_token": "wrong-token",
      "hub.challenge": "challenge-value",
    } }, rejected);
    assert.equal(rejected.statusCode, 403);
  } finally {
    config.messengerVerifyToken = previousToken;
  }
});

test("Messenger webhook POSTs require a valid Meta signature", async () => {
  const previousSecret = config.messengerAppSecret;
  config.messengerAppSecret = "test-app-secret";
  try {
    const rawBody = Buffer.from('{"object":"page","entry":[]}');
    const signature = crypto.createHmac("sha256", config.messengerAppSecret)
      .update(rawBody)
      .digest("hex");
    const accepted = responseRecorder();
    await messengerController.receiveWebhook({
      rawBody,
      body: { object: "page", entry: [] },
      headers: { "x-hub-signature-256": `sha256=${signature}` },
    }, accepted);
    assert.equal(accepted.statusCode, 200);

    const rejected = responseRecorder();
    await messengerController.receiveWebhook({
      rawBody,
      body: { object: "page", entry: [] },
      headers: { "x-hub-signature-256": `sha256=${"0".repeat(64)}` },
    }, rejected);
    assert.equal(rejected.statusCode, 403);
  } finally {
    config.messengerAppSecret = previousSecret;
  }
});

test("Messenger Page tokens are encrypted and excluded from safe responses", () => {
  const previousKey = config.messengerTokenEncryptionKey;
  config.messengerTokenEncryptionKey = "test-encryption-key-with-more-than-32-characters";
  try {
    const integration = new MessengerIntegration({
      companyId: "507f1f77bcf86cd799439011",
      pageId: "123456789",
    });
    integration.setPageAccessToken("sensitive-page-access-token");
    assert.notEqual(integration.encryptedPageAccessToken, "sensitive-page-access-token");
    assert.equal(integration.getPageAccessToken(), "sensitive-page-access-token");
    assert.equal(integration.toSafeJSON().pageAccessToken, undefined);
    assert.equal(integration.toSafeJSON().pageAccessTokenLast4, "oken");
  } finally {
    config.messengerTokenEncryptionKey = previousKey;
  }
});

test("Messenger validation checks the Page webhook subscription without reading Page metadata", async (t) => {
  const originalGet = axios.get;
  const originalFindOne = MessengerIntegration.findOne;
  const previousAppId = config.metaAppId;
  t.after(() => {
    axios.get = originalGet;
    MessengerIntegration.findOne = originalFindOne;
    config.metaAppId = previousAppId;
  });
  config.metaAppId = "pentarix-app-id";
  const integration = {
    pageId: "123456789",
    pageName: "Pentarix AI Assistant",
    getPageAccessToken: () => "encrypted-token-result",
  };
  MessengerIntegration.findOne = () => ({ select: async () => integration });
  let request;
  axios.get = async (url, options) => {
    request = { url, options };
    return { data: { data: [{
      id: "pentarix-app-id",
      subscribed_fields: ["messages", "messaging_postbacks"],
    }] } };
  };

  const result = await messengerService.validateIntegration("company-id");

  assert.match(request.url, /\/123456789\/subscribed_apps$/);
  assert.equal(request.options.params, undefined);
  assert.equal(result.status, "valid");
  assert.deepEqual(result.webhook.fields, ["messages", "messaging_postbacks"]);
});
