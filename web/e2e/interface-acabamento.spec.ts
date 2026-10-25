// S5 da feature interface-site: acabamento de toque, hover e texto.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { ROTAS, comparacao } from "./apoio";
import { abrir, abrirTudo, hidratado, normal, token } from "./interface-apoio";

async function cores(l: Locator) {
  return l.evaluate((el) => {
    const s = getComputedStyle(el);
    return { fundo: s.backgroundColor, borda: [s.borderTopColor, s.borderRightColor, s.borderBottomColor, s.borderLeftColor].join(" ") };
  });
}

/** O mouse sobre o controle muda o fundo (ou a borda) para o token esperado. */
async function hoverVira(page: Page, alvo: Locator, nomeToken: string, rotulo: string) {
  await page.mouse.move(0, 0);
  await alvo.scrollIntoViewIfNeeded();
  const antes = await cores(alvo);
  await alvo.hover();
  const depois = await cores(alvo);
  const esperado = await token(page, nomeToken);
  expect(depois.fundo !== antes.fundo || depois.borda !== antes.borda, rotulo).toBe(true);
  expect(depois.fundo === esperado || depois.borda.includes(esperado), `${rotulo}: ${depois.fundo} deveria ser --${nomeToken}`).toBe(true);
  await page.mouse.move(0, 0);
}

test("C40: o hover muda fundo ou borda para um token: neutro fora das áreas de cor, o tom forte dentro delas", async ({ page }) => {
  await abrir(page, "/");
  expect(await page.evaluate(() => matchMedia("(hover: hover)").matches)).toBe(true);
  await hoverVira(page, page.locator(".indice a").first(), "papel-2", "cartão de tema");
  await hoverVira(page, page.locator(".destaque.dif a"), "papel-3", "destaque Diferenças");
  await hoverVira(page, page.locator(".destaque.sem a"), "tom-semelhanca-forte", "destaque Semelhanças");

  await abrir(page, "/tema/saude");
  await hidratado(page);
  await hoverVira(page, page.getByRole("button", { name: "Só semelhanças" }), "papel-2", "filtro não pressionado");
  await hoverVira(page, page.getByRole("button", { name: "Trocar ordem dos candidatos" }), "papel-2", "Trocar ordem");
  for (const c of ["lula", "flavio-bolsonaro"]) {
    await hoverVira(page, page.locator(`.painel[data-cand="${c}"] .item summary`).first(), `tom-${c}-forte`, `item da coluna ${c}`);
    await hoverVira(page, page.locator(`[data-lista="omissoes"] li[data-cand="${c}"] summary`).first(), `tom-${c}-forte`, `omissão ${c}`);
  }
  await hoverVira(page, page.locator('[data-lista="semelhancas"] .item summary').first(), "tom-semelhanca-forte", "item de semelhança");
  await hoverVira(page, page.locator('[data-lista="diferencas"] .item summary').first(), "papel-2", "item de diferença");

  await abrir(page, "/tema/saude", 390, 844);
  await hidratado(page);
  await hoverVira(page, page.locator('[role="tab"][aria-selected="false"]'), "papel-2", "aba não selecionada");
});

test("C41: controles com touch-action manipulation, realce de toque no matiz do acento e estado :active", async ({ page, browser }) => {
  await abrir(page, "/tema/saude");
  await hidratado(page);
  await abrirTudo(page);
  const acento = await token(page, "acento");
  const matiz = (cor: string) => {
    const m = /oklch\(\s*[\d.]+%?\s+[\d.]+\s+([\d.]+)/.exec(cor);
    return m ? Number(m[1]) : NaN;
  };
  const alfa = (cor: string) => {
    const m = /\/\s*([\d.]+)\s*\)$/.exec(cor) ?? /rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/.exec(cor);
    return m ? Number(m[1]) : 1;
  };
  expect(Number.isNaN(matiz(acento))).toBe(false);
  const controles = await page.locator("a:visible, button:visible, summary:visible").evaluateAll((els) =>
    els.map((e) => ({ toque: getComputedStyle(e).touchAction, realce: getComputedStyle(e).getPropertyValue("-webkit-tap-highlight-color") })),
  );
  expect(controles.length).toBeGreaterThan(20);
  for (const c of controles) {
    expect(c.toque).toBe("manipulation");
    expect(matiz(c.realce), c.realce).toBeCloseTo(matiz(acento), 0);
    expect(alfa(c.realce), c.realce).toBeGreaterThan(0);
    expect(alfa(c.realce), c.realce).toBeLessThan(1);
  }

  // :active num contexto de toque (sem hover): o fundo muda com o botão pressionado
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 900 }, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  for (const [rota, seletor] of [
    ["/tema/saude", ".filtro[aria-pressed='false']"],
    ["/", ".indice a"],
    ["/tema/saude", ".item summary"],
  ]) {
    await p.goto(rota);
    await p.waitForLoadState("networkidle");
    expect(await p.evaluate(() => matchMedia("(hover: hover)").matches)).toBe(false);
    const alvo = p.locator(seletor).first();
    await alvo.scrollIntoViewIfNeeded();
    const antes = (await cores(alvo)).fundo;
    const caixa = (await alvo.boundingBox())!;
    await p.mouse.move(caixa.x + 5, caixa.y + 5);
    await p.mouse.down();
    const pressionado = (await cores(alvo)).fundo;
    await p.mouse.up();
    expect(pressionado, `${rota} ${seletor}`).not.toBe(antes);
  }
  await ctx.close();
});

test("C42: em 390 px, os links de navegação têm pelo menos 44 px de altura", async ({ page }) => {
  const medir = async (seletor: string, rota: string) => {
    const alturas = await page.locator(seletor).evaluateAll((els) => els.map((e) => [e.textContent!.trim(), e.getBoundingClientRect().height] as const));
    expect(alturas.length, `${rota} ${seletor}`).toBeGreaterThan(0);
    for (const [texto, h] of alturas) expect(h, `${rota}: "${texto}"`).toBeGreaterThanOrEqual(44);
  };
  for (const rota of ["/tema/saude", "/semelhancas", "/diferencas", "/sobre", "/metodologia"]) {
    await abrir(page, rota, 390, 844);
    await medir("main a.voltar", rota);
    await medir("footer a", rota);
  }
  for (const rota of ["/semelhancas", "/diferencas"]) {
    await abrir(page, rota, 390, 844);
    await medir("main section[data-tema] > h2 a", rota);
  }
  await abrir(page, "/sobre", 390, 844);
  await medir("main a", "/sobre");
});

test("C43: em 1366 px, o texto corrido tem no máximo 68ch", async ({ page }) => {
  for (const [rota, seletor] of [
    ["/", ".abertura"],
    ["/metodologia", "main p"],
    ["/sobre", "main p"],
  ]) {
    await abrir(page, rota, 1366);
    const medidas = await page.locator(seletor).evaluateAll((els) =>
      els.map((el) => {
        const zero = document.createElement("span");
        zero.textContent = "0";
        zero.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap";
        el.append(zero);
        const ch = zero.getBoundingClientRect().width;
        zero.remove();
        return { largura: el.getBoundingClientRect().width, limite: 68 * ch };
      }),
    );
    expect(medidas.length, rota).toBeGreaterThan(0);
    for (const m of medidas) expect(m.largura, rota).toBeLessThanOrEqual(m.limite + 1);
  }
});

test("C44: em 1366 px, a faixa do aviso ocupa a janela e o texto começa no x do título", async ({ page }) => {
  for (const rota of ["/", "/tema/saude"]) {
    await abrir(page, rota, 1366);
    const faixa = (await page.locator(".faixa-aviso").boundingBox())!;
    const janela = await page.evaluate(() => window.innerWidth);
    expect(Math.abs(faixa.width - janela), rota).toBeLessThanOrEqual(1);
    const inicio = (await page.locator(".faixa-aviso .aviso > *").first().boundingBox())!.x;
    const h1 = (await page.locator("h1").boundingBox())!.x;
    expect(Math.abs(inicio - h1), rota).toBeLessThanOrEqual(1);
  }
});

test("C45: em 1366×900, numa página curta, o rodapé termina no fim da janela", async ({ page }) => {
  await abrir(page, "/rota-que-nao-existe", 1366, 900);
  const rodape = (await page.locator("footer").boundingBox())!;
  expect(Math.abs(rodape.y + rodape.height - 900)).toBeLessThanOrEqual(1);
});

test("C46: títulos com text-wrap balance, parágrafos com pretty, e espaço não separável onde não pode quebrar", async ({ page }) => {
  await abrir(page, "/tema/saude");
  await abrirTudo(page);
  const quebra = await page.evaluate(() => {
    const estilo = (e: Element) => {
      const s = getComputedStyle(e) as CSSStyleDeclaration & { textWrapStyle?: string };
      return s.textWrapStyle || s.getPropertyValue("text-wrap");
    };
    return {
      titulos: [...document.querySelectorAll("h1, h2, h3")].map(estilo),
      paragrafos: [...document.querySelectorAll("main p")].map(estilo),
    };
  });
  for (const t of quebra.titulos) expect(t).toContain("balance");
  for (const p of quebra.paragrafos) expect(p).toContain("pretty");
  const paginas = await page.locator(".origem .pagina").allTextContents();
  expect(paginas.length).toBeGreaterThan(0);
  for (const t of paginas) expect(t).toMatch(/^pág\.\xa0\d+$/);
  const nomes = await page.locator(".cand").allTextContents();
  expect(nomes.length).toBeGreaterThan(0);
  for (const n of nomes) expect(n).toMatch(/^(Lula|Flávio Bolsonaro)\xa0\((PT|PL)\)$/);
  await abrir(page, "/");
  expect(await page.locator(".abertura").textContent()).toContain("2º\xa0turno");
  // o texto corrido do crit. 43 também quebra com pretty: a abertura de / e os parágrafos de /metodologia e /sobre
  for (const [rota, seletor] of [
    ["/", ".abertura"],
    ["/metodologia", "main p"],
    ["/sobre", "main p"],
  ]) {
    await abrir(page, rota);
    const estilos = await page.locator(seletor).evaluateAll((els) =>
      els.map((e) => {
        const s = getComputedStyle(e) as CSSStyleDeclaration & { textWrapStyle?: string };
        return s.textWrapStyle || s.getPropertyValue("text-wrap");
      }),
    );
    expect(estilos.length, rota).toBeGreaterThan(0);
    for (const p of estilos) expect(p, rota).toContain("pretty");
  }
});

test("C47: o selo de cada omissão diz de qual plano ela é, igual para os dois candidatos", async ({ page }) => {
  for (const rota of ["/tema/saude", "/diferencas"]) {
    await abrir(page, rota);
    const selos = await page.locator("li.omissao").evaluateAll((els) => els.map((li) => [li.getAttribute("data-cand"), li.querySelector(".selo")!.textContent ?? ""]));
    expect(selos.length, rota).toBeGreaterThan(0);
    for (const [c, s] of selos) {
      expect(normal(s!), rota).toBe(`Omissão · só no plano de ${c === "lula" ? "Lula (PT)" : "Flávio Bolsonaro (PL)"}`);
    }
  }
  expect(comparacao("saude").omissoes.length).toBeGreaterThan(0);
});

test("C48: theme-color do papel, favicon SVG do próprio domínio e nenhum pedido de /favicon.ico", async ({ page }) => {
  const ico: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/favicon.ico") ico.push(r.url());
  });
  for (const rota of ROTAS) {
    await page.goto(rota);
    await page.waitForLoadState("networkidle");
    await expect(page.locator('meta[name="theme-color"]'), rota).toHaveAttribute("content", "#faf7f1");
    await expect(page.locator('link[rel="icon"]'), rota).toHaveAttribute("href", "/favicon.svg");
  }
  const r = await page.request.get("/favicon.svg");
  expect(r.status()).toBe(200);
  expect(r.headers()["content-type"]).toContain("image/svg+xml");
  expect(ico).toEqual([]);
});

test("C49: Permissions-Policy sem interest-cohort no _headers e na resposta", async ({ request }) => {
  const headers = readFileSync(resolve(import.meta.dirname, "..", "dist-teste", "_headers"), "utf8");
  const linha = headers.split("\n").find((l) => l.trim().startsWith("Permissions-Policy:"));
  expect(linha).toBeTruthy();
  expect(linha).not.toContain("interest-cohort");
  const r = await request.get("/");
  expect(r.headers()["permissions-policy"]).toBeTruthy();
  expect(r.headers()["permissions-policy"]).not.toContain("interest-cohort");
});

