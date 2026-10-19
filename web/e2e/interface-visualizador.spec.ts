// S3, S6 e C59 da feature interface-site: o visualizador "Ver no PDF".
import { expect, test } from "@playwright/test";

test("C59: a barra do visualizador traz no topo a faixa na cor do candidato do PDF", async ({ page }) => {
  for (const [arquivo, cand] of [
    ["Programa-Governo-LULA-2026.pdf", "cand-lula"],
    ["plano-de-governo_flavio.pdf", "cand-flavio-bolsonaro"],
  ]) {
    await page.goto(`/pdf/visualizador.html?arquivo=${arquivo}&pagina=1`);
    const esperada = await page.evaluate((n) => {
      const d = document.createElement("div");
      d.style.color = `var(--${n})`;
      document.body.append(d);
      const v = getComputedStyle(d).color;
      d.remove();
      return v;
    }, cand);
    const barra = await page.getByRole("banner").evaluate((el) => {
      const s = getComputedStyle(el);
      return { largura: parseFloat(s.borderTopWidth), cor: s.borderTopColor };
    });
    expect(barra.largura, arquivo).toBeGreaterThanOrEqual(4);
    expect(barra.cor, arquivo).toBe(esperada);
  }
});
