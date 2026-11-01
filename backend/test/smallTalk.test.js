const test = require("node:test");
const assert = require("node:assert/strict");

const { getSmallTalkReply } = require("../src/services/smallTalk");
const { preprocessUserMessage } = require("../src/services/messagePreprocessor");

test("support statements are not interpreted as names", () => {
  assert.equal(getSmallTalkReply("I'm not sure"), null);
  assert.equal(
    getSmallTalkReply("I am concerned about extreme temperatures"),
    null
  );
});

test("real introductions are still recognized", () => {
  assert.match(getSmallTalkReply("My name is Nimal"), /Nimal/);
  assert.match(getSmallTalkReply("I am Nimal"), /Nimal/);
});

test("suggestion messages bypass all small-talk classification", async () => {
  const result = await preprocessUserMessage(
    "I am concerned about extreme temperatures.",
    { skipSmallTalk: true }
  );

  assert.deepEqual(result, {
    type: "support",
    question: "I am concerned about extreme temperatures.",
  });
});
