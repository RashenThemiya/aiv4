import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/widget.js",
      name: "RAGChatWidget",
      formats: ["iife"],
      fileName: () => "rag-chat-widget.iife.js",
    },
    // Keep the embeddable bundle inside the main frontend deployment so the
    // dashboard origin can serve it without a separate widget host.
    outDir: "dist/dist-widget",
    emptyOutDir: false,
  },
});
