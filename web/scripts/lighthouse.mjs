// AC 34: Lighthouse no perfil mobile padrão em / e /tema/<id>: Performance >= 90,
// Acessibilidade >= 90, LCP < 2,0 s. Usa o Chromium da imagem do Playwright.
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";

const raiz = resolve(process.argv[2] ?? "dist");
const porta = 4183;
const tema = readdirSync(join(raiz, "tema"))[0];
const servidor = spawn(process.execPath, ["scripts/servir.mjs", raiz, String(porta)], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 800));

const chrome = await chromeLauncher.launch({
  chromePath: chromium.executablePath(),
  chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
});
let falhou = false;
try {
  for (const caminho of ["/", `/tema/${tema}`]) {
    const r = await lighthouse(`http://localhost:${porta}${caminho}`, {
      port: chrome.port,
      output: "json",
      logLevel: "error",
      onlyCategories: ["performance", "accessibility"],
    });
    const lhr = r.lhr;
    const perf = Math.round(lhr.categories.performance.score * 100);
    const a11y = Math.round(lhr.categories.accessibility.score * 100);
    const lcp = lhr.audits["largest-contentful-paint"].numericValue / 1000;
    const ok = perf >= 90 && a11y >= 90 && lcp < 2.0;
    falhou ||= !ok;
    console.log(`${ok ? "ok" : "FALHA"}: ${caminho}: performance ${perf}, acessibilidade ${a11y}, LCP ${lcp.toFixed(2)} s (perfil ${lhr.configSettings.formFactor})`);
  }
} finally {
  await chrome.kill();
  servidor.kill();
}
process.exit(falhou ? 1 : 0);
