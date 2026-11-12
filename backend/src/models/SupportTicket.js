const mongoose = require("mongoose");

const attachmentSchema = new mongoose.Schema({
  originalName: { type: String, required: true, trim: true },
  storedName: { type: String, required: true, trim: true },
  mimeType: { type: String, required: true, trim: true },
  size: { type: Number, required: true, min: 0 },
  path: { type: String, required: true },
}, { timestamps: true });

const messageSchema = new mongoose.Schema({
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", required: true },
  authorName: { type: String, required: true, trim: true },
  authorRole: { type: String, enum: ["superadmin", "company_admin"], required: true },
  message: { type: String, default: "", trim: true, maxlength: 5000 },
  isInternal: { type: Boolean, default: false },
  attachments: { type: [attachmentSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

const supportTicketSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  ticketNumber: { type: String, required: true, unique: true, index: true },
  subject: { type: String, required: true, trim: true, maxlength: 180 },
  category: {
    type: String,
    enum: ["technical", "billing", "integration", "account", "feature", "other"],
    default: "technical",
    index: true,
  },
  description: { type: String, required: true, trim: true, maxlength: 5000 },
  priority: { type: String, enum: ["low", "normal", "high", "urgent"], default: "normal", index: true },
  status: {
    type: String,
    enum: ["open", "in_progress", "waiting", "resolved", "closed"],
    default: "open",
    index: true,
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", required: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", default: null, index: true },
  messages: { type: [messageSchema], default: [] },
  messageCount: { type: Number, default: 1, min: 0 },
  attachmentCount: { type: Number, default: 0, min: 0 },
  publicMessageCount: { type: Number, default: 1, min: 0 },
  publicAttachmentCount: { type: Number, default: 0, min: 0 },
  lastActivityAt: { type: Date, default: Date.now, index: true },
  firstResponseAt: { type: Date, default: null },
  resolvedAt: { type: Date, default: null },
  closedAt: { type: Date, default: null },
}, { timestamps: true });

supportTicketSchema.index({ companyId: 1, createdAt: -1 });
supportTicketSchema.index({ status: 1, priority: 1, lastActivityAt: -1 });
supportTicketSchema.index({ assignedTo: 1, status: 1, lastActivityAt: -1 });

module.exports = mongoose.models.SupportTicket || mongoose.model("SupportTicket", supportTicketSchema);
