import { defineConfig } from "vite";

// The site is static. Content is served next to it at content/home.json and is
// mounted from configuration in deployments, so it is never bundled.
export default defineConfig({
  base: "./",
  envDir: false,
  build: {
    sourcemap: false,
    target: "es2022",
  },
  server: {
    host: process.env.DEV_SERVER_HOST ?? "127.0.0.1",
    port: 5174,
    strictPort: true,
  },
});
