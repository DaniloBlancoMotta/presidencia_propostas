import { defineConfig, devices } from "@playwright/test";

const PORTA = 4173;
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  retries: 0,
  workers: 4,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORTA}`, trace: "off" },
  webServer: {
    command: `node scripts/servir.mjs dist-teste ${PORTA}`,
    url: `http://localhost:${PORTA}/`,
    reuseExistingServer: false,
  },
  projects: [
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"] } },
    { name: "android-chrome", use: { ...devices["Pixel 5"] }, testMatch: /(pdf|navegacao)\.spec\.ts/ },
    { name: "ios-safari", use: { ...devices["iPhone 12"] }, testMatch: /pdf\.spec\.ts/ },
  ],
});
