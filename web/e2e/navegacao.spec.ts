// AC 16, 17, 18, 22, 23, 25, 26.
import { expect, test } from "@playwright/test";
import { comparacao, publicados, temas } from "./apoio";

const ordemTemas = temas.filter((t) => publicados.includes(t.id));

test("grade: Semelhanças e Diferenças primeiro, depois os temas na ordem de themes.yaml, com SVG", async ({ page }) => {
  await page.goto("/");
  const itens = page.locator('nav[aria-label="Temas"] li');
  await expect(itens).toHaveText(["Semelhanças", "Diferenças", ...ordemTemas.map((t) => t.rotulo)]);
  for (const li of await itens.all()) await expect(li.locator("svg")).toHaveCount(1);
  await expect(page.locator(".destaque")).toHaveCount(2);
});

test("colunas e abas: ≥ 768 px duas colunas iguais, < 768 px duas abas", async ({ page, isMobile }) => {
  await page.goto("/tema/saude");
  const paineis = page.locator('[role="tabpanel"]');
  await expect(paineis).toHaveCount(2);
  if (!isMobile) {
    await page.setViewportSize({ width: 1024, height: 900 });
    await expect(page.locator('[role="tablist"]')).toBeHidden();
    await expect(paineis.nth(0)).toBeVisible();
    await expect(paineis.nth(1)).toBeVisible();
    const [a, b] = [await paineis.nth(0).boundingBox(), await paineis.nth(1).boundingBox()];
    expect(Math.abs(a!.width - b!.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(a!.y - b!.y)).toBeLessThanOrEqual(1);
    await page.setViewportSize({ width: 767, height: 900 });
  }
  const abas = page.getByRole("tab");
  await expect(abas).toHaveCount(2);
  await expect(page.locator('[role="tabpanel"]:visible')).toHaveCount(1);
  const segunda = await abas.nth(1).getAttribute("aria-controls");
  await abas.nth(1).click();
  await expect(abas.nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(`#${segunda}`)).toBeVisible();
  await expect(page.locator('[role="tabpanel"]:visible')).toHaveCount(1);
});

test("expandir: bullet mostra trecho, arquivo, página e Ver no PDF", async ({ page }) => {
  await page.goto("/tema/saude");
  const painel = page.locator('[role="tabpanel"]:visible').first();
  const item = painel.locator(".item").first();
  await expect(item.locator(".trecho").first()).toBeHidden();
  await item.locator("summary").click();
  await expect(item.locator(".trecho").first()).toBeVisible();
  await expect(item.locator(".arquivo").first()).toHaveText(/\.pdf$/);
  await expect(item.locator(".pagina").first()).toHaveText(/^pág\. \d+$/);
  await expect(item.getByRole("link", { name: /Ver no PDF/ }).first()).toBeVisible();
});

test("filtro: só semelhanças, só diferenças e mostrar tudo", async ({ page }) => {
  await page.goto("/tema/saude");
  const blocos = page.locator("[data-lista]");
  await expect(blocos).toHaveCount(4);
  await page.getByRole("button", { name: "Só semelhanças" }).click();
  await expect(blocos).toHaveCount(1);
  await expect(page.locator('[data-lista="semelhancas"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Só semelhanças" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Só diferenças" }).click();
  await expect(page.locator("[data-lista]")).toHaveCount(2);
  await expect(page.locator('[data-lista="diferencas"]')).toBeVisible();
  await expect(page.locator('[data-lista="omissoes"]')).toBeVisible();
  await expect(page.locator('[data-lista="semelhancas"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Mostrar tudo" }).click();
  await expect(blocos).toHaveCount(4);
});

test("transversal: itens de todos os temas, agrupados na ordem de themes.yaml", async ({ page }) => {
  for (const tipo of ["semelhancas", "diferencas"] as const) {
    await page.goto(`/${tipo}`);
    const esperado = ordemTemas.filter((t) => {
      const c = comparacao(t.id);
      return c[tipo].length > 0 || (tipo === "diferencas" && c.omissoes.length > 0);
    });
    await expect(page.locator("section[data-tema]")).toHaveCount(esperado.length);
    const ids = await page.locator("section[data-tema]").evaluateAll((els) => els.map((e) => e.getAttribute("data-tema")));
    expect(ids).toEqual(esperado.map((t) => t.id));
    for (const t of esperado) {
      const c = comparacao(t.id);
      const sec = page.locator(`section[data-tema="${t.id}"]`);
      const textos = await sec.locator(".texto-item").allTextContents();
      const esperados = [...c[tipo].map((i) => i.texto), ...(tipo === "diferencas" ? c.omissoes.map((o) => o.texto) : [])];
      expect(textos).toEqual(esperados);
      if (tipo === "diferencas") {
        await expect(sec.locator(".selo", { hasText: "Omissão" })).toHaveCount(c.omissoes.length);
      }
      if (c[tipo].length) {
        await sec.locator(".item summary").first().click();
        const trecho = c[tipo][0].citacoes.lula[0].trecho;
        await expect(sec.locator(".item").first().locator(".trecho", { hasText: trecho.slice(0, 40) })).toHaveCount(1);
      }
    }
  }
});

test("link direto: /tema/<id> abre o tema sem passar pela inicial", async ({ page }) => {
  const r = await page.goto("/tema/educacao");
  expect(r?.status()).toBe(200);
  await expect(page.locator("h1")).toHaveText("Educação");
});

test("404: tema inexistente e rota desconhecida respondem 404 com link para /", async ({ page }) => {
  for (const url of ["/tema/tema-inexistente", "/qualquer/coisa"]) {
    const r = await page.goto(url);
    expect(r?.status()).toBe(404);
    await expect(page.locator("h1")).toHaveText("Página não encontrada");
    await expect(page.getByRole("link", { name: "Ir para o início" })).toHaveAttribute("href", "/");
  }
});
