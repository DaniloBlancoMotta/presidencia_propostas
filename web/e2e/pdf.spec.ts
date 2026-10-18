// AC 19: "Ver no PDF" abre o visualizador do próprio domínio, com o PDF de SHA-256 registrado,
// na página citada. Roda em Chrome desktop, Chrome Android (Pixel 5) e Safari iOS (iPhone 12, WebKit).
import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import { fontes } from "./apoio";

test("abre na página citada, no próprio domínio, com o PDF registrado", async ({ page, context, baseURL }) => {
  await page.goto("/tema/saude");
  const item = page.locator('[role="tabpanel"]:visible .item').first();
  await item.locator("summary").click();
  const pagina = Number((await item.locator(".pagina").first().textContent())!.replace(/\D/g, ""));
  const arquivo = (await item.locator(".arquivo").first().textContent())!;
  const [aba] = await Promise.all([context.waitForEvent("page"), item.getByRole("link", { name: /Ver no PDF/ }).first().click()]);
  await aba.waitForLoadState();
  const url = new URL(aba.url());
  expect(url.origin).toBe(new URL(baseURL!).origin);
  expect(url.pathname).toBe("/pdf/visualizador.html");
  expect(url.searchParams.get("arquivo")).toBe(arquivo);
  await expect(aba.locator("body")).toHaveAttribute("data-pagina", String(pagina), { timeout: 30_000 });
  await expect(aba.locator("#titulo-pdf")).toHaveText(new RegExp(`página ${pagina} de \\d+`));
  const tela = await aba.locator("#tela").boundingBox();
  expect(tela!.width).toBeGreaterThan(100);

  const r = await page.request.get(`/pdf/${encodeURIComponent(arquivo)}`);
  expect(r.status()).toBe(200);
  const sha = createHash("sha256").update(await r.body()).digest("hex");
  expect(sha).toBe(fontes.find((f) => f.arquivo === arquivo)!.sha256);
});
