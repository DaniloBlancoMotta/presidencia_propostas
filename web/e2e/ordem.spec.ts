// AC 20 e AC 21: ordem sorteada 50/50, mantida entre telas até recarregar, e troca manual.
import { expect, test, type Page } from "@playwright/test";

// painel de cada candidato; a partir de 768 px ele não é mais tabpanel (C39)
async function primeiro(page: Page) {
  await page.waitForFunction(() => document.querySelector(".painel") !== null);
  return page.locator(".painel").first().getAttribute("data-cand");
}

async function fixarSorteio(page: Page, valor: number) {
  await page.addInitScript((v) => {
    Math.random = () => v;
  }, valor);
}

test("sorteio: Math.random < 0,5 põe Flávio primeiro; ≥ 0,5 põe Lula primeiro", async ({ page }) => {
  await fixarSorteio(page, 0.1);
  await page.goto("/tema/saude");
  await expect.poll(() => primeiro(page)).toBe("flavio-bolsonaro");
  await fixarSorteio(page, 0.9);
  await page.reload();
  await expect.poll(() => primeiro(page)).toBe("lula");
});

test("sorteio: a ordem vale em todas as telas até recarregar", async ({ page }) => {
  await fixarSorteio(page, 0.9);
  await page.goto("/");
  await page.getByRole("link", { name: "Saúde" }).click();
  await expect(page.locator("h1")).toHaveText("Saúde");
  await expect.poll(() => primeiro(page)).toBe("lula");
  await page.getByRole("link", { name: "Todos os temas", exact: true }).click();
  await page.getByRole("link", { name: "Semelhanças" }).first().click();
  await expect(page.locator("h1")).toHaveText("Semelhanças");
  await page.locator(".item summary").first().click();
  await expect(page.locator(".item .lado").first()).toHaveAttribute("data-cand", "lula");
});

test("sorteio: sem fixar, as duas ordens aparecem em 30 carregamentos", async ({ page }) => {
  const vistos = new Set<string>();
  for (let i = 0; i < 30 && vistos.size < 2; i++) {
    await page.goto("/tema/saude");
    vistos.add((await page.evaluate(() => document.documentElement.dataset.ordem)) ?? "");
  }
  expect([...vistos].sort()).toEqual(["ab", "ba"]);
});

test("trocar: o botão inverte a ordem em todas as telas", async ({ page }) => {
  await fixarSorteio(page, 0.1);
  await page.goto("/tema/saude");
  await expect.poll(() => primeiro(page)).toBe("flavio-bolsonaro");
  await page.getByRole("button", { name: "Trocar ordem dos candidatos" }).click();
  await expect.poll(() => primeiro(page)).toBe("lula");
  await expect(page.locator('[role="tab"]').first()).toHaveAttribute("data-cand", "lula");
  await page.getByRole("link", { name: "Todos os temas", exact: true }).click();
  await page.getByRole("link", { name: "Diferenças" }).first().click();
  await expect(page.locator("h1")).toHaveText("Diferenças");
  await page.locator(".item summary").first().click();
  await expect(page.locator(".item .lado").first()).toHaveAttribute("data-cand", "lula");
  await page.getByRole("button", { name: "Trocar ordem dos candidatos" }).click();
  await expect(page.locator(".item .lado").first()).toHaveAttribute("data-cand", "flavio-bolsonaro");
});
