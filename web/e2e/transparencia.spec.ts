// AC 2 (rodapé), 27, 28, 29, 30, 31, 32.
import { expect, test } from "@playwright/test";
import { AVISO, ROTAS, dataColeta, fontes } from "./apoio";

test("rodapé: toda rota mostra a data de coleta do TSE", async ({ page }) => {
  for (const r of ROTAS) {
    await page.goto(r);
    await expect(page.locator(".coleta")).toHaveText(`Documentos coletados do TSE em ${dataColeta()}`);
  }
});

test("aviso: toda rota mostra o aviso de IA exato", async ({ page }) => {
  for (const r of ROTAS) {
    await page.goto(r);
    await expect(page.locator(".aviso-ia")).toHaveText(AVISO);
    await expect(page.locator(".aviso-ia")).toBeVisible();
  }
});

test("sobre: arquivo, SHA-256, data de coleta, link do TSE e responsável", async ({ page }) => {
  await page.goto("/sobre");
  const cartoes = page.locator(".fonte");
  await expect(cartoes).toHaveCount(2);
  for (const f of fontes) {
    const c = page.locator(`.fonte[data-cand="${f.candidato}"]`);
    await expect(c.getByRole("link", { name: f.arquivo })).toBeVisible();
    await expect(c.locator(".hash")).toHaveText(f.sha256);
    await expect(c).toContainText(dataColeta());
    await expect(c.getByRole("link", { name: /TSE/ })).toHaveAttribute("href", f.url_tse);
  }
  await expect(page.getByRole("heading", { name: "Responsável pelo site" })).toBeVisible();
  await expect(page.locator(".responsavel")).not.toBeEmpty();
});

test("metodologia: as 5 etapas em ordem e a regra só documentos oficiais", async ({ page }) => {
  await page.goto("/metodologia");
  await expect(page.locator(".etapas > li strong")).toHaveText([
    "Ingestão.",
    "Classificação.",
    "Comparação.",
    "Verificação automática.",
    "Revisão humana.",
  ]);
  await expect(page.locator("main")).toContainText("Regra: só documentos oficiais.");
});

/** tagName, classes e todos os estilos calculados de um elemento, com --cor-cand, --tom-cand e --tom-cand-forte
 *  trocadas pelo mesmo valor: o que ainda diferir entre os dois candidatos não vem da cor de identidade (C73).
 *  Ficam de fora só `order` (a ordem sorteada, decisão 12) e as medidas, que dependem do texto de cada plano. */
async function retrato(page: import("@playwright/test").Page, seletor: string) {
  await page.mouse.move(0, 0);
  return page.locator(seletor).first().evaluate((el) => {
    const FORA = new Set(["order", "width", "height", "block-size", "inline-size", "perspective-origin", "transform-origin"]);
    const h = el as HTMLElement;
    const original = h.getAttribute("style");
    for (const v of ["--cor-cand", "--tom-cand", "--tom-cand-forte"]) h.style.setProperty(v, "rgb(1, 2, 3)");
    const s = getComputedStyle(h);
    const estilos: Record<string, string> = {};
    for (let i = 0; i < s.length; i++) if (!s[i].startsWith("--") && !FORA.has(s[i])) estilos[s[i]] = s.getPropertyValue(s[i]);
    if (original === null) h.removeAttribute("style");
    else h.setAttribute("style", original);
    return { tag: h.tagName, classes: h.className.replace(/\bativo\b/, "").trim(), estilos };
  });
}

test("neutro: os dois candidatos usam o mesmo componente, classes e estilos", async ({ page }) => {
  const iguais = async (rotulo: string, a: string, b: string) => expect(await retrato(page, a), rotulo).toEqual(await retrato(page, b));
  const hidratado = () => page.waitForFunction(() => !document.querySelector("[data-pre]"));
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/tema/saude");
  await hidratado();
  await page.locator('.painel[data-cand="lula"] .item summary').first().click();
  await page.locator('.painel[data-cand="flavio-bolsonaro"] .item summary').first().click();
  await page.locator('[data-lista="semelhancas"] .item summary').first().click();
  const L = '[data-cand="lula"]';
  const F = '[data-cand="flavio-bolsonaro"]';
  await iguais("coluna", `.painel${L}`, `.painel${F}`);
  await iguais("h3", `.painel${L} h3`, `.painel${F} h3`);
  await iguais("item", `.painel${L} .item`, `.painel${F} .item`);
  await iguais("citação", `.painel${L} .citacao`, `.painel${F} .citacao`);
  await iguais("lado", `[data-lista="semelhancas"] .lado${L}`, `[data-lista="semelhancas"] .lado${F}`);
  await iguais("omissão", `li.omissao${L}`, `li.omissao${F}`);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tema/saude");
  await hidratado();
  const visto: Record<string, Awaited<ReturnType<typeof retrato>>[]> = {};
  for (const c of [L, F]) {
    await page.locator(`.aba${c}`).click();
    await page.locator(`.painel${c} .item summary`).first().click();
    for (const [nome, seletor] of [
      ["aba", `.aba${c}`],
      ["painel", `.painel${c}`],
      ["h3", `.painel${c} h3`],
      ["item", `.painel${c} .item`],
      ["citação", `.painel${c} .citacao`],
    ]) (visto[nome] ??= []).push(await retrato(page, seletor));
  }
  for (const [nome, [a, b]] of Object.entries(visto)) expect(a, `390 px: ${nome}`).toEqual(b);

  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/sobre");
  await hidratado();
  await iguais("cartão de /sobre", `.fonte${L}`, `.fonte${F}`);
  await iguais("título do cartão", `.fonte${L} h2`, `.fonte${F} h2`);

  await page.goto("/tema/saude");
  const css = await page.evaluate(() => [...document.querySelectorAll("style")].map((s) => s.textContent).join("\n"));
  // regras amarradas a um candidato só definem `order` ou as três variáveis do candidato (C73)
  const regras = css.match(/[^{}]*data-cand[^{}]*\{[^}]*\}/g) ?? [];
  expect(regras.length).toBeGreaterThan(0);
  for (const r of regras) {
    const decl = r.replace(/^[^{]*\{/, "").replace(/\}$/, "").split(";").map((d) => d.trim()).filter(Boolean);
    expect(decl.length, r).toBeGreaterThan(0);
    for (const d of decl) expect(d, r).toMatch(/^(order:\s*[12]|--cor-cand:|--tom-cand:|--tom-cand-forte:)/);
  }
});

test("mesma origem: só requisições ao próprio domínio, em todas as rotas e controles", async ({ page, baseURL }) => {
  // com "Mostrar tudo" por último entre os filtros (C5), cada tema termina com todos os itens à mostra e o
  // teste abre todos eles: mais cliques que antes, e não cabe mais em 60 s com a bateria em paralelo
  test.setTimeout(150_000);
  const origem = new URL(baseURL!).origin;
  const fora: string[] = [];
  page.on("request", (req) => {
    const u = new URL(req.url());
    if (u.protocol !== "data:" && u.protocol !== "blob:" && u.origin !== origem) fora.push(req.url());
  });
  for (const r of ROTAS) {
    await page.goto(r);
    await page.waitForLoadState("networkidle");
    for (const b of await page.locator("button:visible").all()) {
      if (await b.isEnabled()) await b.click();
    }
    for (const s of await page.locator("summary:visible").all()) await s.click();
  }
  // navegação no cliente busca /comparacoes/<id>.json
  await page.goto("/");
  await page.getByRole("link", { name: "Saúde" }).click();
  await expect(page.locator("h1")).toHaveText("Saúde");
  await page.getByRole("link", { name: "Todos os temas", exact: true }).click();
  await page.getByRole("link", { name: "Diferenças" }).first().click();
  await expect(page.locator("h1")).toHaveText("Diferenças");
  await page.waitForLoadState("networkidle");
  expect(fora).toEqual([]);
});

test("cookie: nenhuma resposta define cookie e nenhum script vem de outro domínio", async ({ page, baseURL }) => {
  const origem = new URL(baseURL!).origin;
  const comCookie: string[] = [];
  page.on("response", async (resp) => {
    if ((await resp.allHeaders())["set-cookie"]) comCookie.push(resp.url());
  });
  for (const r of ROTAS) {
    await page.goto(r);
    await page.waitForLoadState("networkidle");
    const srcs = await page.locator("script[src]").evaluateAll((els) => els.map((e) => (e as HTMLScriptElement).src));
    for (const s of srcs) expect(new URL(s).origin).toBe(origem);
    const csp = (await page.request.get(r)).headers()["content-security-policy"];
    expect(csp).toContain("default-src 'self'");
  }
  expect(comCookie).toEqual([]);
  expect(await page.context().cookies()).toEqual([]);
});
