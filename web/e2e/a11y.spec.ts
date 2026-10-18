// AC 35, 36, 37.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { ROTAS } from "./apoio";

for (const r of ROTAS) test(`axe: zero violações serious ou critical em ${r}`, async ({ page }) => {
  {
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

async function tabAte(page: import("@playwright/test").Page, alvo: (f: { texto: string; tag: string; role: string | null }) => boolean, max = 80) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    const f = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const s = getComputedStyle(el);
      return { texto: el.textContent?.trim() ?? "", tag: el.tagName, role: el.getAttribute("role"),
               outline: s.outlineStyle !== "none" && parseFloat(s.outlineWidth) >= 2 };
    });
    expect(f.outline, `foco visível em ${f.tag} "${f.texto.slice(0, 40)}"`).toBe(true);
    if (alvo(f)) return;
  }
  throw new Error("alvo não alcançado com Tab");
}

test("teclado: navegar, abrir tema, filtrar, trocar abas e expandir só com Tab/Enter/Espaço/setas", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.keyboard.press("Tab");
  expect((await focado(page)).texto).toBe("Pular para o conteúdo");
  expect((await focado(page)).outline).toBe(true);
  await tabAte(page, (f) => f.texto === "Saúde");
  await page.keyboard.press("Enter");
  await expect(page.locator("h1")).toHaveText("Saúde");
  await tabAte(page, (f) => f.texto === "Só semelhanças");
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "Só semelhanças" })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Mostrar tudo" })).toHaveAttribute("aria-pressed", "true");
  await tabAte(page, (f) => f.role === "tab");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab").nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab").nth(1)).toBeFocused();
  await tabAte(page, (f) => f.tag === "SUMMARY");
  await page.keyboard.press("Enter");
  await expect(page.locator('[role="tabpanel"]:visible .item').first().locator(".trecho").first()).toBeVisible();
  await tabAte(page, (f) => f.texto.startsWith("Ver no PDF"));
  for (const r of ROTAS) {
    await page.goto(r);
    const total = await page.locator("a:visible, button:visible, summary:visible").count();
    for (let i = 0; i < Math.min(total, 60); i++) {
      await page.keyboard.press("Tab");
      const f = await focado(page);
      if (f.tag === "BODY") break;
      expect(f.outline, `${r}: foco visível em ${f.tag} "${f.texto.slice(0, 40)}"`).toBe(true);
    }
  }
});
