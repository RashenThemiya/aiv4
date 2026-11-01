# API and Data Flow Reference

## Backend Public Health

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Backend and RAG health check |

## Admin and Company APIs

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/login` | Admin login |
| `GET` | `/api/auth/me` | Current admin profile |
| `POST` | `/api/companies` | Create company |
| `GET` | `/api/companies` | List companies |
| `GET` | `/api/companies/:id` | Get company |
| `PUT` | `/api/companies/:id` | Update company |
| `DELETE` | `/api/companies/:id` | Delete company |
| `POST` | `/api/companies/:id/widget-api-key` | Generate or rotate widget API key |

## Document APIs

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/companies/:id/documents` | Upload PDF and index it |
| `GET` | `/api/companies/:id/documents` | List company documents |
| `DELETE` | `/api/companies/:id/documents/:docId` | Delete document and vectors |
| `POST` | `/api/companies/:id/documents/:docId/reindex` | Re-index document |

## Chat APIs

### Admin/API Chat

```text
POST /api/companies/:id/chat
```

Example body:

```json
{
  "message": "How can I reset my password?",
  "sessionId": "optional-existing-session-id"
}
```

Example response:

```json
{
  "sessionId": "session-id",
  "answer": "Answer from company documents.",
  "sources": [
    {
      "documentId": "document-id",
      "documentName": "faq.pdf",
      "content": "Relevant source preview...",
      "score": 0.42
    }
  ],
  "conversationId": "conversation-id"
}
```

### Widget Chat

```text
POST /widget/companies/:companyId/chat
```

Required header:

```text
X-Widget-API-Key: PASTE_WIDGET_API_KEY
```

Example body:

```json
{
  "message": "Where can I find warranty information?",
  "sessionId": "web_abc123",
  "customerName": "Jane Customer",
  "customerEmail": "jane@example.com",
  "customerPhone": "+14165550123"
}
```

### Widget History

```text
GET /widget/companies/:companyId/chat/history/:sessionId
```

Required header:

```text
X-Widget-API-Key: PASTE_WIDGET_API_KEY
```

### Widget Authentication

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/widget/companies/:companyId/chat/auth/google` | Verify Google ID token |
| `POST` | `/widget/companies/:companyId/chat/auth/external` | Verify signed company website user token |

## RAG Service APIs

These are internal service APIs. The browser widget should not call them directly.

### Ingest Document

```text
POST /ingest
```

Example body:

```json
{
  "company_id": "company-id",
  "document_id": "document-id",
  "file_path": "uploads/company-id/faq.pdf",
  "document_name": "faq.pdf"
}
```

### Query Knowledge

```text
POST /query
```

Example body:

```json
{
  "company_id": "company-id",
  "question": "What is your refund policy?",
  "top_k": 5
}
```

Example response:

```json
{
  "answer": "Grounded answer from the uploaded documents.",
  "sources": [
    {
      "document_id": "document-id",
      "document_name": "policy.pdf",
      "content": "Short source preview...",
      "score": 0.31
    }
  ]
}
```

### Delete Document Vectors

```text
DELETE /documents
```

Example body:

```json
{
  "company_id": "company-id",
  "document_id": "document-id"
}
```

## Conversation Session IDs

| Channel | Pattern |
| --- | --- |
| Web guest | `web_guest_<uuid>` or current widget `web_<uuid>` |
| Web Google | `web_google_<hash>` |
| Web website-account | `web_external_<hash>` |
| WhatsApp | `whatsapp:<customerWaId>` |
| SMS | `sms:<customerPhoneNumber>` |
| Admin test | Provided session ID or generated session ID |

## Internal Chat Processing

```text
1. Validate company exists and is active.
2. Validate channel access.
3. Validate widget API key for widget routes.
4. Validate message is not empty.
5. Find or create conversation by companyId + sessionId.
6. Store user message.
7. Run message preprocessing.
8. If small talk, store and return direct reply.
9. If support question, call RAG service /query.
10. Map RAG sources to backend response format.
11. Store assistant message and sources.
12. Return answer, sources, sessionId, and conversationId.
```

## Error Cases to Handle in Clients

| Status | Example reason | Client behavior |
| --- | --- | --- |
| `400` | Missing message, invalid auth token | Show a short failure message |
| `401` | Invalid widget API key | Hide widget or show setup error |
| `403` | Inactive company | Show unavailable message |
| `404` | Company or conversation not found | Start new session or show unavailable message |
| `500` | RAG/OpenAI/server failure | Ask user to retry or contact support |

## Source Mapping

The RAG service returns source fields in snake case:

```json
{
  "document_id": "document-id",
  "document_name": "faq.pdf"
}
```

The backend maps them to camel case for widget/admin clients:

```json
{
  "documentId": "document-id",
  "documentName": "faq.pdf"
}
```
