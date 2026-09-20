import { defineConfig } from "vite";
import { playwright } from '@vitest/browser-playwright'
import path from "path";
import scalaJSPlugin from "@scala-js/vite-plugin-scalajs";

export default defineConfig(({mode}) => {
  const isProduction = mode === "production";
  const scalaTarget = isProduction
    ? "edgwebcompiler-opt"
    : "edgwebcompiler-fastopt";

  return {
    plugins: [scalaJSPlugin()],
    base: './', // don't use absolute path since pages serves from its subfolder
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
          import.meta.dirname,
          `./target/scala-2.13/${scalaTarget}/main.js`
        ),
      },
    },
    test: {
      browser: {
        provider: playwright(),
        enabled: true,
        headless: true,
        instances: [
          { browser: 'firefox' },
        ],
      },
    }
}});
