const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const SupportTicket = require("../src/models/SupportTicket");

test("support tickets start open and retain the initial company message", async () => {
  const adminId = new mongoose.Types.ObjectId();
  const ticket = new SupportTicket({
    companyId: new mongoose.Types.ObjectId(),
    ticketNumber: "SUP-20261111-ABC123",
    subject: "Messenger replies are delayed",
    description: "Replies take more than one minute to appear.",
    priority: "high",
    createdBy: adminId,
    messages: [{
      authorId: adminId,
      authorName: "Company Admin",
      authorRole: "company_admin",
      message: "Replies take more than one minute to appear.",
    }],
  });

  await ticket.validate();
  assert.equal(ticket.status, "open");
  assert.equal(ticket.category, "technical");
  assert.equal(ticket.messages[0].isInternal, false);
});

test("support tickets allow private superadmin notes and attachment metadata", async () => {
  const adminId = new mongoose.Types.ObjectId();
  const ticket = new SupportTicket({
    companyId: new mongoose.Types.ObjectId(),
    ticketNumber: "SUP-20261111-DEF456",
    subject: "Review billing receipt",
    description: "The uploaded receipt needs review.",
    createdBy: adminId,
    messages: [{
      authorId: adminId,
      authorName: "Pentarix Support",
      authorRole: "superadmin",
      message: "Check the bank reference before replying.",
      isInternal: true,
      attachments: [{
        originalName: "receipt.pdf",
        storedName: "private-receipt.pdf",
        mimeType: "application/pdf",
        size: 2048,
        path: "support-attachments/private-receipt.pdf",
      }],
    }],
  });

  await ticket.validate();
  assert.equal(ticket.messages[0].isInternal, true);
  assert.equal(ticket.messages[0].attachments[0].mimeType, "application/pdf");
});
