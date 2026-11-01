const mongoose = require("mongoose");

const smsMessageLogSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      default: null,
      index: true,
    },
    smsIntegrationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SmsIntegration",
      default: null,
      index: true,
    },
    direction: {
      type: String,
      enum: ["incoming", "outgoing"],
      required: true,
      index: true,
    },
    from: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    to: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    body: {
      type: String,
      default: "",
    },
    twilioMessageSid: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    status: {
      type: String,
      default: "received",
      index: true,
    },
    errorCode: {
      type: String,
      default: "",
    },
    errorMessage: {
      type: String,
      default: "",
    },
    rawPayload: {
      type: Object,
      default: {},
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.SmsMessageLog ||
  mongoose.model("SmsMessageLog", smsMessageLogSchema);