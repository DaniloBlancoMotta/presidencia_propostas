// AC 35, 36, 37.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { ROTAS } from "./apoio";

test("axe: zero violações serious ou critical em cada rota", async ({ page }) => {
  for (const r of ROTAS) {
    await page.goto(r);
    await page.waitForLoadState("networkidle");
    for (const s of await page.locator("summary:visible").all()) await s.click();
    const res = await new AxeBuilder({ page: page as never }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const graves = res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(graves.map((v) => `${r}: ${v.id} (${v.nodes.length})`)).toEqual([]);
  }
});

test("reflow: 320 px com zoom de 200% (160 px CSS) sem rolagem horizontal", async ({ page }) => {
  await page.setViewportSize({ width: 160, height: 700 });
  for (const r of ROTAS) {
    await page.goto(r);
    await page.waitForLoadState("networkidle");
    for (const s of await page.locator("summary:visible").all()) await s.click();
    const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(sw, r).toBeLessThanOrEqual(cw);
  }
});

async function focado(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const s = getComputedStyle(el);
    return { texto: el.textContent?.trim() ?? "", tag: el.tagName, outline: s.outlineStyle !== "none" && parseFloat(s.outlineWidth) >= 2 };
  });
}

test("teclado: navegar, abrir tema, filtrar, expandir e trocar abas só com teclado, com foco visível", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.keyboard.press("Tab");
  expect((await focado(page)).texto).toBe("Pular para o conteúdo");
  expect((await focado(page)).outline).toBe(true);
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press("Tab");
    const f = await focado(page);
    expect(f.outline, `foco visível em ${f.tag} "${f.texto}"`).toBe(true);
    if (f.texto === "Saúde") break;
  }
  expect((await focado(page)).texto).toBe("Saúde");
  await page.keyboard.press("Enter");
  await expect(page.locator("h1")).toHaveText("Saúde");
  const filtro = page.getByRole("button", { name: "Só semelhanças" });
  await filtro.focus();
  await page.keyboard.press("Space");
  await expect(filtro).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Mostrar tudo" }).focus();
  await page.keyboard.press("Enter");
  const aba = page.getByRole("tab").first();
  await aba.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab").nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab").nth(1)).toBeFocused();
  const summary = page.locator('[role="tabpanel"]:visible summary').first();
  await summary.focus();
  expect((await focado(page)).outline).toBe(true);
  await page.keyboard.press("Enter");
  await expect(page.locator('[role="tabpanel"]:visible .item').first().locator(".trecho").first()).toBeVisible();
  for (const r of ROTAS) {
    await page.goto(r);
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      const f = await focado(page);
      if (f.tag === "BODY") break;
      expect(f.outline, `${r}: foco visível em ${f.tag} "${f.texto}"`).toBe(true);
    }
  }
});
