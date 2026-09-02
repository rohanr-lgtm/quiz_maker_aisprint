import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // Node 24+ ships a native `localStorage` global that shadows jsdom's
    // own Storage implementation, leaving `window.localStorage` undefined
    // under jsdom (see https://github.com/nodejs/node/issues/60303). This
    // flag removes Node's own `localStorage` global from the worker so
    // Vitest's jsdom environment can populate the real one instead.
    execArgv: ["--no-webstorage"],
  },
});
