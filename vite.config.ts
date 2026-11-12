import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

// The app lives at build40for40.com/nerds-of-fashion/, so it builds for that path.
export default defineConfig({
  base: "/nerds-of-fashion/",
  envPrefix: ["VITE_", "PUBLIC_"],
  build: { outDir: "dist/nerds-of-fashion" },
  server: { proxy: { "/nerds-of-fashion/api": "http://localhost:8787" } },
  plugins: [vue(), tailwindcss()],
  test: {
    include: ["src/**/*.test.ts", "worker/**/*.test.ts"],
    environment: "node",
  },
});
