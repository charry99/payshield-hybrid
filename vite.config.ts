import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// PayShield Hybrid is a fully static Vite SPA. Firebase AI Logic runs
// client-side and talks directly to Google endpoints from the browser,
// so no dev-server proxy and no runtime server are needed.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
  },
});
