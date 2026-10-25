import { defineConfig, devices } from "@playwright/test";

const PORTA = 4173;
const PORTA_PREVIA = 4175; // dist-previa: o mesmo site com o /ask da §11 ligado (nunca publicado)
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  retries: 0,
  workers: 4,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORTA}`, trace: "off" },
  webServer: [
    { command: `node scripts/servir.mjs dist-teste ${PORTA}`, url: `http://localhost:${PORTA}/`, reuseExistingServer: false },
    { command: `node scripts/servir.mjs dist-previa ${PORTA_PREVIA}`, url: `http://localhost:${PORTA_PREVIA}/`, reuseExistingServer: false },
  ],
  projects: [
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"] }, testIgnore: /ask\.spec\.ts/ },
    { name: "android-chrome", use: { ...devices["Pixel 5"] }, testMatch: /(pdf|navegacao|chat)\.spec\.ts/ },
    { name: "ios-safari", use: { ...devices["iPhone 12"] }, testMatch: /pdf\.spec\.ts/ },
    { name: "previa-ask", use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${PORTA_PREVIA}` }, testMatch: /ask\.spec\.ts/ },
  ],
});
