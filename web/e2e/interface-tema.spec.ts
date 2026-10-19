// S1 da feature interface-site: a tela de tema igual ao desenho e estável desde a primeira pintura.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { comparacao, publicados } from "./apoio";
import { ROTAS_SITE, abrir, abrirTudo, fixarSorteio, hidratado, normal, token } from "./interface-apoio";
import type { Citacao, Comparacao } from "../src/tipos";

const ESTILOS_ABA = ["backgroundColor", "color", "borderTopColor", "borderTopWidth", "borderBottomColor", "borderBottomWidth", "fontWeight", "fontSize"];

function estiloDe(page: Page, seletor: string) {
  return page.locator(seletor).evaluate((el, props) => {
    const s = getComputedStyle(el) as unknown as Record<string, string>;
    return Object.fromEntries(props.map((p) => [p, s[p]]));
  }, ESTILOS_ABA);
}

/** Grupos de citações consecutivas com o mesmo arquivo e a mesma página. */
function grupos(cs: Citacao[]) {
  let n = 0;
  cs.forEach((c, i) => {
    if (i === 0 || c.arquivo !== cs[i - 1].arquivo || c.pagina !== cs[i - 1].pagina) n++;
  });
  return n;
}

function ordemOmissoes(c: Comparacao, primeiro: string) {
  return [...c.omissoes.filter((o) => o.tratado_por === primeiro), ...c.omissoes.filter((o) => o.tratado_por !== primeiro)].map((o) => o.texto);
}

test("C1: sem o JS, a aba e o painel do candidato que o sorteio pôs primeiro; a hidratação não troca o painel", async ({ browser }) => {
  for (const [sorteio, primeiro, segundo] of [
    [0.9, "lula", "flavio-bolsonaro"],
    [0.1, "flavio-bolsonaro", "lula"],
  ] as const) {
    // depois da hidratação: os estilos da aba com aria-selected="true"
    const depois = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await depois.newPage();
    await fixarSorteio(p, sorteio);
    await p.goto("/tema/saude");
    await hidratado(p);
    await expect(p.locator('[role="tab"][aria-selected="true"]')).toHaveAttribute("data-cand", primeiro);
    const selecionada = await estiloDe(p, '[role="tab"][aria-selected="true"]');
    await depois.close();

    // com /assets/*.js abortado: só o HTML pré-renderizado, o CSS e o script inline do <head>
    const sem = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const q = await sem.newPage();
    await fixarSorteio(q, sorteio);
    await q.route("**/assets/*.js", (r) => r.abort());
    await q.goto("/tema/saude");
    await expect(q.locator("html")).toHaveAttribute("data-ordem", sorteio > 0.5 ? "ba" : "ab");
    await expect(q.locator(`.painel[data-cand="${primeiro}"]`)).toBeVisible();
    await expect(q.locator(`.painel[data-cand="${segundo}"]`)).toBeHidden();
    expect(await estiloDe(q, `.aba[data-cand="${primeiro}"]`)).toEqual(selecionada);
    expect(await estiloDe(q, `.aba[data-cand="${segundo}"]`)).not.toEqual(selecionada);
    await sem.close();

    // com o JS liberado, mas atrasado: o painel da 1ª pintura é o mesmo depois da hidratação
    const lento = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const r = await lento.newPage();
    await fixarSorteio(r, sorteio);
    let soltar: () => void = () => {};
    const segura = new Promise<void>((ok) => (soltar = ok));
    await r.route("**/assets/*.js", async (rota) => {
      await segura;
      await rota.continue();
    });
    // o módulo segurado também segura o DOMContentLoaded: espera só o HTML do painel chegar
    await r.goto("/tema/saude", { waitUntil: "commit" });
    await r.locator(".colunas > .painel").nth(1).waitFor({ state: "attached" });
    const visiveis = () => r.locator(".painel:visible").evaluateAll((els) => els.map((e) => e.getAttribute("data-cand")));
    expect(await visiveis()).toEqual([primeiro]);
    soltar();
    await hidratado(r);
    expect(await visiveis()).toEqual([primeiro]);
    await lento.close();
  }
});

test("C2: os títulos das seções trazem as contagens do JSON em cada tema", async ({ page }) => {
  expect(publicados).toHaveLength(8);
  for (const id of publicados) {
    const c = comparacao(id);
    await page.goto(`/tema/${id}`);
    const titulos = await page.locator("[data-lista] > h2").evaluateAll((els) => els.map((e) => [e.parentElement!.dataset.lista, e.textContent ?? ""]));
    const textos = Object.fromEntries(titulos.map(([l, t]) => [l, normal(t!)]));
    expect(textos.semelhancas, id).toBe(`Semelhanças (${c.semelhancas.length})`);
    expect(textos.diferencas, id).toBe(`Diferenças (${c.diferencas.length})`);
    expect(textos.omissoes, id).toBe(`Omissões (${c.omissoes.length})`);
  }
});

test("C3: o indicador de cada item é um triângulo em SVG à direita do texto, em tinta, ▸ fechado e ▾ aberto", async ({ page }) => {
  await abrir(page, "/tema/saude");
  const tinta = await token(page, "tinta");
  const sumarios = page.locator(".item summary:visible");
  expect(await sumarios.count()).toBeGreaterThan(10);
  const angulo = (s: Locator) =>
    s.evaluate((el) => {
      const t = getComputedStyle(el.lastElementChild!).transform;
      if (t === "none") return 0;
      const [a, b] = t.slice(t.indexOf("(") + 1).split(",").map(Number);
      return Math.round((Math.atan2(b, a) * 180) / Math.PI);
    });
  for (const s of await sumarios.all()) {
    const d = await s.evaluate((el) => {
      const svg = el.lastElementChild as SVGElement;
      const texto = el.querySelector(".resumo-item")!.getBoundingClientRect();
      const path = svg.querySelector("path")!;
      return {
        lista: getComputedStyle(el).listStyleType,
        display: getComputedStyle(el).display,
        tag: svg.tagName.toLowerCase(),
        oculto: svg.getAttribute("aria-hidden"),
        esquerda: svg.getBoundingClientRect().left,
        fimDoTexto: texto.right,
        cor: getComputedStyle(svg).color,
        caminho: path.getAttribute("d"),
        preenchimento: path.getAttribute("fill"),
      };
    });
    expect(d.lista).toBe("none");
    expect(d.display).not.toBe("list-item");
    expect(d.tag).toBe("svg");
    expect(d.oculto).toBe("true");
    expect(d.esquerda).toBeGreaterThanOrEqual(d.fimDoTexto);
    expect(d.cor).toBe(tinta);
    expect(d.preenchimento).toBe("currentColor");
    // três vértices e fechado: um triângulo
    expect(d.caminho).toMatch(/^M\s*[\d.]+[\s,]+[\d.]+(?:[\s,L]+[\d.]+[\s,]+[\d.]+){2}\s*Z$/i);
  }
  const primeiro = sumarios.first();
  expect(await angulo(primeiro)).toBe(0);
  await primeiro.click();
  await expect.poll(() => angulo(primeiro)).toBe(90);
  await primeiro.click();
  await expect.poll(() => angulo(primeiro)).toBe(0);
});

test("C4: em 390 px, o nome do candidato fica só na aba; o h3 do painel continua, com 1×1 px", async ({ page }) => {
  await abrir(page, "/tema/saude", 390, 844);
  for (let i = 0; i < 2; i++) {
    await page.getByRole("tab").nth(i).click();
    const painel = page.locator(".painel:visible");
    await expect(painel).toHaveCount(1);
    const titulo = painel.getByRole("heading", { level: 3 });
    await expect(titulo).toHaveCount(1);
    await expect(titulo).toHaveAccessibleName(/\(P[LT]\)$/);
    const caixa = await titulo.boundingBox();
    expect(caixa!.width).toBeLessThanOrEqual(1);
    expect(caixa!.height).toBeLessThanOrEqual(1);
  }
});

test("C5: controles na ordem do desenho; em 390 px os três filtros numa só linha", async ({ page }) => {
  const rotulos = ["Trocar ordem dos candidatos", "Só semelhanças", "Só diferenças", "Mostrar tudo"];
  await abrir(page, "/tema/saude");
  const noDom = await page.locator("main button").evaluateAll((els, r) => els.map((e) => e.textContent!.trim()).filter((t) => r.includes(t)), rotulos);
  expect(noDom).toEqual(rotulos);
  await abrir(page, "/tema/saude", 390, 844);
  const topos: number[] = [];
  for (const r of rotulos.slice(1)) topos.push((await page.getByRole("button", { name: r, exact: true }).boundingBox())!.y);
  for (const t of topos) expect(Math.abs(t - topos[0])).toBeLessThanOrEqual(1);
});

test("C6: as omissões vêm primeiro do 1º candidato da ordem, na ordem do JSON dentro de cada um", async ({ page }) => {
  for (const [sorteio, primeiro] of [
    [0.1, "flavio-bolsonaro"],
    [0.9, "lula"],
  ] as const) {
    await fixarSorteio(page, sorteio);
    await abrir(page, "/tema/saude");
    await expect(page.locator('[data-lista="omissoes"] .texto-item')).toHaveText(ordemOmissoes(comparacao("saude"), primeiro));
    await abrir(page, "/diferencas");
    for (const id of publicados) {
      const c = comparacao(id);
      if (!c.omissoes.length) continue;
      await expect(page.locator(`section[data-tema="${id}"] li.omissao .texto-item`), `${id} ${primeiro}`).toHaveText(ordemOmissoes(c, primeiro));
    }
  }
});

test("C7: Trocar ordem inverte os grupos de omissões no tema e em /diferencas", async ({ page }) => {
  await fixarSorteio(page, 0.1);
  for (const [rota, id, lista] of [
    ["/tema/saude", "saude", '[data-lista="omissoes"] .texto-item'],
    ["/diferencas", "educacao", 'section[data-tema="educacao"] li.omissao .texto-item'],
  ]) {
    await abrir(page, rota);
    const c = comparacao(id);
    await expect(page.locator(lista)).toHaveText(ordemOmissoes(c, "flavio-bolsonaro"));
    await page.getByRole("button", { name: "Trocar ordem dos candidatos" }).click();
    await expect(page.locator(lista)).toHaveText(ordemOmissoes(c, "lula"));
    await page.getByRole("button", { name: "Trocar ordem dos candidatos" }).click();
    await expect(page.locator(lista)).toHaveText(ordemOmissoes(c, "flavio-bolsonaro"));
  }
});

test("C8: nome nos itens é h3 no tema e em /semelhancas e h4 em /diferencas; nenhum título pula nível", async ({ page }) => {
  test.setTimeout(180_000); // percorre todas as rotas ou temas com tudo aberto
  for (const [rota, tag] of [
    ["/tema/saude", "H3"],
    ["/semelhancas", "H3"],
    ["/diferencas", "H4"],
  ]) {
    await abrir(page, rota);
    await abrirTudo(page);
    const tags = await page.locator(".item .nome-candidato").evaluateAll((els) => els.map((e) => e.tagName));
    expect(tags.length, rota).toBeGreaterThan(0);
    expect([...new Set(tags)], rota).toEqual([tag]);
  }
  for (const rota of ROTAS_SITE) {
    await abrir(page, rota);
    await abrirTudo(page);
    const niveis = await page.evaluate(() =>
      [...document.querySelectorAll("h1, h2, h3, h4, h5, h6")].filter((h) => (h as HTMLElement).checkVisibility()).map((h) => Number(h.tagName[1])),
    );
    expect(niveis[0], rota).toBe(1);
    for (let i = 1; i < niveis.length; i++) expect(niveis[i], `${rota}: h${niveis[i - 1]} -> h${niveis[i]}`).toBeLessThanOrEqual(niveis[i - 1] + 1);
  }
});

test("C9: com tudo aberto, nada dentro das listas tem papel region", async ({ page }) => {
  for (const rota of ["/tema/saude", "/diferencas"]) {
    await abrir(page, rota);
    await abrirTudo(page);
    expect(await page.locator(".itens .lado").count(), rota).toBeGreaterThan(0);
    await expect(page.locator(".itens").getByRole("region"), rota).toHaveCount(0);
  }
});

test("C10: todos os trechos aparecem; uma linha de fonte e um Ver no PDF por grupo de mesma página", async ({ page }) => {
  test.setTimeout(180_000); // percorre todas as rotas ou temas com tudo aberto
  await fixarSorteio(page, 0.1); // ordem "ab": Flávio primeiro
  for (const id of publicados) {
    const c = comparacao(id);
    await abrir(page, `/tema/${id}`);
    await abrirTudo(page);
    const esperado: { trechos: number; grupos: number }[] = [];
    for (const cand of ["flavio-bolsonaro", "lula"] as const) {
      if (c.candidatos[cand].nao_encontrado) continue;
      for (const b of c.candidatos[cand].resumo) esperado.push({ trechos: b.citacoes.length, grupos: grupos(b.citacoes) });
    }
    for (const it of [...c.semelhancas, ...c.diferencas]) {
      const lados = [it.citacoes["flavio-bolsonaro"], it.citacoes.lula];
      esperado.push({ trechos: lados.reduce((n, l) => n + l.length, 0), grupos: lados.reduce((n, l) => n + grupos(l), 0) });
    }
    for (const o of [...c.omissoes.filter((x) => x.tratado_por === "flavio-bolsonaro"), ...c.omissoes.filter((x) => x.tratado_por === "lula")])
      esperado.push({ trechos: o.citacoes.length, grupos: grupos(o.citacoes) });
    const visto = await page.locator("li.item").evaluateAll((els) =>
      els.map((li) => ({
        trechos: li.querySelectorAll(".trecho").length,
        grupos: li.querySelectorAll(".origem").length,
        links: [...li.querySelectorAll("a")].filter((a) => a.textContent!.startsWith("Ver no PDF")).length,
      })),
    );
    expect(visto.map(({ trechos, grupos: g }) => ({ trechos, grupos: g })), id).toEqual(esperado);
    for (const v of visto) expect(v.links, id).toBe(v.grupos);
    // a linha de fonte de cada grupo traz arquivo e página
    for (const linha of await page.locator(".origem").allTextContents()) expect(normal(linha)).toMatch(/^\S+\.pdf · pág\. \d+ ?Ver no PDF/);
  }
});

test("C11: em 390×844, rolada 1.500 px dentro do painel, a lista de abas fica no topo", async ({ page }) => {
  await abrir(page, "/tema/saude", 390, 844);
  for (const s of await page.locator(".painel:visible summary").all()) await s.click();
  await page.evaluate(() => window.scrollTo(0, 1500));
  await page.waitForTimeout(100);
  const painel = await page.locator(".painel:visible").boundingBox();
  expect(painel!.y).toBeLessThan(0);
  expect(painel!.y + painel!.height).toBeGreaterThan(200);
  const abas = page.getByRole("tablist");
  await expect(abas).toBeInViewport();
  expect(Math.abs((await abas.boundingBox())!.y)).toBeLessThanOrEqual(1);
});
