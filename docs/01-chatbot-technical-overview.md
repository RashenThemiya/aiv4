# Chatbot Technical Overview

## Purpose

This system is a multi-tenant RAG chatbot for customer support. Each company uploads its own PDF knowledge-base documents. Customers then ask questions from a web widget, WhatsApp, SMS, or the admin test chat. The assistant answers only from that company's indexed documents.

## Main Capabilities

- Company-level isolation for documents, conversations, and vector search.
- PDF upload, parsing, chunking, embedding, and indexing.
- Web chat widget for third-party websites.
- Guest, Google, and website-account identity modes for the widget.
- WhatsApp Cloud API and Twilio SMS integrations.
- Conversation history stored in MongoDB.
- Source references returned with chatbot answers.
- Small-talk detection before RAG search.
- Query rewrite/correction before retrieval.

## Runtime Components

| Component | Location | Responsibility |
| --- | --- | --- |
| Admin frontend | `frontend/` | Company admin UI, document upload, integration management, widget setup |
| Web widget | `frontend/src/widget.js` and `frontend/dist-widget/` | Embeddable customer chat UI |
| Node API | `backend/` | Auth, companies, documents, conversations, public widget API, WhatsApp/SMS webhooks |
| RAG service | `rag-service/` | PDF extraction, embeddings, ChromaDB search, LLM response generation |
| MongoDB | External service | Companies, users, documents, conversations, integration settings |
| ChromaDB | `rag-service` persistence | Per-company vector collections |
| OpenAI | External API | Embeddings, RAG answer generation, query rewrite/classification |

## High-Level Chat Flow

```text
Customer message
  |
  v
Web widget / WhatsApp / SMS / Admin chat
  |
  v
Node.js backend
  |
  |-- validates company, channel, auth, widget API key, or webhook
  |-- loads or creates conversation session
  |-- stores user message
  |-- detects small talk and rewrites support questions
  |
  v
Python RAG service
  |
  |-- searches company-specific ChromaDB collection
  |-- builds context from retrieved chunks
  |-- asks OpenAI chat model for grounded answer
  |
  v
Node.js backend stores assistant response
  |
  v
Customer receives answer and sources
```

## Document Ingestion Flow

```text
Admin uploads PDF
  |
  v
Node.js backend saves file and document record
  |
  v
Node.js backend calls RAG service /ingest
  |
  v
RAG service extracts PDF text
  |
  v
Text is split into overlapping chunks
  |
  v
Chunks are embedded
  |
  v
Vectors are saved in company_{companyId} ChromaDB collection
```

## Answering Rules

The RAG service system prompt requires the assistant to:

- Answer only from the retrieved company document context.
- Avoid inventing unsupported information.
- Say it does not have the information when documents do not contain the answer.
- Avoid transactions such as orders, bookings, and payments.
- Keep answers clear and concise.
- Include troubleshooting steps in order when the source context contains them.

## Multi-Tenancy Model

Every company has separate business data and retrieval context.

| Data | Isolation method |
| --- | --- |
| Uploaded PDFs | Stored under the company document flow |
| Vector data | ChromaDB collection named `company_{companyId}` |
| Chat history | MongoDB query uses `companyId + sessionId` |
| Widget access | Company-specific widget API key |
| WhatsApp routing | Matched by Meta `phone_number_id` |
| SMS routing | Matched by Twilio destination phone number |

## Current Code Notes

- Widget public routes are mounted under `/widget/companies/:companyId/chat`.
- Admin/API chat routes are mounted under `/api/companies/:id/chat`.
- Widget requests require `X-Widget-API-Key`.
- The current widget source in `frontend/src/widget.js` implements a compact guest-style widget. The existing `frontend/WIDGET.md` describes a fuller login-capable widget flow. Keep implementation and documentation aligned when enabling Google or website-account login in the widget UI.
- The external website-login verifier expects `company.externalAuth` settings. The current `Company` schema should include these fields before website-account login is enabled in production.
