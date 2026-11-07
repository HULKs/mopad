import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  server: {
    proxy: {
      "/config.json": "http://127.0.0.1:9559",
      "/api": {
        target: "http://127.0.0.1:9559",
        changeOrigin: true,
        ws: true,
      },
      "/teams.json": {
        target: "http://127.0.0.1:9559",
        changeOrigin: true,
      },
      "/locations.json": {
        target: "http://127.0.0.1:9559",
        changeOrigin: true,
      },
      "/talks.ics": {
        target: "http://127.0.0.1:9559",
        changeOrigin: true,
      },
    },
  },
});
