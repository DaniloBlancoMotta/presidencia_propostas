// S2 da feature interface-site: o início diz quem está sendo comparado; títulos, aviso e rodapé de toda rota.
import { expect, test, type Page } from "@playwright/test";
import { AVISO, dataColeta, publicados, temas } from "./apoio";
import { NOMES, ROTAS_SITE, VISUALIZADOR, abrir, fixarSorteio, normal } from "./interface-apoio";

type Caixa = { x: number; y: number; width: number; height: number };

async function caixas(page: Page, seletor: string): Promise<Caixa[]> {
  return page.locator(seletor).evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    }),
  );
}

/** Agrupa caixas em linhas pelo topo (±1 px). */
function linhas(cs: Caixa[]): Caixa[][] {
  const saida: Caixa[][] = [];
  for (const c of cs) {
    const l = saida.find((x) => Math.abs(x[0].y - c.y) <= 1);
    if (l) l.push(c);
    else saida.push([c]);
  }
  return saida;
}

test("C12: a abertura nomeia os dois candidatos na ordem vigente", async ({ page }) => {
  for (const [sorteio, a, b] of [
    [0.1, "Flávio Bolsonaro (PL)", "Lula (PT)"],
    [0.9, "Lula (PT)", "Flávio Bolsonaro (PL)"],
  ] as const) {
    await fixarSorteio(page, sorteio);
    await abrir(page, "/");
    const texto = await page.locator(".abertura").evaluate((el) => (el as HTMLElement).innerText);
    expect(normal(texto)).toBe(
      `Planos de governo de ${a} e ${b}, candidatos ao 2º turno de 2026, registrados no TSE. Escolha um tema para comparar o que cada plano propõe, com o trecho e a página do PDF original.`,
    );
  }
});

test("C13: em 1366 e 480 px, os destaques dividem uma linha e os 8 temas ficam em 2 linhas de 4", async ({ page }) => {
  for (const largura of [1366, 480]) {
    await abrir(page, "/", largura);
    const [sem, dif] = await caixas(page, ".destaques > li");
    const grade = (await caixas(page, ".destaques"))[0];
    const espaco = await page.locator(".destaques").evaluate((e) => parseFloat(getComputedStyle(e).columnGap) || 0);
    expect(Math.abs(sem.y - dif.y), `${largura}`).toBeLessThanOrEqual(1);
    expect(Math.abs(sem.width - dif.width), `${largura}`).toBeLessThanOrEqual(1);
    expect(Math.abs(sem.width + dif.width - (grade.width - espaco)), `${largura}`).toBeLessThanOrEqual(1);
    const temas = await caixas(page, ".indice > li");
    expect(temas).toHaveLength(8);
    expect(linhas(temas).map((l) => l.length), `${largura}`).toEqual([4, 4]);
  }
});

test("C14: em 390 px, 2 temas por linha com o ícone ao lado do rótulo; abaixo de 340 px, 1 por linha; 160 px sem rolagem lateral", async ({ page }) => {
  await abrir(page, "/", 390, 844);
  const temas = await caixas(page, ".indice > li");
  expect(linhas(temas).map((l) => l.length)).toEqual([2, 2, 2, 2]);
  for (const a of await page.locator(".indice a").all()) {
    const d = await a.evaluate((el) => {
      const i = el.querySelector("svg")!.getBoundingClientRect();
      const r = el.querySelector(".nome")!;
      const t = r.getBoundingClientRect();
      return { icone: i.y + i.height / 2, rotulo: t.y + t.height / 2, hifens: getComputedStyle(r).hyphens };
    });
    expect(Math.abs(d.icone - d.rotulo)).toBeLessThanOrEqual(4);
    expect(d.hifens).not.toBe("auto");
  }
  await abrir(page, "/", 339, 844);
  expect(linhas(await caixas(page, ".indice > li")).every((l) => l.length === 1)).toBe(true);
  const [sem, dif] = await caixas(page, ".destaques > li");
  expect(dif.y).toBeGreaterThanOrEqual(sem.y + sem.height - 1);
  expect(Math.abs(dif.x - sem.x)).toBeLessThanOrEqual(1);
  await abrir(page, "/", 160, 700);
  const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(sw).toBeLessThanOrEqual(cw);
});

test("C15: os cartões de uma mesma linha da grade têm a mesma altura", async ({ page }) => {
  for (const largura of [1366, 390]) {
    await abrir(page, "/", largura);
    for (const seletor of [".destaques a", ".indice a"]) {
      for (const l of linhas(await caixas(page, seletor))) {
        for (const c of l) expect(Math.abs(c.height - l[0].height), `${largura} ${seletor}`).toBeLessThanOrEqual(1);
      }
    }
  }
});

test("C16: cada rota abre com o próprio título e o aviso logo abaixo, sem barra de marca", async ({ page }) => {
  for (const rota of ROTAS_SITE) {
    await abrir(page, rota);
    expect(await page.locator(".marca").count(), rota).toBe(0);
    const r = await page.evaluate(() => {
      const main = document.querySelector("main")!;
      const h1 = main.querySelector("h1")!;
      const faixa = main.querySelector(".faixa-aviso")!;
      const aviso = main.querySelector(".aviso-ia")!;
      const antes = (a: Node, b: Node) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      const descreve = (e: Element) => `${e.tagName}.${e.getAttribute("class") ?? ""} "${(e.textContent ?? "").trim().slice(0, 30)}"`;
      const doMain = [...main.querySelectorAll("*")];
      // antes do h1, no main: só os contêineres do próprio h1 e o link de voltar (com o que há dentro dele)
      const antesDoH1 = doMain.filter((e) => antes(e, h1) && !e.contains(h1) && !e.closest("a.voltar"));
      // entre o h1 e a faixa do aviso: nada (o aviso é o bloco logo depois do título)
      const entre = doMain.filter((e) => antes(h1, e) && !h1.contains(e) && antes(e, faixa) && !e.contains(faixa));
      // abertura, descrição, data de geração, controles e listas: todos depois do aviso
      const conteudo = [...main.querySelectorAll(".abertura, .descricao, .atualizacao, .lead, .controles, button, ul, ol, p:not(.aviso-ia)")].filter(
        (e) => !faixa.contains(e),
      );
      const links = [...document.querySelectorAll("a")].filter((a) => antes(a, h1));
      links.at(-1)?.setAttribute("data-teste-ultimo", "");
      return {
        h1AntesDoAviso: antes(h1, aviso),
        antesDoH1: antesDoH1.map(descreve),
        voltar: main.querySelectorAll("a.voltar").length,
        entre: entre.map(descreve),
        conteudo: conteudo.length,
        conteudoAntesDoAviso: conteudo.filter((e) => !antes(aviso, e)).map(descreve),
        marcaAntes: links.some((a) => a.textContent!.includes("Compare os planos de governo 2026")),
        href: links.at(-1)?.getAttribute("href") ?? null,
      };
    });
    expect(r.h1AntesDoAviso, rota).toBe(true);
    expect(r.antesDoH1, rota).toEqual([]);
    expect(r.voltar, rota).toBe(rota === "/" ? 0 : 1);
    expect(r.entre, rota).toEqual([]);
    expect(r.conteudo, rota).toBeGreaterThan(0);
    expect(r.conteudoAntesDoAviso, rota).toEqual([]);
    expect(r.marcaAntes, rota).toBe(false);
    if (rota === "/") continue;
    const ultimo = page.locator("[data-teste-ultimo]");
    if (rota === "/chat/conversa") {
      await expect(ultimo, rota).toHaveAccessibleName("Chat por tema");
      expect(r.href, rota).toBe("/chat");
    } else {
      await expect(ultimo, rota).toHaveAccessibleName("Todos os temas");
      expect(r.href, rota).toBe("/");
    }
  }
});

test("C17: rodapé com Chat por tema, Metodologia e Sobre antes da data de coleta; títulos das duas páginas", async ({ page }) => {
  for (const rota of ROTAS_SITE) {
    await abrir(page, rota);
    const rodape = await page.locator("footer").evaluate((f) => {
      const itens = [...f.querySelectorAll("a, p")];
      return itens.map((e) => (e.tagName === "A" ? `a:${e.textContent!.trim()}` : `p:${e.textContent!.trim()}`));
    });
    expect(rodape, rota).toEqual(["a:Chat por tema", "a:Metodologia", "a:Sobre", `p:Documentos coletados do TSE em ${dataColeta()}`]);
    // os três links separados por "·", como no desenho da §6; os separadores aparecem entre os links
    const grupo = await page.locator("footer").evaluate((f) => {
      const a = [...f.querySelectorAll("a")];
      const nav = a[0].parentElement!;
      const seps = [...nav.children].filter((e) => e.tagName !== "A");
      const caixa = (e: Element) => e.getBoundingClientRect();
      return {
        mesmoGrupo: a.every((x) => x.parentElement === nav),
        texto: nav.textContent,
        seps: seps.map((s) => ({ texto: s.textContent!.trim(), visivel: caixa(s).width > 0 && caixa(s).height > 0 })),
        entre: seps.every((s, i) => caixa(a[i]).right <= caixa(s).left + 0.5 && caixa(s).right <= caixa(a[i + 1]).left + 0.5),
      };
    });
    expect(grupo.mesmoGrupo, rota).toBe(true);
    expect(grupo.texto, rota).toBe("Chat por tema · Metodologia · Sobre");
    expect(grupo.seps, rota).toEqual([
      { texto: "·", visivel: true },
      { texto: "·", visivel: true },
    ]);
    expect(grupo.entre, rota).toBe(true);
  }
  await abrir(page, "/metodologia");
  await expect(page.locator("h1")).toHaveText("Metodologia");
  await abrir(page, "/sobre");
  await expect(page.locator("h1")).toHaveText("Sobre");
});

test("C75: o botão Chat por tema continua na tela inicial, fora da grade de temas", async ({ page }) => {
  await abrir(page, "/");
  const chat = page.locator("main a[href='/chat']");
  await expect(chat).toHaveCount(1);
  await expect(chat).toBeVisible();
  await expect(chat).toContainText("Chat por tema");
  expect(await chat.evaluate((a) => !!a.closest('nav[aria-label="Temas"]'))).toBe(false);
});

test("C78: Trocar ordem dos candidatos só nas telas que mostram os dois candidatos", async ({ page }) => {
  const com = [...publicados.map((id) => `/tema/${id}`), "/semelhancas", "/diferencas", "/sobre"];
  const sem = ["/", "/metodologia", "/rota-que-nao-existe", VISUALIZADOR];
  expect(publicados).toHaveLength(8);
  for (const rota of [...com, ...sem]) {
    await abrir(page, rota);
    const trocar = page.getByRole("button", { name: "Trocar ordem dos candidatos", exact: true });
    if (com.includes(rota)) {
      await expect(trocar, rota).toHaveCount(1);
      await expect(trocar, rota).toBeVisible();
    } else {
      await expect(trocar, rota).toHaveCount(0);
      expect(await page.locator("button.trocar").count(), rota).toBe(0);
    }
  }
});

test("C79: em / e no tema, só os acréscimos à §6 que o dono manteve; o aviso com o rótulo fora do texto", async ({ page }) => {
  // "Aviso" fica fora do elemento com o texto do aviso, que continua exato (AC 28)
  for (const rota of ROTAS_SITE) {
    await abrir(page, rota);
    const aviso = await page.locator(".faixa-aviso").evaluate((f) => {
      const texto = f.querySelector(".aviso-ia")!;
      const rotulos = [...f.querySelectorAll(".rotulo")];
      return {
        rotulos: rotulos.map((r) => r.textContent),
        fora: rotulos.every((r) => !texto.contains(r) && !r.contains(texto)),
        texto: texto.textContent,
      };
    });
    expect(aviso, rota).toEqual({ rotulos: ["Aviso"], fora: true, texto: AVISO });
  }

  // títulos (h1 a h6) e rótulos (.rotulo) do main, na ordem do documento
  const titulosERotulos = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("main :is(h1, h2, h3, h4, h5, h6), main .rotulo")].map(
        (e) => `${e.tagName}${e.classList.contains("rotulo") ? ".rotulo" : ""}:${e.textContent!.replace(/\xa0/g, " ").replace(/\s+/g, " ").trim()}`,
      ),
    );

  await abrir(page, "/");
  expect(await titulosERotulos()).toEqual(["H1:Compare os planos de governo", "SPAN.rotulo:Aviso", "H2.rotulo:Temas"]);
  // o h2 "Temas" vem logo antes da grade de temas
  expect(
    await page.locator('nav[aria-label="Temas"] h2').evaluate((h) => ({
      texto: h.textContent,
      depois: h.nextElementSibling?.matches("ul.indice") ?? false,
      temas: h.nextElementSibling?.querySelectorAll("li").length ?? 0,
    })),
  ).toEqual({ texto: "Temas", depois: true, temas: 8 });

  const nomes = Object.values(NOMES) as string[];
  for (const id of publicados) {
    const rota = `/tema/${id}`;
    await abrir(page, rota);
    const rotulo = temas.find((t) => t.id === id)!.rotulo;
    const fora = (await titulosERotulos()).filter((t) => {
      if (t === `H1:${rotulo}` || t === "SPAN.rotulo:Aviso" || t === "H2:O que cada plano propõe") return false;
      if (/^H2:(Semelhanças|Diferenças|Omissões) \(\d+\)$/.test(t)) return false;
      if (t.startsWith("H3:") && nomes.includes(t.slice(3))) return false;
      return true;
    });
    expect(fora, rota).toEqual([]);
    // o h2 "O que cada plano propõe" antecede abas e colunas
    const ordem = await page.locator('[data-lista="resumo"]').evaluate((s) => {
      const h2 = s.querySelector("h2")!;
      const antes = (a: Node, b: Node) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      const abas = s.querySelector('[role="tablist"]')!;
      const colunas = s.querySelector(".colunas")!;
      return { texto: h2.textContent, antesDasAbas: antes(h2, abas), antesDasColunas: antes(h2, colunas) };
    });
    expect(ordem, rota).toEqual({ texto: "O que cada plano propõe", antesDasAbas: true, antesDasColunas: true });
  }
});
