# Widget Integration Guide

## Goal

The web widget lets another website add the chatbot by loading one JavaScript file and configuring `window.RAG_CHAT_WIDGET`.

Use this when a company wants its customers to chat with the company's uploaded knowledge base directly from the company website.

## Required Values

Before embedding the widget, collect:

| Value | Where it comes from |
| --- | --- |
| Backend API URL | Deployed `backend/` URL, for example `https://api.example.com` |
| Widget script URL | Hosted `rag-chat-widget.iife.js` URL |
| Company ID | Created in the admin dashboard/API |
| Widget API key | Generated for that company |
| Google Client ID | Optional, only for Google login |
| External auth secret | Optional, only for website-account login |

## Basic Guest Widget Embed

Paste this before the closing `</body>` tag on the company website.

```html
<script>
  window.RAG_CHAT_WIDGET = {
    apiBaseUrl: "https://api.example.com",
    companyId: "PASTE_COMPANY_ID",
    apiKey: "PASTE_WIDGET_API_KEY",
    title: "Support Chat",
    subtitle: "Ask from our knowledge base",
    accentColor: "#111827",
    position: "right"
  };
</script>
<script src="https://cdn.example.com/rag-chat-widget.iife.js"></script>
```

The widget sends chat messages to:

```text
POST https://api.example.com/widget/companies/{companyId}/chat
```

with:

```text
X-Widget-API-Key: PASTE_WIDGET_API_KEY
```

## Build and Host the Widget

From `frontend/`:

```powershell
npm.cmd run build:widget
```

Build output:

```text
frontend/dist-widget/rag-chat-widget.iife.js
```

Host this file publicly over HTTPS. The company website can then reference it with a normal `<script src="..."></script>` tag.

## Widget Configuration

| Option | Required | Example | Description |
| --- | --- | --- | --- |
| `apiBaseUrl` | Yes | `https://api.example.com` | Public backend API URL |
| `companyId` | Yes | `66...abc` | Company MongoDB ID |
| `apiKey` | Yes | `rwk_...` | Widget API key generated for the company |
| `title` | No | `Support Chat` | Header title |
| `subtitle` | No | `Ask from our knowledge base` | Header subtitle |
| `accentColor` | No | `#111827` | Main widget color |
| `position` | No | `right` or `left` | Floating launcher position |
| `customerName` | No | `Jane Customer` | Optional customer metadata |
| `customerEmail` | No | `jane@example.com` | Optional customer metadata |
| `customerPhone` | No | `+14165550123` | Optional customer metadata |

## Current Guest Session Behavior

The current widget source creates a browser-local session ID:

```text
rag_widget_session_{companyId}
```

The generated value is stored in `localStorage`, so the same browser can continue the same conversation.

Current source format:

```text
web_{uuid}
```

The backend also supports guest-style session IDs beginning with:

```text
web_guest_
web_
```

## Loading Chat History

The backend exposes:

```text
GET /widget/companies/:companyId/chat/history/:sessionId
```

The current widget implementation does not automatically load history on startup. To show previous messages after reload, extend the widget to call this endpoint after it creates or reads the session ID.

Expected request header:

```text
X-Widget-API-Key: PASTE_WIDGET_API_KEY
```

## Website-Account Login

Use website-account login when the company website already has customer accounts and wants chat history to follow that logged-in user across browsers/devices.

Intended flow:

```text
Customer logs into company website
  -> Widget calls company website endpoint, such as /api/chatbot-user-token
  -> Company website backend returns signed token
  -> Widget sends token to chatbot backend
  -> Backend verifies token
  -> Backend creates web_external_<hash> session ID
  -> Widget uses that session for chat and history
```

The company website endpoint should return:

```json
{
  "token": "SIGNED_CHATBOT_USER_TOKEN"
}
```

The token should be signed server-side. Never put the external auth secret in browser JavaScript.

Example token payload:

```json
{
  "sub": "company-user-id-123",
  "name": "Customer Name",
  "email": "customer@example.com",
  "phone": "+14165550123",
  "iss": "company-website",
  "aud": "rag-chat-widget",
  "exp": 1893456000
}
```

Backend endpoint:

```text
POST /widget/companies/:companyId/chat/auth/external
```

Important implementation note: `backend/src/services/externalUserAuth.js` expects `company.externalAuth.enabled`, `company.externalAuth.tokenSecret`, and optional issuer/audience settings. The current `Company` model should be extended to store these settings before enabling website-account login.

## Google Login

Use Google login when customers do not have website accounts but still need portable saved history.

Intended flow:

```text
Customer clicks Google login
  -> Google returns ID token
  -> Widget sends ID token to backend
  -> Backend verifies token against GOOGLE_CLIENT_IDS
  -> Backend creates web_google_<hash> session ID
  -> Widget uses that session for chat and history
```

Required backend environment variable:

```env
GOOGLE_CLIENT_IDS=PASTE_GOOGLE_CLIENT_ID
```

Backend endpoint:

```text
POST /widget/companies/:companyId/chat/auth/google
```

## Production Checklist

- Use HTTPS for backend and widget script.
- Generate a unique widget API key per company.
- Do not expose admin JWTs, OpenAI keys, external auth secrets, WhatsApp tokens, or Twilio tokens in the website.
- Configure CORS for allowed production domains if the backend is hardened beyond the current permissive development setup.
- Test guest chat, refresh behavior, and conversation visibility in the admin dashboard.
- If using website-account login, test expired tokens, invalid signatures, issuer mismatch, and audience mismatch.
