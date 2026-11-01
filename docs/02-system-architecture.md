# System Architecture

## Architecture Diagram

```text
                         +----------------------+
                         | Company admin browser |
                         | React frontend        |
                         +----------+-----------+
                                    |
                                    | Admin API
                                    v
+------------------+      +---------+----------+       +-------------------+
| Company website  |----->| Node.js Express API |------>| MongoDB           |
| Embedded widget  |      | backend/            |       | System records    |
+------------------+      +---------+----------+       +-------------------+
                                    |
+------------------+                | RAG HTTP API
| WhatsApp user    |---- webhook ---+
+------------------+                v
                         +----------+-----------+       +-------------------+
+------------------+     | Python FastAPI RAG   |------>| ChromaDB          |
| SMS user         |---->| rag-service/         |       | Vector collections |
+------------------+     +----------+-----------+       +-------------------+
                                    |
                                    | Embeddings + chat completions
                                    v
                              +-----+------+
                              | OpenAI API |
                              +------------+
```

## Component Boundaries

### Frontend

The `frontend/` application has two roles:

- Admin dashboard for managing companies, documents, integrations, and chat history.
- Widget bundle generation through `npm run build:widget`.

The embeddable widget is loaded by a client company's website as a script. It reads `window.RAG_CHAT_WIDGET`, renders a floating chat launcher/panel, and sends customer messages to the backend widget API.

### Backend

The `backend/` Express API owns:

- Admin authentication and authorization.
- Company CRUD.
- Widget API key validation.
- Document upload lifecycle.
- Conversation persistence.
- Chat request orchestration.
- Google and external website-user token verification.
- WhatsApp and SMS integration APIs.
- WhatsApp and Twilio webhook handling.

The backend does not run vector search directly. It delegates ingestion and question answering to the Python RAG service.

### RAG Service

The `rag-service/` FastAPI service owns:

- PDF text extraction.
- Text chunking.
- Embedding generation.
- ChromaDB storage and retrieval.
- Grounded answer generation.

The service exposes:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Service health |
| `POST` | `/ingest` | Index one PDF document |
| `DELETE` | `/documents` | Delete vectors for one document |
| `POST` | `/query` | Retrieve relevant chunks and generate an answer |

## Main Data Stores

### MongoDB

MongoDB stores operational data:

- Companies.
- Admin users.
- Uploaded document metadata.
- Conversations and message history.
- WhatsApp integration credentials.
- SMS integration credentials.

Sensitive integration tokens are encrypted before storage where implemented by the integration modules.

### ChromaDB

ChromaDB stores vectors. Each company uses an isolated collection:

```text
company_{companyId}
```

Each chunk stores metadata such as:

- Company ID.
- Document ID.
- Document name.
- Chunk content.

## Request Lifecycles

### PDF Upload Lifecycle

```text
Admin frontend
  -> POST /api/companies/:id/documents
  -> Backend saves PDF and document metadata
  -> Backend calls RAG /ingest
  -> RAG extracts text and chunks it
  -> RAG embeds chunks and saves vectors
  -> Backend returns document status
```

### Widget Chat Lifecycle

```text
Website visitor
  -> Widget script
  -> POST /widget/companies/:companyId/chat
  -> Backend validates X-Widget-API-Key
  -> Backend finds or creates web conversation
  -> Backend preprocesses message
  -> Backend calls RAG /query when needed
  -> Backend stores assistant message
  -> Widget displays answer and sources
```

### WhatsApp Lifecycle

```text
WhatsApp customer
  -> Meta webhook
  -> POST /api/whatsapp/webhook
  -> Backend matches company by phone_number_id
  -> Backend uses session whatsapp:<customerWaId>
  -> Chat orchestration and RAG query
  -> Backend sends response through Meta Cloud API
```

### SMS Lifecycle

```text
SMS customer
  -> Twilio webhook
  -> POST /api/sms/webhook
  -> Backend matches company by Twilio To number
  -> Backend uses session sms:<customerPhoneNumber>
  -> Chat orchestration and RAG query
  -> Backend sends response through Twilio
```

## Deployment Shape

Recommended production deployment:

- Host `frontend/dist/` as the admin web application.
- Host `frontend/dist-widget/rag-chat-widget.iife.js` on HTTPS, preferably a CDN or static asset host.
- Deploy `backend/` as a public HTTPS API.
- Deploy `rag-service/` as a private service reachable by the backend.
- Use managed MongoDB or a secured MongoDB instance.
- Persist ChromaDB data on durable storage.
- Configure WhatsApp and Twilio webhooks to the public backend URL.

## Internal Trust Boundary

The backend should be public. The RAG service should be private when possible. Client websites and widgets should never call the RAG service directly because:

- The RAG service has no widget API-key validation.
- It accepts company IDs directly.
- It needs OpenAI access.
- The backend is responsible for auth, history, and channel-specific controls.
