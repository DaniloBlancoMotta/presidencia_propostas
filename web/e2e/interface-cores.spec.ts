// S7 da feature interface-site: a área de cada candidato no tom do próprio PDF; concordância em verde.
// Os valores esperados vêm de elementos de sonda com a variável do token, nunca de literais copiados.
import { expect, test, type Page } from "@playwright/test";
import { comparacao } from "./apoio";

const CANDS = ["lula", "flavio-bolsonaro"] as const;

/** Cor calculada de um token, lida de uma sonda com `color: var(--<nome>)`. */
function token(page: Page, nome: string) {
  return page.evaluate((n) => {
    const d = document.createElement("div");
    d.style.color = `var(--${n})`;
    document.body.append(d);
    const v = getComputedStyle(d).color;
    d.remove();
    return v;
  }, nome);
}

async function estilo(page: Page, seletor: string) {
  return page.locator(seletor).evaluateAll((els) =>
    els.map((el) => {
      const s = getComputedStyle(el);
      return {
        cand: el.getAttribute("data-cand"),
        fundo: s.backgroundColor,
        topo: s.borderTopWidth,
        corTopo: s.borderTopColor,
        baixo: s.borderBottomWidth,
        corBaixo: s.borderBottomColor,
      };
    }),
  );
}

async function abrir(page: Page, rota: string, largura = 1366) {
  await page.setViewportSize({ width: largura, height: 900 });
  await page.goto(rota);
  await page.waitForLoadState("networkidle");
}

async function abrirTudo(page: Page) {
  for (const s of await page.locator("summary:visible").all()) await s.click();
}

test("C54: coluna, cartão de /sobre, aba e omissão no tom do candidato", async ({ page }) => {
  await abrir(page, "/tema/saude");
  for (const c of CANDS) {
    const [col] = await estilo(page, `[data-lista="resumo"] [id="painel-${c}"]`);
    expect(col.fundo).toBe(await token(page, `tom-${c}`));
    expect(col.topo).toBe("6px");
    expect(col.corTopo).toBe(await token(page, `cand-${c}`));
  }
  const omissoes = await estilo(page, '[data-lista="omissoes"] li[data-cand]');
  expect(omissoes).toHaveLength(comparacao("saude").omissoes.length);
  for (const o of omissoes) expect(o.fundo).toBe(await token(page, `tom-${o.cand}`));

  await abrir(page, "/sobre");
  for (const c of CANDS) {
    const [cartao] = await estilo(page, `.fontes > li[data-cand="${c}"]`);
    expect(cartao.fundo).toBe(await token(page, `tom-${c}`));
    expect(cartao.topo).toBe("6px");
    expect(cartao.corTopo).toBe(await token(page, `cand-${c}`));
  }

  await abrir(page, "/tema/saude", 390);
  for (let i = 0; i < 2; i++) {
    const aba = page.getByRole("tab").nth(i);
    await aba.click();
    const [s] = await estilo(page, '[role="tab"][aria-selected="true"]');
    expect(s.fundo).toBe(await token(page, `tom-${s.cand}`));
    expect(s.topo).toBe("4px");
    expect(s.corTopo).toBe(await token(page, `cand-${s.cand}`));
    expect(s.baixo === "0px" || s.corBaixo === "rgba(0, 0, 0, 0)").toBe(true);
  }
});

test("C55: cor plena nunca em texto; fio de 3 px de cada lado; quadradinho sem texto na cor do candidato", async ({ page }) => {
  for (const rota of ["/", "/tema/saude", "/semelhancas", "/diferencas", "/sobre"]) {
    await abrir(page, rota);
    await abrirTudo(page);
    const proibidas = [await token(page, "cand-lula"), await token(page, "cand-flavio-bolsonaro"), await token(page, "semelhanca")];
    const emTexto = await page.evaluate((cores) => {
      const achados: string[] = [];
      for (const el of document.querySelectorAll("body *")) {
        if (el.closest('[aria-hidden="true"]')) continue;
        const proprio = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim());
        const r = el.getBoundingClientRect();
        if (!proprio || r.width === 0 || r.height === 0) continue;
        if (cores.includes(getComputedStyle(el).color)) achados.push(`${el.tagName}.${el.className}: ${el.textContent!.trim().slice(0, 30)}`);
      }
      return achados;
    }, proibidas);
    expect(emTexto, rota).toEqual([]);

    const quadradinhos = await page.locator(".cand").evaluateAll((els) =>
      els.map((el) => {
        const s = getComputedStyle(el, "::before");
        return { cand: el.getAttribute("data-cand"), conteudo: s.content, fundo: s.backgroundColor };
      }),
    );
    if (rota !== "/") expect(quadradinhos.length, rota).toBeGreaterThan(0);
    for (const q of quadradinhos) {
      expect(q.conteudo === '""' || q.conteudo === "''", rota).toBe(true);
      expect(q.fundo, rota).toBe(await token(page, `cand-${q.cand}`));
    }
  }
  await abrir(page, "/tema/saude");
  await abrirTudo(page);
  const lados = await estilo(page, ".lado[data-cand]");
  expect(lados.length).toBeGreaterThan(0);
  for (const l of lados) {
    expect(l.topo).toBe("3px");
    expect(l.corTopo).toBe(await token(page, `cand-${l.cand}`));
  }
});

test("C57: em qualquer ordem, e depois de trocar, cada cor e cada tom ficam com o seu candidato", async ({ page }) => {
  for (const sorteio of [0.1, 0.9]) {
    await page.addInitScript((v) => {
      Math.random = () => v;
    }, sorteio);
    await abrir(page, "/tema/saude");
    for (let rodada = 0; rodada < 2; rodada++) {
      await abrirTudo(page);
      const errados = await page.evaluate(() => {
        const raiz = getComputedStyle(document.documentElement);
        const saida: string[] = [];
        for (const el of document.querySelectorAll("[data-cand]")) {
          const c = el.getAttribute("data-cand");
          const s = getComputedStyle(el);
          if (s.getPropertyValue("--cor-cand").trim() !== raiz.getPropertyValue(`--cand-${c}`).trim()) saida.push(`${el.className} cor`);
          if (s.getPropertyValue("--tom-cand").trim() !== raiz.getPropertyValue(`--tom-${c}`).trim()) saida.push(`${el.className} tom`);
        }
        return saida;
      });
      expect(errados, `sorteio ${sorteio}, rodada ${rodada}`).toEqual([]);
      for (const c of CANDS) {
        const [col] = await estilo(page, `[data-lista="resumo"] [id="painel-${c}"]`);
        expect(col.fundo).toBe(await token(page, `tom-${c}`));
      }
      await page.getByRole("button", { name: "Trocar ordem dos candidatos" }).click();
    }
  }
});

test("C58: Semelhanças em verde; Diferenças e Omissões em grafite, sem tom", async ({ page }) => {
  await abrir(page, "/");
  const sem = page.locator('nav[aria-label="Temas"] a[href="/semelhancas"]');
  const [destaque] = await sem.evaluateAll((els) =>
    els.map((el) => ({ s: getComputedStyle(el), g: getComputedStyle(el.querySelector("svg")!) })).map(({ s, g }) => ({
      fundo: s.backgroundColor, topo: s.borderTopWidth, corTopo: s.borderTopColor, glifo: g.color,
    })),
  );
  const verde = await token(page, "semelhanca");
  expect(destaque).toEqual({ fundo: await token(page, "tom-semelhanca"), topo: "4px", corTopo: verde, glifo: verde });

  await abrir(page, "/tema/saude");
  const [secSem] = await estilo(page, '[data-lista="semelhancas"]');
  expect(secSem.fundo).toBe(await token(page, "tom-semelhanca"));
  expect(secSem.topo).toBe("6px");
  expect(secSem.corTopo).toBe(verde);
  expect(await page.locator('[data-lista="semelhancas"] h2 svg').evaluate((el) => getComputedStyle(el).color)).toBe(verde);
  const grafite = await token(page, "tinta-2");
  const [secDif] = await estilo(page, '[data-lista="diferencas"]');
  expect(secDif.fundo).toBe("rgba(0, 0, 0, 0)");
  expect(secDif.corTopo).toBe(grafite);
  expect(await page.locator('[data-lista="diferencas"] h2 svg').evaluate((el) => getComputedStyle(el).color)).toBe(grafite);
  const [secOmi] = await estilo(page, '[data-lista="omissoes"]');
  expect(secOmi.fundo).toBe("rgba(0, 0, 0, 0)");
  expect(await page.locator('[data-lista="omissoes"] h2').evaluate((el) => getComputedStyle(el).borderBottomColor)).toBe(grafite);

  await abrir(page, "/semelhancas");
  const grupos = await estilo(page, "main section[data-tema]");
  expect(grupos.length).toBeGreaterThan(0);
  for (const g of grupos) {
    expect(g.fundo).toBe(await token(page, "tom-semelhanca"));
    expect(g.topo).toBe("6px");
    expect(g.corTopo).toBe(verde);
  }
});
