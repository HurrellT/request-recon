import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import solid from "vite-plugin-solid";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json" with { type: "json" };

function bundleLicenseNotices() {
  return {
    name: "bundle-license-notices",
    generateBundle() {
      for (const fileName of ["LICENSE", "THIRD_PARTY_NOTICES.txt"]) {
        this.emitFile({
          type: "asset",
          fileName,
          source: readFileSync(new URL(`./${fileName}`, import.meta.url)),
        });
      }
    },
  };
}

export default defineConfig({
  plugins: [solid(), crx({ manifest }), bundleLicenseNotices()],
  build: {
    rolldownOptions: {
      input: {
        panel: "devtools/panel.html",
      },
    },
  },
});
