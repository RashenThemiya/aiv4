import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/widget.js",
      name: "RAGChatWidget",
      formats: ["iife"],
      fileName: () => "rag-chat-widget.iife.js",
    },
    outDir: "dist-widget",
    emptyOutDir: true,
  },
});
