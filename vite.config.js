import { defineConfig } from "vite";
import path from "path";
import scalaJSPlugin from "@scala-js/vite-plugin-scalajs";

export default defineConfig(({mode}) => {
  const isProduction = mode === "production";
  const scalaTarget = isProduction
    ? "edgwebcompiler-opt"
    : "edgwebcompiler-fastopt";

  return {
    plugins: [scalaJSPlugin()],
    server: {
      headers: {
        'Cache-Control': 'no-store', // Disables dev server asset caching
      },
    },
    assetsInclude: ['**/*.whl'],
    resolve: {
      // import ... from 'scalajs:*' doesn't seem to resolve properly, so this hacks around it
      alias: {
        "@edgjs": path.resolve(
          __dirname,
          `./target/scala-2.13/${scalaTarget}/main.js`
        ),
      },
    }
}});
