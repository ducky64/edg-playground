import { defineConfig } from "vite";
import scalaJSPlugin from "@scala-js/vite-plugin-scalajs";

export default defineConfig({
  plugins: [scalaJSPlugin()],
  server: {
      headers: {
        'Cache-Control': 'no-store', // Disables dev server asset caching
      },
    },
    assetsInclude: ['**/*.whl'],
});
