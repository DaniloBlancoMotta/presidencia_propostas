// Checks da feature interface-site (.specs/features/interface-site/checks.md) provados no nível unitário.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { RAIZ } from "../scripts/caminhos";
import { agruparCitacoes, ordenarOmissoes } from "../src/Citado";
import { filtroDaUrl, urlComFiltro } from "../src/rotas";
import type { CandidatoId, Citacao, Comparacao } from "../src/tipos";

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
});
