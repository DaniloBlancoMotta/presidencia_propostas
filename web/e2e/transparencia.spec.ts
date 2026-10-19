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

test("neutro: os dois candidatos usam o mesmo componente, classes e estilos", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/tema/saude");
  const paineis = page.locator('[role="tabpanel"]');
  const estilos = await paineis.evaluateAll((els) =>
    els.map((el) => {
      const h = el.querySelector("h3")!;
      const s = getComputedStyle(h);
      const p = getComputedStyle(el);
      return {
        classe: el.className.replace(" ativo", ""),
        tag: el.tagName,
        h: [s.color, s.fontWeight, s.fontSize, s.backgroundColor].join("|"),
        // fundo e cor das bordas leem --tom-cand e --cor-cand (C73); o resto é igual nos dois
        p: [p.color, p.borderTopWidth, p.borderTopStyle, p.padding].join("|"),
        item: el.querySelector(".item")?.className,
      };
    }),
  );
  expect(estilos[0]).toEqual(estilos[1]);
  const abas = await page.getByRole("tab").evaluateAll((els) => els.map((e) => e.className));
  expect(abas[0]).toBe(abas[1]);
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
  await page.getByRole("link", { name: "← Todos os temas" }).click();
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
