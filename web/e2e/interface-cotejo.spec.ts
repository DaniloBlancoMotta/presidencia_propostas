// S8 da feature interface-site: direção visual "cotejo" — papel, tinta, fios, tipografia e movimento.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { ROTAS_SITE, VISUALIZADOR, abrir, abrirTudo, hidratado, token } from "./interface-apoio";

const semAspas = (familia: string) => familia.replace(/["']/g, "");

test("C60: Newsreader nos títulos e citações, Atkinson no texto, servidas de /fontes/ com swap e um só preload", async ({ page, baseURL }) => {
  const fontes: string[] = [];
  page.on("request", (r) => {
    if (r.resourceType() === "font") fontes.push(r.url());
  });
  await abrir(page, "/tema/saude");
  await page.locator(".item summary").first().click();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const familias = await page.evaluate(() => ({
    h1: getComputedStyle(document.querySelector("h1")!).fontFamily,
    trecho: getComputedStyle(document.querySelector(".trecho")!).fontFamily,
    body: getComputedStyle(document.body).fontFamily,
    exibicao: [...document.fonts].map((f) => f.display),
  }));
  expect(semAspas(familias.h1)).toMatch(/^Newsreader/);
  expect(semAspas(familias.trecho)).toMatch(/^Newsreader/);
  expect(semAspas(familias.body)).toMatch(/^Atkinson Hyperlegible Next/);
  expect(familias.exibicao.length).toBeGreaterThanOrEqual(3);
  for (const d of familias.exibicao) expect(d).toBe("swap");
  expect(fontes.length).toBeGreaterThan(0);
  for (const f of fontes) {
    expect(new URL(f).origin).toBe(new URL(baseURL!).origin);
    expect(new URL(f).pathname).toMatch(/^\/fontes\/[\w-]+\.woff2$/);
  }
  const preloads = await page.locator('link[rel="preload"][as="font"]').evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  expect(preloads).toHaveLength(1);
  expect(preloads[0]).toMatch(/^\/fontes\/atkinson-hyperlegible-next/);
  const pacote = JSON.parse(readFileSync(resolve(import.meta.dirname, "..", "package.json"), "utf8"));
  const deps = { ...pacote.dependencies, ...pacote.devDependencies };
  expect(deps["@fontsource-variable/newsreader"]).toBe("5.3.0");
  expect(deps["@fontsource-variable/atkinson-hyperlegible-next"]).toBe("5.3.0");
});

test("C62: sem sombra nem gradiente, sem borda lateral grossa em elemento arredondado, fios de 1 e 2 px, faixas de 6 px só nas áreas", async ({ page }) => {
  test.setTimeout(180_000); // percorre todas as rotas com tudo aberto
  for (const rota of ["/", "/tema/saude", "/semelhancas", "/diferencas", "/sobre", "/chat", VISUALIZADOR]) {
    await abrir(page, rota);
    await abrirTudo(page);
    const r = await page.evaluate(() => {
      const achados: string[] = [];
      const seis: string[] = [];
      for (const el of document.querySelectorAll("body, body *")) {
        const s = getComputedStyle(el);
        const nome = `${el.tagName}.${(el.getAttribute("class") ?? "").trim()}`;
        if (s.boxShadow !== "none") achados.push(`sombra ${nome}`);
        if (/gradient/.test(s.backgroundImage)) achados.push(`gradiente ${nome}`);
        const raio = [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomLeftRadius, s.borderBottomRightRadius].some((v) => parseFloat(v) > 0);
        if (raio && (parseFloat(s.borderLeftWidth) >= 2 || parseFloat(s.borderRightWidth) >= 2)) achados.push(`borda lateral ${nome}`);
        const lados = [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth];
        if (lados.includes("6px")) seis.push(el.matches('.painel, .fonte, [data-lista="semelhancas"], .grupo-sem, [data-lista="diferencas"]') ? "" : nome);
      }
      return {
        achados,
        seis: seis.filter(Boolean),
        itens: [...document.querySelectorAll(".itens > li")].map((li) => getComputedStyle(li).borderBottomWidth),
        secoes: [...document.querySelectorAll(".bloco > h2")].map((h) => getComputedStyle(h).borderBottomWidth),
      };
    });
    expect(r.achados, rota).toEqual([]);
    expect(r.seis, rota).toEqual([]);
    for (const b of r.itens) expect(b, rota).toBe("1px");
    for (const b of r.secoes) expect(b, rota).toBe("2px");
    if (rota === "/tema/saude" || rota === "/diferencas") {
      expect(r.itens.length, rota).toBeGreaterThan(0);
      expect(r.secoes.length, rota).toBeGreaterThan(0);
    }
  }
});

test("C63: só os tamanhos 13, 15, 17 e 21 px, e o título de página entre 36 e 60 px", async ({ page }) => {
  test.setTimeout(180_000); // percorre todas as rotas com tudo aberto
  for (const largura of [390, 1366]) {
    for (const rota of ROTAS_SITE) {
      await abrir(page, rota, largura);
      await abrirTudo(page);
      const fora = await page.evaluate(() => {
        const saida: string[] = [];
        for (const el of document.querySelectorAll("body *")) {
          if (el.closest('[aria-hidden="true"]')) continue;
          const proprio = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim());
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          if (!proprio || r.width === 0 || r.height === 0 || s.visibility === "hidden") continue;
          const px = Math.round(parseFloat(s.fontSize) * 100) / 100;
          const ok = el.tagName === "H1" ? px >= 36 && px <= 60 : [13, 15, 17, 21].includes(px);
          if (!ok) saida.push(`${el.tagName}.${el.getAttribute("class") ?? ""} ${px}px "${el.textContent!.trim().slice(0, 30)}"`);
        }
        return saida;
      });
      expect(fora, `${largura} ${rota}`).toEqual([]);
    }
  }
});

test("C64: itens numerados 01, 02… em algarismos tabulares; citação em Newsreader itálico com as aspas na cor do candidato", async ({ page }) => {
  for (const rota of ["/tema/saude", "/semelhancas", "/diferencas"]) {
    await abrir(page, rota);
    await abrirTudo(page);
    const listas = await page.locator("ol.itens, ul.itens").evaluateAll((els) =>
      els.map((l) =>
        [...l.children].map((li) => {
          const n = li.querySelector(":scope > details > summary > .num");
          return n ? { texto: n.textContent, numeros: getComputedStyle(n).fontVariantNumeric } : null;
        }),
      ),
    );
    expect(listas.length, rota).toBeGreaterThan(0);
    for (const l of listas) {
      l.forEach((n, i) => {
        expect(n, rota).not.toBeNull();
        expect(n!.texto, rota).toBe(String(i + 1).padStart(2, "0"));
        expect(n!.numeros, rota).toContain("tabular-nums");
      });
    }
    const trechos = await page.locator(".trecho").evaluateAll((els) =>
      els.map((t) => ({
        familia: getComputedStyle(t).fontFamily,
        estilo: getComputedStyle(t).fontStyle,
        aspas: getComputedStyle(t.querySelector(".aspas")!).color,
        textoAspas: t.querySelector(".aspas")!.textContent,
        cand: t.closest("[data-cand]")!.getAttribute("data-cand"),
      })),
    );
    expect(trechos.length, rota).toBeGreaterThan(0);
    const cor = { lula: await token(page, "cand-lula"), "flavio-bolsonaro": await token(page, "cand-flavio-bolsonaro") };
    for (const t of trechos) {
      expect(semAspas(t.familia), rota).toMatch(/^Newsreader/);
      expect(t.estilo, rota).toBe("italic");
      expect(t.textoAspas, rota).toBe("“");
      expect(t.aspas, rota).toBe(cor[t.cand as keyof typeof cor]);
    }
  }
});

test("C65: Semelhanças com o glifo = verde e Diferenças com ≠ grafite, em SVG", async ({ page }) => {
  const IGUAL = "M5 9h14M5 15h14";
  const DIFERENTE = "M5 9h14M5 15h14M16 5 8 19";
  for (const [rota, sem, dif] of [
    ["/", ".destaque.sem svg", ".destaque.dif svg"],
    ["/tema/saude", '[data-lista="semelhancas"] > h2 svg', '[data-lista="diferencas"] > h2 svg'],
  ]) {
    await abrir(page, rota);
    const verde = await token(page, "semelhanca");
    const grafite = await token(page, "tinta-2");
    for (const [seletor, caminho, cor] of [
      [sem, IGUAL, verde],
      [dif, DIFERENTE, grafite],
    ]) {
      const g = page.locator(seletor);
      await expect(g, `${rota} ${seletor}`).toHaveCount(1);
      expect(await g.evaluate((s) => s.querySelector("path")!.getAttribute("d")), rota).toBe(caminho);
      expect(await g.evaluate((s) => getComputedStyle(s).color), rota).toBe(cor);
    }
  }
});

test("C66: abrir um item anima o conteúdo em 260 ms só com opacidade e deslocamento; item que chega aberto não anima", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await abrir(page, "/tema/saude");
  await hidratado(page);
  const item = page.locator(".item").first();
  await item.locator("summary").click();
  const anim = await item.locator(".corpo").evaluate((c) => ({ nome: getComputedStyle(c).animationName, duracao: getComputedStyle(c).animationDuration }));
  expect(anim.duracao).toBe("0.26s");
  const quadros = await page.evaluate((nome) => {
    const props = new Set<string>();
    let achou = false;
    for (const folha of document.styleSheets) {
      for (const regra of folha.cssRules) {
        if (regra instanceof CSSKeyframesRule && regra.name === nome) {
          achou = true;
          for (const q of regra.cssRules) for (const p of (q as CSSKeyframeRule).style) props.add(p);
        }
      }
    }
    return achou ? [...props].sort() : null;
  }, anim.nome);
  expect(quadros).not.toBeNull();
  expect(quadros!.length).toBeGreaterThan(0);
  for (const p of quadros!) expect(["opacity", "transform"]).toContain(p);

  // o mesmo item chegando aberto no HTML
  await page.route("**/tema/saude", async (r) => {
    const resp = await r.fetch();
    const html = (await resp.text()).replace("<details>", "<details open>");
    await r.fulfill({ response: resp, body: html });
  });
  await page.goto("/tema/saude");
  await hidratado(page);
  await page.waitForTimeout(400);
  const aberto = page.locator("details[open]").first();
  await expect(aberto).toHaveCount(1);
  expect(await aberto.locator(".corpo").evaluate((c) => getComputedStyle(c).animationName)).toBe("none");
});

test("C67: com movimento reduzido, nada anima nem tem transição", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  await page.goto("/tema/saude");
  await page.waitForLoadState("networkidle");
  const item = page.locator(".item").first();
  await item.locator("summary").click();
  expect(await item.locator(".corpo").evaluate((c) => getComputedStyle(c).animationName)).toBe("none");
  const comTransicao = await page.evaluate(() =>
    [...document.querySelectorAll("*")]
      .filter((el) => getComputedStyle(el).transitionDuration.split(",").some((d) => parseFloat(d) > 0))
      .map((el) => el.tagName),
  );
  expect(comTransicao).toEqual([]);
  await ctx.close();
});

test("C68: filtros como controle segmentado em tinta; Trocar ordem como botão de texto com ícone", async ({ page }) => {
  await abrir(page, "/tema/saude");
  await hidratado(page);
  const tinta = await token(page, "tinta");
  const papel = await token(page, "papel");
  const grupo = page.getByRole("group", { name: "Filtrar itens do tema" });
  await expect(grupo.getByRole("button")).toHaveText(["Só semelhanças", "Só diferenças", "Mostrar tudo"]);
  for (const b of await grupo.getByRole("button").all()) {
    const s = await b.evaluate((el) => ({ fundo: getComputedStyle(el).backgroundColor, cor: getComputedStyle(el).color, pressionado: el.getAttribute("aria-pressed") }));
    if (s.pressionado === "true") expect(s).toEqual({ fundo: tinta, cor: papel, pressionado: "true" });
    else expect(s).toEqual({ fundo: "rgba(0, 0, 0, 0)", cor: tinta, pressionado: "false" });
  }
  const trocar = page.getByRole("button", { name: "Trocar ordem dos candidatos", exact: true });
  await expect(trocar).toHaveText("Trocar ordem dos candidatos");
  const t = await trocar.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      tag: el.tagName,
      svg: el.querySelectorAll("svg").length,
      bordas: [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth],
      fundo: s.backgroundColor,
    };
  });
  expect(t).toEqual({ tag: "BUTTON", svg: 1, bordas: ["0px", "0px", "0px", "0px"], fundo: "rgba(0, 0, 0, 0)" });
});

test("C69: nenhuma seta ou glifo fora das fontes como texto; Ver no PDF e Todos os temas sem seta no nome", async ({ page }) => {
  test.setTimeout(180_000); // percorre todas as rotas com tudo aberto
  for (const rota of [...ROTAS_SITE, VISUALIZADOR]) {
    await abrir(page, rota);
    await abrirTudo(page);
    const texto = await page.evaluate(() => document.body.innerText);
    for (const g of ["≠", "←", "→", "▸", "▾"]) expect(texto.includes(g), `${rota} ${g}`).toBe(false);
  }
  await abrir(page, "/tema/saude");
  await abrirTudo(page);
  const ver = page.getByRole("link", { name: /Ver no PDF/ });
  expect(await ver.count()).toBeGreaterThan(0);
  for (const l of await ver.all()) await expect(l).toHaveAccessibleName(/^[^←→]+$/);
  await expect(page.getByRole("link", { name: "Todos os temas", exact: true })).toHaveAccessibleName("Todos os temas");
});

test("C70: citações nunca hifenizadas; texto dos itens hifenizado só abaixo de 340 px", async ({ page }) => {
  for (const largura of [160, 339, 390, 1366]) {
    await abrir(page, "/tema/saude", largura);
    await abrirTudo(page);
    const hifens = await page.locator(".trecho").evaluateAll((els) => els.map((e) => getComputedStyle(e).hyphens));
    expect(hifens.length).toBeGreaterThan(0);
    for (const h of hifens) expect(h, `${largura}`).not.toBe("auto");
  }
  for (const [largura, esperado] of [
    [339, true],
    [340, false],
  ] as const) {
    await abrir(page, "/tema/saude", largura);
    const hifens = await page.locator(".texto-item").evaluateAll((els) => els.map((e) => getComputedStyle(e).hyphens));
    for (const h of hifens) expect(h === "auto", `${largura}`).toBe(esperado);
  }
});

test("C71: listas sem marcador continuam listas, e os números dos itens ficam fora do leitor de tela", async ({ page }) => {
  test.setTimeout(180_000); // percorre todas as rotas com tudo aberto
  for (const rota of ROTAS_SITE) {
    await abrir(page, rota);
    await abrirTudo(page);
    const r = await page.evaluate(() => ({
      semPapel: [...document.querySelectorAll("ul, ol")]
        .filter((l) => getComputedStyle(l).listStyleType === "none" && l.getAttribute("role") !== "list")
        .map((l) => `${l.tagName}.${l.getAttribute("class") ?? ""}`),
      numeros: [...document.querySelectorAll(".num")].map((n) => n.getAttribute("aria-hidden")),
    }));
    expect(r.semPapel, rota).toEqual([]);
    for (const n of r.numeros) expect(n, rota).toBe("true");
  }
});
