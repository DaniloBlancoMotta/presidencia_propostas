// Checks da feature interface-site (.specs/features/interface-site/checks.md) provados no nível unitário.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { RAIZ } from "../scripts/caminhos";
import { agruparCitacoes, ordenarOmissoes } from "../src/Citado";
import { ancoraDaPagina, criarVez, destinoDaRolagem, estadosAoEmpilhar, faltaBaixar, rolagemDoEstado } from "../src/navegacao";
import { botoesDaPagina, filaDeDesenho, redesenharNaLargura } from "../src/paginacao";
import { filtroDaUrl, urlComFiltro } from "../src/rotas";
import type { CandidatoId, Citacao, Comparacao, DadosPagina } from "../src/tipos";

const TOKENS = readFileSync(resolve(import.meta.dirname, "..", "src", "tokens.css"), "utf8");
const raiz = /:root\s*\{([^}]*)\}/.exec(TOKENS)?.[1] ?? "";
const tokens = Object.fromEntries([...raiz.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));

// Cor -> sRGB linear (OKLCH pela matriz de Björn Ottosson; hex pela curva sRGB), e contraste WCAG.
function linear(valor: string): [number, number, number] {
  const ok = /^oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)$/.exec(valor);
  if (ok) {
    const [L, C, h] = [Number(ok[1]) / 100, Number(ok[2]), (Number(ok[3]) * Math.PI) / 180];
    const [a, b] = [C * Math.cos(h), C * Math.sin(h)];
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const rgb: [number, number, number] = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
    return rgb.map((x) => Math.min(1, Math.max(0, x))) as [number, number, number];
  }
  const hex = /^#([0-9a-f]{6})$/i.exec(valor);
  if (!hex) throw new Error(`cor não reconhecida: ${valor}`);
  return [0, 2, 4].map((i) => {
    const x = parseInt(hex[1].slice(i, i + 2), 16) / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
}
const luminancia = ([r, g, b]: number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
function contraste(a: string, b: string) {
  const [x, y] = [luminancia(linear(tokens[a])), luminancia(linear(tokens[b]))].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

describe("S7: cor e tom de área por candidato", () => {
  it("C53: o arquivo de tokens declara as cores e os tons exatos", () => {
    expect(tokens).toMatchObject({
      "cand-lula": "#ee481a",
      "cand-flavio-bolsonaro": "#004f9f",
      semelhanca: "#2f7a55",
      "tom-lula": "oklch(95% 0.03 35)",
      "tom-flavio-bolsonaro": "oklch(95% 0.03 258)",
      "tom-semelhanca": "oklch(95% 0.03 158)",
      "tom-lula-forte": "oklch(93.5% 0.04 35)",
      "tom-flavio-bolsonaro-forte": "oklch(93.5% 0.04 258)",
      "tom-semelhanca-forte": "oklch(93.5% 0.04 158)",
    });
  });

  it("C56: texto em tinta ≥ 4,5:1 sobre papel e tons; cores plenas ≥ 3:1; o par mais apertado mede 3,05:1", () => {
    const tons = ["tom-lula", "tom-lula-forte", "tom-flavio-bolsonaro", "tom-flavio-bolsonaro-forte", "tom-semelhanca", "tom-semelhanca-forte"];
    for (const texto of ["tinta", "tinta-2"])
      for (const fundo of ["papel", ...tons]) expect(contraste(texto, fundo), `${texto} sobre ${fundo}`).toBeGreaterThanOrEqual(4.5);
    for (const [cor, tom] of [["cand-lula", "tom-lula"], ["cand-flavio-bolsonaro", "tom-flavio-bolsonaro"], ["semelhanca", "tom-semelhanca"]])
      for (const fundo of ["papel", tom, `${tom}-forte`]) expect(contraste(cor, fundo), `${cor} sobre ${fundo}`).toBeGreaterThanOrEqual(3);
    expect(contraste("cand-lula", "tom-lula-forte")).toBeCloseTo(3.05, 1);
    expect(Math.abs(contraste("cand-lula", "tom-lula-forte") - 3.05)).toBeLessThanOrEqual(0.02);
  });
});

const SRC = resolve(import.meta.dirname, "..", "src");
const CSS: Record<string, string> = Object.fromEntries(
  readdirSync(SRC)
    .filter((f) => f.endsWith(".css"))
    .map((f) => [f, readFileSync(join(SRC, f), "utf8")]),
);
const semComentarios = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const COR_LITERAL = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch)\(/gi;

describe("S1: decisões da tela de tema", () => {
  it("C6: omissões na ordem vigente: primeiro as do 1º candidato, na ordem do JSON dentro de cada um", () => {
    const o = (tratado_por: CandidatoId, texto: string) => ({ tratado_por, texto });
    const textos = (l: { texto: string }[]) => l.map((x) => x.texto);
    const misturadas = [o("lula", "l1"), o("flavio-bolsonaro", "f1"), o("lula", "l2"), o("flavio-bolsonaro", "f2")];
    // ordem "ab" (Flávio primeiro) e "ba" (Lula primeiro), com omissões dos dois candidatos
    expect(textos(ordenarOmissoes(misturadas, ["flavio-bolsonaro", "lula"]))).toEqual(["f1", "f2", "l1", "l2"]);
    expect(textos(ordenarOmissoes(misturadas, ["lula", "flavio-bolsonaro"]))).toEqual(["l1", "l2", "f1", "f2"]);
    // só um dos candidatos com omissões, nas duas ordens
    for (const ordem of [["flavio-bolsonaro", "lula"], ["lula", "flavio-bolsonaro"]] as CandidatoId[][]) {
      expect(textos(ordenarOmissoes([o("lula", "l1"), o("lula", "l2")], ordem))).toEqual(["l1", "l2"]);
      expect(textos(ordenarOmissoes([o("flavio-bolsonaro", "f1"), o("flavio-bolsonaro", "f2")], ordem))).toEqual(["f1", "f2"]);
    }
  });

  it("C10: citações consecutivas do mesmo arquivo e página formam um grupo; troca de página ou de arquivo abre outro", () => {
    const c = (arquivo: string, pagina: number, trecho: string): Citacao => ({ arquivo, pagina, trecho });
    const forma = (cs: Citacao[]) => agruparCitacoes(cs).map((g) => g.map((x) => x.trecho));
    expect(forma([c("a.pdf", 3, "x"), c("a.pdf", 3, "y")])).toEqual([["x", "y"]]);
    expect(forma([c("a.pdf", 3, "x"), c("a.pdf", 4, "y")])).toEqual([["x"], ["y"]]);
    expect(forma([c("a.pdf", 3, "x"), c("b.pdf", 3, "y")])).toEqual([["x"], ["y"]]);
    // só as consecutivas: a mesma página depois de outra abre um grupo novo
    expect(forma([c("a.pdf", 3, "x"), c("a.pdf", 4, "y"), c("a.pdf", 3, "z")])).toEqual([["x"], ["y"], ["z"]]);
    expect(agruparCitacoes([])).toEqual([]);
  });
});

describe("S4: o filtro na URL (porta 1)", () => {
  it("C32: cada filtro leva a um endereço; Mostrar tudo tira o parâmetro", () => {
    expect(urlComFiltro("/tema/saude", "semelhancas")).toBe("/tema/saude?filtro=semelhancas");
    expect(urlComFiltro("/tema/saude", "diferencas")).toBe("/tema/saude?filtro=diferencas");
    expect(urlComFiltro("/tema/saude", "tudo")).toBe("/tema/saude");
  });

  it("C34: ?filtro conhecido vale; ausente ou desconhecido é Mostrar tudo", () => {
    expect(filtroDaUrl("?filtro=semelhancas")).toBe("semelhancas");
    expect(filtroDaUrl("?filtro=diferencas")).toBe("diferencas");
    expect(filtroDaUrl("")).toBe("tudo");
    expect(filtroDaUrl("?outro=semelhancas")).toBe("tudo");
    expect(filtroDaUrl("?filtro=xyz")).toBe("tudo");
    expect(filtroDaUrl("?filtro=")).toBe("tudo");
    expect(filtroDaUrl("?filtro=Semelhancas")).toBe("tudo");
  });
});

describe("S4: decisões da navegação no cliente (App.tsx)", () => {
  it("C31: entre dois destinos tocados, só o último chega à tela", () => {
    const vez = criarVez();
    const saude = vez.nova();
    const educacao = vez.nova();
    // a resposta de Saúde chega depois da de Educação e não vale
    expect(vez.vale(saude)).toBe(false);
    expect(vez.vale(educacao)).toBe(true);
    // um único destino vale
    const outra = criarVez();
    expect(outra.vale(outra.nova())).toBe(true);
  });

  it("C29: a rolagem fica guardada na entrada que se deixa e volta com ela; a entrada nova começa no topo", () => {
    // histórico simulado: só a entrada /diferencas, sem estado, rolada até 6025 px
    const pilha: unknown[] = [null];
    const { saida, nova } = estadosAoEmpilhar(pilha[0], 6025);
    pilha[0] = saida;
    pilha.push(nova);
    expect(rolagemDoEstado(pilha[1])).toBe(0);
    // Voltar: o navegador devolve o estado da entrada anterior
    expect(rolagemDoEstado(pilha[0])).toBe(6025);
    // o resto do estado da entrada é mantido
    expect(estadosAoEmpilhar({ outro: 1, y: 5 }, 40).saida).toEqual({ outro: 1, y: 40 });
    // entrada sem rolagem guardada (aberta direto pelo endereço): o topo
    expect(rolagemDoEstado(null)).toBe(0);
    expect(rolagemDoEstado({})).toBe(0);
  });

  it("C29: depois de trocar de rota, a âncora do endereço com posição 0 é o destino; uma posição guardada vale sobre a âncora", () => {
    const ancora = { id: "g-agronegocio" };
    // âncora no endereço e posição 0 (link do índice, entrada nova): rola até a âncora
    expect(destinoDaRolagem(0, ancora)).toEqual({ alvo: ancora });
    // Voltar a uma entrada com âncora e rolagem guardada: a posição guardada vence
    expect(destinoDaRolagem(6025, ancora)).toEqual({ y: 6025 });
    // sem âncora (ou âncora que não existe na página): a posição, guardada ou o topo
    expect(destinoDaRolagem(6025, null)).toEqual({ y: 6025 });
    expect(destinoDaRolagem(0, null)).toEqual({ y: 0 });
  });

  it("C30: \"Carregando…\" só quando a rota tem o que baixar", () => {
    const temas = ["saude", "educacao"].map((id) => ({ id }));
    const dados = (comparacoes: string[]) =>
      ({
        rota: { tipo: "inicio" },
        manifesto: { temas },
        comparacoes: Object.fromEntries(comparacoes.map((id) => [id, {}])),
      }) as unknown as DadosPagina;
    const vazio = dados([]);
    const ambos = dados(["saude", "educacao"]);
    // chat ainda não carregado
    expect(faltaBaixar({ tipo: "chat" }, ambos, false)).toBe(true);
    expect(faltaBaixar({ tipo: "conversa" }, ambos, false)).toBe(true);
    // chat já carregado
    expect(faltaBaixar({ tipo: "chat" }, ambos, true)).toBe(false);
    expect(faltaBaixar({ tipo: "conversa" }, vazio, true)).toBe(false);
    // tema sem JSON em memória / com JSON em memória
    expect(faltaBaixar({ tipo: "tema", id: "saude" }, vazio, true)).toBe(true);
    expect(faltaBaixar({ tipo: "tema", id: "saude" }, dados(["saude"]), false)).toBe(false);
    // semelhanças e diferenças precisam de todos os temas: falta um
    expect(faltaBaixar({ tipo: "semelhancas" }, dados(["saude"]), true)).toBe(true);
    expect(faltaBaixar({ tipo: "diferencas" }, dados(["educacao"]), true)).toBe(true);
    expect(faltaBaixar({ tipo: "semelhancas" }, ambos, false)).toBe(false);
    expect(faltaBaixar({ tipo: "diferencas" }, ambos, false)).toBe(false);
    // nada a baixar
    for (const tipo of ["inicio", "metodologia", "sobre"] as const) {
      expect(faltaBaixar({ tipo }, vazio, false), tipo).toBe(false);
    }
  });

  it("C28: só a âncora da mesma página (mesmo caminho e mesma busca) fica fora da navegação", () => {
    const l = (pathname: string, hash = "", search = "") => ({ pathname, search, hash });
    expect(ancoraDaPagina(l("/", "#conteudo"), l("/"))).toBe(true);
    expect(ancoraDaPagina(l("/diferencas", "#g-saude"), l("/diferencas"))).toBe(true);
    expect(ancoraDaPagina(l("/diferencas", "#g-saude"), l("/semelhancas"))).toBe(false);
    expect(ancoraDaPagina(l("/tema/saude", "#x", "?filtro=semelhancas"), l("/tema/saude"))).toBe(false);
    expect(ancoraDaPagina(l("/tema/saude"), l("/"))).toBe(false);
    expect(ancoraDaPagina(l("/"), l("/"))).toBe(false);
  });
});

describe("S3: decisões da paginação do visualizador", () => {
  it("C19: dois pedidos durante um desenho: o desenho em curso é cancelado e só a página mais recente termina", async () => {
    let alvo = 26;
    const comecados: number[] = [];
    const terminados: number[] = [];
    let soltar: () => void = () => {};
    let cancelados = 0;
    const fila = filaDeDesenho(async (meu) => {
      const n = alvo;
      comecados.push(n);
      if (n === 26) await new Promise<void>((ok) => (soltar = ok));
      if (!fila.vigente(meu)) return false;
      terminados.push(n);
      return true;
    }, () => cancelados++);
    const primeiro = fila.pedir();
    alvo = 27;
    const segundo = fila.pedir();
    alvo = 28;
    const terceiro = fila.pedir();
    await Promise.all([segundo, terceiro]);
    soltar();
    await primeiro;
    expect(comecados).toEqual([26, 28]);
    expect(terminados).toEqual([28]);
    expect(cancelados).toBe(3);
    // um pedido sozinho desenha uma vez
    alvo = 5;
    await fila.pedir();
    expect(terminados).toEqual([28, 5]);
  });

  it("C20: na primeira ou na última página, o foco passa do botão desabilitado para o outro", () => {
    expect(botoesDaPagina(1, 60, "anterior")).toEqual({ desabilitado: { anterior: true, proxima: false }, foco: "proxima" });
    expect(botoesDaPagina(60, 60, "proxima")).toEqual({ desabilitado: { anterior: false, proxima: true }, foco: "anterior" });
    // o foco fica onde está quando o botão focado continua habilitado, ou quando nenhum deles está focado
    expect(botoesDaPagina(1, 60, "proxima").foco).toBeNull();
    expect(botoesDaPagina(30, 60, "anterior")).toEqual({ desabilitado: { anterior: false, proxima: false }, foco: null });
    expect(botoesDaPagina(1, 60, null).foco).toBeNull();
  });

  it("C26: só uma largura nova redesenha a página", () => {
    expect(redesenharNaLargura(600, 1366)).toBe(true);
    expect(redesenharNaLargura(1366, 600)).toBe(true);
    expect(redesenharNaLargura(600, 600)).toBe(false);
  });
});

describe("S5 e S8: o CSS do site e do visualizador", () => {
  it("C40: toda regra :hover usa só var(--…) para cor", () => {
    const PROP_COR = /^(color|background|background-color|border(-(top|right|bottom|left))?(-color)?|outline(-color)?|text-decoration-color|fill|stroke)$/;
    let regras = 0;
    for (const [arquivo, css] of Object.entries(CSS)) {
      for (const m of semComentarios(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        if (!m[1].includes(":hover")) continue;
        regras++;
        expect(m[2].match(COR_LITERAL), `${arquivo}: ${m[1].trim()}`).toBeNull();
        for (const d of m[2].split(";")) {
          const i = d.indexOf(":");
          if (i < 0) continue;
          const [prop, valor] = [d.slice(0, i).trim(), d.slice(i + 1).trim()];
          if (PROP_COR.test(prop)) expect(valor, `${arquivo}: ${m[1].trim()} { ${prop} }`).toMatch(/var\(--[\w-]+\)/);
        }
      }
    }
    expect(regras).toBeGreaterThan(5);
  });

  it("C51: cores literais só no arquivo de tokens, importado por estilo.css e visualizador.css", () => {
    expect(Object.keys(CSS).sort()).toEqual(["estilo.css", "tokens.css", "visualizador.css"]);
    for (const [arquivo, css] of Object.entries(CSS)) {
      const literais = semComentarios(css).match(COR_LITERAL) ?? [];
      if (arquivo === "tokens.css") expect(literais.length).toBeGreaterThan(0);
      else expect(literais, arquivo).toEqual([]);
    }
    expect(CSS["estilo.css"]).toMatch(/@import\s+["']\.\/tokens\.css["']/);
    expect(CSS["visualizador.css"]).toMatch(/@import\s+["']\.\/tokens\.css["']/);
  });

  it("C61: papel, tinta e fio em OKLCH; nenhum CSS com #fff ou #000", () => {
    expect(tokens).toMatchObject({
      papel: "oklch(97.6% 0.008 85)",
      tinta: "oklch(24% 0.02 265)",
      "tinta-2": "oklch(43% 0.018 265)",
      fio: "oklch(84% 0.013 85)",
    });
    for (const [arquivo, css] of Object.entries(CSS)) expect(css.match(/#(?:fff|ffffff|000|000000)\b/gi), arquivo).toBeNull();
  });
});

describe("S5: a montagem do HTML (nível do comando)", () => {
  const ENTIDADES: Record<string, string> = { "&amp;": "&", "&#x27;": "'", "&#39;": "'", "&quot;": '"', "&lt;": "<", "&gt;": ">" };
  const texto = (html: string) => html.replace(/<[^>]+>/g, "").replace(/&(?:amp|#x27|#39|quot|lt|gt);/g, (e) => ENTIDADES[e]);

  it("C50: textos com $&, $' e $$ saem idênticos no HTML pré-renderizado", () => {
    const pasta = mkdtempSync(join(tmpdir(), "c50-"));
    const comp = JSON.parse(readFileSync(resolve(RAIZ, "dados", "comparacoes", "saude.json"), "utf8")) as Comparacao;
    const sequencias = ["R$& 10", "R$' 10", "R$$ 10"];
    comp.candidatos.lula.resumo[0].texto = `Custa ${sequencias[0]} por mês.`;
    comp.candidatos.lula.resumo[1].texto = `Custa ${sequencias[1]} por mês.`;
    comp.semelhancas[0].texto = `Custa ${sequencias[2]} por mês.`;
    const arq = join(pasta, "saude.json");
    writeFileSync(arq, JSON.stringify(comp, null, 2));
    writeFileSync(join(pasta, "aprovados.yaml"), `saude: ${createHash("sha256").update(readFileSync(arq)).digest("hex")}\n`);
    const saida = resolve(RAIZ, "web", "dist-c50");
    try {
      const r = spawnSync("npx", ["tsx", "scripts/build.ts"], {
        cwd: resolve(RAIZ, "web"),
        env: { ...process.env, COMPARACOES: pasta, APROVADOS: join(pasta, "aprovados.yaml"), OUT_DIR: "dist-c50" },
        encoding: "utf8",
      });
      expect(r.status, r.stderr).toBe(0);
      const html = readFileSync(join(saida, "tema", "saude", "index.html"), "utf8");
      expect(html.match(/<div id="app">/g)).toHaveLength(1);
      expect(html).not.toContain("<!--app-->");
      expect(html).not.toContain("<!--dados-->");
      const app = /<div id="app">([\s\S]*)<\/div>\s*<script id="dados"/.exec(html)![1];
      for (const s of sequencias) expect(texto(app)).toContain(`Custa ${s} por mês.`);
      const dados = JSON.parse(/<script id="dados" type="application\/json">([\s\S]*?)<\/script>/.exec(html)![1]) as { comparacoes: { saude: Comparacao } };
      expect(dados.comparacoes.saude.candidatos.lula.resumo[0].texto).toBe(`Custa ${sequencias[0]} por mês.`);
      expect(dados.comparacoes.saude.candidatos.lula.resumo[1].texto).toBe(`Custa ${sequencias[1]} por mês.`);
      expect(dados.comparacoes.saude.semelhancas[0].texto).toBe(`Custa ${sequencias[2]} por mês.`);
    } finally {
      rmSync(saida, { recursive: true, force: true });
      rmSync(pasta, { recursive: true, force: true });
    }
  }, 240_000);

  it("C74: com url em site.yaml, cada rota grava o canonical com o endereço absoluto, menos a 404", () => {
    const pasta = mkdtempSync(join(tmpdir(), "c74-"));
    const arq = join(pasta, "saude.json");
    writeFileSync(arq, readFileSync(resolve(RAIZ, "dados", "comparacoes", "saude.json")));
    writeFileSync(join(pasta, "aprovados.yaml"), `saude: ${createHash("sha256").update(readFileSync(arq)).digest("hex")}\n`);
    // um site.yaml temporário: o dados/site.yaml real não é tocado
    writeFileSync(join(pasta, "site.yaml"), "responsavel: null\nurl: https://comparador.exemplo\n");
    const saida = resolve(RAIZ, "web", "dist-c74");
    try {
      const r = spawnSync("npx", ["tsx", "scripts/build.ts"], {
        cwd: resolve(RAIZ, "web"),
        env: {
          ...process.env,
          COMPARACOES: pasta,
          APROVADOS: join(pasta, "aprovados.yaml"),
          SITE_YAML: join(pasta, "site.yaml"),
          OUT_DIR: "dist-c74",
        },
        encoding: "utf8",
      });
      expect(r.status, r.stderr).toBe(0);
      const canonicos = (arquivo: string) =>
        [...readFileSync(join(saida, arquivo), "utf8").matchAll(/<link rel="canonical"[^>]*?href="([^"]*)"/g)].map((m) => m[1]);
      for (const [arquivo, url] of [
        ["index.html", "https://comparador.exemplo/"],
        ["tema/saude/index.html", "https://comparador.exemplo/tema/saude"],
        ["semelhancas/index.html", "https://comparador.exemplo/semelhancas"],
        ["diferencas/index.html", "https://comparador.exemplo/diferencas"],
        ["metodologia/index.html", "https://comparador.exemplo/metodologia"],
        ["sobre/index.html", "https://comparador.exemplo/sobre"],
        ["chat/index.html", "https://comparador.exemplo/chat"],
        ["chat/conversa/index.html", "https://comparador.exemplo/chat/conversa"],
      ])
        expect(canonicos(arquivo), arquivo).toEqual([url]);
      expect(canonicos("404.html")).toEqual([]);
    } finally {
      rmSync(saida, { recursive: true, force: true });
      rmSync(pasta, { recursive: true, force: true });
    }
  }, 240_000);
});
