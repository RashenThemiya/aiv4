const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://botbackend.pentarixlabs.com";

let authToken = localStorage.getItem("rag_admin_token") || "";

export function setAuthToken(token) {
  authToken = token || "";
  if (authToken) localStorage.setItem("rag_admin_token", authToken);
  else localStorage.removeItem("rag_admin_token");
}

export function getAuthToken() {
  return authToken;
}

function friendlyErrorMessage({ status = 0, data = {}, path = "", cause = null }) {
  const technical = String(
    data?.detail || data?.error || cause?.message || ""
  ).toLowerCase();
  const isDocumentRequest = path.includes("/documents");

  if (!status || technical.includes("failed to fetch") || technical.includes("networkerror")) {
    return "We couldn't connect to the service. Check your internet connection and try again.";
  }
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You don't have permission to perform this action.";
  if (status === 404) return "The requested item could not be found. Refresh the page and try again.";
  if (status === 409) {
    if (data?.code === "INSUFFICIENT_CREDITS_FOR_REVERSAL") {
      return "This company has already used some of the allocated credits. The full allocation cannot be reversed.";
    }
    if (data?.code === "ALLOCATION_ALREADY_REVERSED") {
      return "This credit allocation has already been reversed.";
    }
    return data?.duplicate
      ? "This PDF is already in the knowledge base, so it was not uploaded again."
      : "This change conflicts with existing data. Refresh the page and try again.";
  }
  if (status === 413 || technical.includes("file too large")) {
    return "This file is too large. Choose a PDF smaller than 20 MB and try again.";
  }
  if (technical.includes("monthly ai usage allowance")) {
    return "This business has reached its monthly AI allowance. Ask the account administrator to increase the limit.";
  }
  if (status === 402 || technical.includes("prepaid ai credit balance")) {
    return "This business has no available AI credits. Ask the account administrator to add a credit package.";
  }
  if (status === 429 || technical.includes("rate limit") || technical.includes("quota")) {
    return "The AI service is temporarily busy or has reached its usage limit. Please wait a few minutes and try again.";
  }
  if (technical.includes("only pdf")) return "That file is not a PDF. Please choose a PDF document.";
  if (technical.includes("no extractable text")) {
    return "We couldn't read usable text from this PDF. Try a searchable PDF or a clearer scanned copy.";
  }
  if (technical.includes("pdf file missing") || technical.includes("file not found")) {
    return "The stored PDF file is missing. Delete this entry and upload the document again.";
  }
  if (technical.includes("openai_api_key") || technical.includes("service key")) {
    return "The knowledge service is not fully configured. Ask an administrator to check the AI service settings.";
  }
  if (technical.includes("timeout") || technical.includes("timed out") || status === 504) {
    return isDocumentRequest
      ? "This PDF is taking too long to process. Try a smaller PDF or split it into sections."
      : "The request took too long. Please try again.";
  }
  if (isDocumentRequest && status >= 500) {
    return "We couldn't process this PDF. The file may be too complex or the knowledge service may be temporarily unavailable. Try again, or upload a smaller section.";
  }
  if (status === 502 || status === 503) {
    return "A required service is temporarily unavailable. Please wait a moment and try again.";
  }
  if (status >= 500) return "Something went wrong on our side. Please try again shortly.";
  if (status === 400) return "Some information is missing or invalid. Check the form and try again.";
  return "We couldn't complete that request. Please try again.";
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  } catch (cause) {
    const error = new Error(friendlyErrorMessage({ path, cause }));
    error.status = 0;
    error.path = path;
    error.technicalMessage = cause?.message || "Network request failed";
    throw error;
  }
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const error = new Error(friendlyErrorMessage({ status: response.status, data, path }));
    error.status = response.status;
    error.data = data;
    error.path = path;
    error.technicalMessage = typeof data === "string"
      ? data
      : data.detail || data.error || `HTTP ${response.status}`;
    throw error;
  }

  return data;
}

async function download(path) {
  const headers = new Headers();
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
  const response = await fetch(`${API_BASE_URL}${path}`, { headers });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(friendlyErrorMessage({ status: response.status, data, path }));
  }
  return response.blob();
}

async function downloadToFile(path, fileHandle, onProgress) {
  const headers = new Headers();
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
  const response = await fetch(`${API_BASE_URL}${path}`, { headers, cache: "no-store" });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(friendlyErrorMessage({ status: response.status, data, path }));
  }
  if (!response.body) throw new Error("Streaming downloads are not supported by this browser");

  const writable = await fileHandle.createWritable();
  const reader = response.body.getReader();
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await writable.write(value);
      received += value.byteLength;
      onProgress?.(received);
    }
    await writable.close();
  } catch (error) {
    await writable.abort().catch(() => {});
    throw error;
  }
  return received;
}

export const api = {
  baseUrl: API_BASE_URL,
  auth: {
    login: (payload) =>
      request("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    me: () => request("/api/auth/me"),
  },
  adminUsers: {
    list: () => request("/api/admin-users"),
    create: (payload) =>
      request("/api/admin-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    update: (id, payload) =>
      request(`/api/admin-users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    remove: (id) => request(`/api/admin-users/${id}`, { method: "DELETE" }),
  },
  backups: {
    download: () => download("/api/backups/download"),
    downloadToFile: (fileHandle, onProgress) =>
      downloadToFile("/api/backups/download", fileHandle, onProgress),
    status: () => request("/api/backups/restore-status", { cache: "no-store" }),
    restore: (file, confirmation) => {
      const formData = new FormData();
      formData.append("backup", file);
      formData.append("confirm", confirmation);
      return request("/api/backups/restore", { method: "POST", body: formData });
    },
  },
  analytics: {
    platform: () => request("/api/analytics/platform"),
    usage: (filters = {}) => {
      const query = new URLSearchParams(
        Object.entries(filters).filter(([, value]) => value !== "" && value !== undefined)
      );
      return request(`/api/analytics/usage?${query}`);
    },
    usageReport: (filters = {}) => {
      const query = new URLSearchParams(
        Object.entries(filters).filter(([, value]) => value !== "" && value !== undefined)
      );
      return download(`/api/analytics/usage/export?${query}`);
    },
  },
  support: {
    assignees: () => request("/api/support/assignees"),
    summary: (filters = {}) => {
      const query = new URLSearchParams(
        Object.entries(filters).filter(([, value]) => value !== "" && value !== undefined)
      );
      return request(`/api/support/summary?${query}`);
    },
    tickets: (filters = {}) => {
      const query = new URLSearchParams(
        Object.entries(filters).filter(([, value]) => value !== "" && value !== undefined)
      );
      return request(`/api/support/tickets?${query}`);
    },
    ticket: (id) => request(`/api/support/tickets/${id}`),
    createTicket: (payload) => {
      const form = new FormData();
      form.append("companyId", payload.companyId || "");
      form.append("subject", payload.subject || "");
      form.append("description", payload.description || "");
      form.append("category", payload.category || "technical");
      form.append("priority", payload.priority || "normal");
      for (const file of payload.attachments || []) form.append("attachments", file);
      return request("/api/support/tickets", { method: "POST", body: form });
    },
    reply: (id, payload) => {
      const form = new FormData();
      form.append("message", payload.message || "");
      form.append("isInternal", payload.isInternal ? "true" : "false");
      for (const file of payload.attachments || []) form.append("attachments", file);
      return request(`/api/support/tickets/${id}/replies`, { method: "POST", body: form });
    },
    update: (id, payload) => request(`/api/support/tickets/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    }),
    attachment: (ticketId, attachmentId) => download(`/api/support/tickets/${ticketId}/attachments/${attachmentId}`),
  },
  billing: {
    plans: () => request("/api/billing/plans"),
    createPlan: (payload) => request("/api/billing/plans", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    }),
    updatePlan: (id, payload) => request(`/api/billing/plans/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    }),
    deletePlan: (id) => request(`/api/billing/plans/${id}`, { method: "DELETE" }),
    settings: () => request("/api/billing/settings"),
    updateSettings: (payload) => request("/api/billing/settings", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    }),
    requests: (filters = {}) => {
      const query = new URLSearchParams(
        Object.entries(filters).filter(([, value]) => value !== "" && value !== undefined)
      );
      return request(`/api/billing/requests?${query}`);
    },
    submitRequest: (companyId, payload) => {
      const form = new FormData();
      form.append("planId", payload.planId);
      form.append("bankReference", payload.bankReference || "");
      form.append("note", payload.note || "");
      form.append("slip", payload.slip);
      return request(`/api/billing/companies/${companyId}/requests`, { method: "POST", body: form });
    },
    approve: (id, note = "") => request(`/api/billing/requests/${id}/approve`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note }),
    }),
    reject: (id, note) => request(`/api/billing/requests/${id}/reject`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note }),
    }),
    reverse: (id, reason) => request(`/api/billing/requests/${id}/reverse`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }),
    }),
    allocations: (filters = {}) => {
      const query = new URLSearchParams(
        Object.entries(filters).filter(([, value]) => value !== "" && value !== undefined)
      );
      return request(`/api/billing/allocations?${query}`);
    },
    allocationsReport: (filters = {}) => {
      const query = new URLSearchParams(
        Object.entries(filters).filter(([, value]) => value !== "" && value !== undefined)
      );
      return download(`/api/billing/allocations/export?${query}`);
    },
    slip: (id) => download(`/api/billing/requests/${id}/slip`),
  },
  companies: {
    list: () => request("/api/companies"),
    create: (payload) =>
      request("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    update: (id, payload) =>
      request(`/api/companies/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    updateWidgetTheme: async (id, payload) => {
      const options = {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      };

      try {
        return await request(`/api/companies/${id}/widget-theme`, options);
      } catch (err) {
        const routeMissing =
          err.status === 405 ||
          (err.status === 404 && String(err.message || "").includes("Cannot PUT"));

        if (!routeMissing) throw err;

        return request(`/api/companies/${id}`, {
          ...options,
          body: JSON.stringify({ widgetTheme: payload }),
        });
      }
    },
    generateWidgetApiKey: (id) =>
      request(`/api/companies/${id}/widget-api-key`, {
        method: "POST",
      }),
    tokenUsage: (id) => request(`/api/companies/${id}/token-usage`),
    creditTransactions: (id, filters = {}) => {
      const query = new URLSearchParams(
        Object.entries(filters).filter(([, value]) => value !== "" && value !== undefined)
      );
      return request(`/api/companies/${id}/credits/transactions?${query}`);
    },
    addCredits: (id, payload) =>
      request(`/api/companies/${id}/credits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    remove: (id) => request(`/api/companies/${id}`, { method: "DELETE" }),
  },
  whatsappIntegration: {
    get: (companyId) => request(`/api/companies/${companyId}/whatsapp-integration`),
    connectConfig: (companyId) =>
      request(`/api/companies/${companyId}/whatsapp-integration/connect-config`),
    connect: (companyId, payload) =>
      request(`/api/companies/${companyId}/whatsapp-integration/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    save: (companyId, payload, hasExisting) =>
      request(`/api/companies/${companyId}/whatsapp-integration`, {
        method: hasExisting ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    validate: (companyId) =>
      request(`/api/companies/${companyId}/whatsapp-integration/validate`, {
        method: "POST",
      }),
    remove: (companyId) =>
      request(`/api/companies/${companyId}/whatsapp-integration`, {
        method: "DELETE",
      }),
  },

  smsIntegration: {
    get: (companyId) => request(`/api/companies/${companyId}/sms-integration`),
    save: (companyId, payload, hasExisting) =>
      request(`/api/companies/${companyId}/sms-integration`, {
        method: hasExisting ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    validate: (companyId) =>
      request(`/api/companies/${companyId}/sms-integration/validate`, {
        method: "POST",
      }),
    remove: (companyId) =>
      request(`/api/companies/${companyId}/sms-integration`, {
        method: "DELETE",
      }),
  },
  messengerIntegration: {
    get: (companyId) => request(`/api/companies/${companyId}/messenger-integration`),
    connectConfig: (companyId) =>
      request(`/api/companies/${companyId}/messenger-integration/connect-config`),
    discoverPages: (companyId, authorization) =>
      request(`/api/companies/${companyId}/messenger-integration/connect/pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authorization),
      }),
    connectPage: (companyId, payload) =>
      request(`/api/companies/${companyId}/messenger-integration/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    save: (companyId, payload, hasExisting) =>
      request(`/api/companies/${companyId}/messenger-integration`, {
        method: hasExisting ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    validate: (companyId) =>
      request(`/api/companies/${companyId}/messenger-integration/validate`, { method: "POST" }),
    remove: (companyId) =>
      request(`/api/companies/${companyId}/messenger-integration`, { method: "DELETE" }),
  },
  products: {
    list: (companyId) => request(`/api/companies/${companyId}/products`),
    dashboard: (companyId, filters = {}) => {
      const query = new URLSearchParams(
        Object.entries(filters).filter(([, value]) => value !== "" && value !== undefined)
      );
      return request(`/api/companies/${companyId}/products/dashboard?${query}`);
    },
    create: (companyId, payload) =>
      request(`/api/companies/${companyId}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    update: (companyId, productId, payload) =>
      request(`/api/companies/${companyId}/products/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    remove: (companyId, productId) =>
      request(`/api/companies/${companyId}/products/${productId}`, { method: "DELETE" }),
    uploadImage: (companyId, productId, file, altText = "") => {
      const form = new FormData();
      form.append("image", file);
      form.append("altText", altText);
      return request(`/api/companies/${companyId}/products/${productId}/image`, { method: "POST", body: form });
    },
    removeImage: (companyId, productId) =>
      request(`/api/companies/${companyId}/products/${productId}/image`, { method: "DELETE" }),
    template: (companyId) => download(`/api/companies/${companyId}/products/template`),
    previewImport: (companyId, file) => {
      const form = new FormData();
      form.append("file", file);
      return request(`/api/companies/${companyId}/products/import/preview`, { method: "POST", body: form });
    },
    import: (companyId, file, duplicateMode) => {
      const form = new FormData();
      form.append("file", file);
      form.append("duplicateMode", duplicateMode);
      return request(`/api/companies/${companyId}/products/import`, { method: "POST", body: form });
    },
  },
  orders: {
    list: (companyId, filters = {}) => {
      const query = new URLSearchParams(
        Object.entries(filters).filter(([, value]) => value !== "" && value !== undefined)
      );
      return request(`/api/companies/${companyId}/orders?${query}`);
    },
    summary: (companyId) => request(`/api/companies/${companyId}/orders/summary`),
    update: (companyId, orderId, payload) =>
      request(`/api/companies/${companyId}/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    setStatus: (companyId, orderId, status) =>
      request(`/api/companies/${companyId}/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
    retryTrackingNotification: (companyId, orderId) =>
      request(`/api/companies/${companyId}/orders/${orderId}/tracking-notification/retry`, {
        method: "POST",
      }),
  },
  documents: {
    list: (companyId) => request(`/api/companies/${companyId}/documents`),
    download: (companyId, documentId) =>
      download(`/api/companies/${companyId}/documents/${documentId}/download`),
    upload: (companyId, files) => {
      const formData = new FormData();
      const [file] = Array.from(files);
      if (!file) throw new Error("A PDF file is required");
      formData.append("relativePaths", file.webkitRelativePath || file.name);
      formData.append("file", file);
      return request(`/api/companies/${companyId}/documents`, {
        method: "POST",
        body: formData,
      });
    },
    reindex: (companyId, documentId) =>
      request(`/api/companies/${companyId}/documents/${documentId}/reindex`, {
        method: "POST",
      }),
    reindexAll: (companyId) =>
      request(`/api/companies/${companyId}/documents/reindex-all`, {
        method: "POST",
      }),
    setActive: (companyId, documentId, isActive) =>
      request(`/api/companies/${companyId}/documents/${documentId}/active`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      }),
    remove: (companyId, documentId) =>
      request(`/api/companies/${companyId}/documents/${documentId}`, {
        method: "DELETE",
      }),
    removeBulk: (companyId, documentIds) =>
      request(`/api/companies/${companyId}/documents/bulk`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIds }),
      }),
    removeAll: (companyId) =>
      request(`/api/companies/${companyId}/documents/all`, {
        method: "DELETE",
      }),
  },
  chat: {
    ask: (companyId, payload) =>
      request(`/api/companies/${companyId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    feedback: (companyId, conversationId, feedback) =>
      request(`/api/companies/${companyId}/chat/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, feedback }),
      }),
    conversations: (companyId, search = "") => {
      const query = search ? `?search=${encodeURIComponent(search)}` : "";
      return request(`/api/companies/${companyId}/chat/conversations${query}`);
    },
    history: (companyId, sessionId) =>
      request(`/api/companies/${companyId}/chat/history/${sessionId}`),
    createRealtimeSession: (companyId, sessionId) =>
      request(`/api/companies/${companyId}/chat/realtime/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      }),
    reportRealtimeUsage: (companyId, responseId, usage) =>
      request(`/api/companies/${companyId}/chat/realtime/usage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseId, usage }),
      }),
  },
};

export function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
