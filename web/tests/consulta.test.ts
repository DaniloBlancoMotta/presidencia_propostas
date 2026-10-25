// AC 38-42: interpretação da mensagem, menção por @ e busca por palavra (sem rede, sem modelo).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { RAIZ } from "../scripts/caminhos";
import { buscar, contem, inserirMencao, interpretar, mencaoNoCursor, palavras, resolverMencao, sugerir, temasNecessarios } from "../src/consulta";
import type { Comparacao, TemaPublico } from "../src/tipos";

const temas = (parse(readFileSync(resolve(RAIZ, "dados", "themes.yaml"), "utf8")) as { temas: TemaPublico[] }).temas.map(
  ({ id, rotulo, icone, descricao }) => ({ id, rotulo, icone, descricao }),
);
const ids = temas.map((t) => t.id);

describe("menção por @", () => {
  it("resolve id, rótulo com ou sem acento, hífen e prefixo único", () => {
    expect(resolverMencao("saude", temas)).toBe("saude");
    expect(resolverMencao("Saúde", temas)).toBe("saude");
    expect(resolverMencao("meio-ambiente", temas)).toBe("meio-ambiente");
    expect(resolverMencao("meioambiente", temas)).toBe("meio-ambiente");
    expect(resolverMencao("tecnologia-ia", temas)).toBe("tecnologia-ia");
    expect(resolverMencao("seg", temas)).toBe("seguranca-publica");
    expect(resolverMencao("agro", temas)).toBe("agronegocio");
    expect(resolverMencao("custo", temas)).toBe("custo-de-vida");
  });

  it("não resolve o que não é tema, prefixo curto nem prefixo ambíguo", () => {
    expect(resolverMencao("xyz", temas)).toBeNull();
    expect(resolverMencao("sa", temas)).toBeNull();
    const dois: TemaPublico[] = [
      { id: "saude", rotulo: "Saúde", icone: "", descricao: "" },
      { id: "saneamento", rotulo: "Saneamento", icone: "", descricao: "" },
    ];
    expect(resolverMencao("san", dois)).toBe("saneamento");
    expect(resolverMencao("sau", dois)).toBe("saude");
    expect(resolverMencao("sa", dois)).toBeNull();
  });

  it("lista de sugestões: todos com @ sozinho; os que começam com a busca primeiro; descrição também vale", () => {
    expect(sugerir("", temas).map((t) => t.id)).toEqual(ids);
    expect(sugerir("sa", temas)[0].id).toBe("saude");
    expect(sugerir("sus", temas).map((t) => t.id)).toEqual(["saude"]);
    expect(sugerir("bolsa", temas).map((t) => t.id)).toEqual(["programas-sociais"]);
    expect(sugerir("qqq", temas)).toEqual([]);
  });

  it("menção no cursor só depois de espaço ou no início, e inserção troca a parte digitada", () => {
    expect(mencaoNoCursor("@sa", 3)).toEqual({ inicio: 0, busca: "sa" });
    expect(mencaoNoCursor("compare @edu", 12)).toEqual({ inicio: 8, busca: "edu" });
    expect(mencaoNoCursor("email@sa", 8)).toBeNull();
    expect(mencaoNoCursor("@saude ", 7)).toBeNull();
    expect(inserirMencao("compare @edu", 12, 8, "educacao")).toEqual({ texto: "compare @educacao ", cursor: 18 });
    expect(inserirMencao("@sa comparar", 3, 0, "saude")).toEqual({ texto: "@saude comparar", cursor: 7 });
  });
});

describe("interpretação da mensagem", () => {
  const i = (t: string) => interpretar(t, temas);

  it("tema sozinho é resumo executivo", () => {
    expect(i("@saude")).toMatchObject({ intencao: "executivo", temas: ["saude"], termos: [] });
    expect(i("o que o Lula e o Flávio propõem para @saude?")).toMatchObject({ intencao: "executivo", temas: ["saude"] });
    expect(i("resumo executivo de @educacao e @saude")).toMatchObject({ intencao: "executivo", temas: ["educacao", "saude"] });
    expect(i("@meio ambiente")).toMatchObject({ intencao: "executivo", temas: ["meio-ambiente"], termos: [] });
    expect(i("@custo de vida")).toMatchObject({ intencao: "executivo", temas: ["custo-de-vida"], termos: [] });
  });

  it("comparar, semelhanças e diferenças", () => {
    expect(i("@saude comparar")).toMatchObject({ intencao: "comparar", temas: ["saude"] });
    expect(i("@saúde, quais as semelhanças?")).toMatchObject({ intencao: "semelhancas", temas: ["saude"] });
    expect(i("o que têm em comum em @agronegocio")).toMatchObject({ intencao: "semelhancas" });
    expect(i("@saude @educacao diferenças")).toMatchObject({ intencao: "diferencas", temas: ["saude", "educacao"] });
    expect(i("semelhanças e diferenças em @saude")).toMatchObject({ intencao: "comparar" });
    expect(i("@tecnologia e ia comparar")).toMatchObject({ intencao: "comparar", temas: ["tecnologia-ia"], termos: [] });
  });

  it("sem @, o rótulo completo do tema na frase também vale", () => {
    expect(i("compare saúde e educação")).toMatchObject({ intencao: "comparar", temas: ["saude", "educacao"] });
    expect(i("educação e saúde")).toMatchObject({ intencao: "executivo", temas: ["educacao", "saude"] });
    expect(i("diferenças em meio ambiente")).toMatchObject({ intencao: "diferencas", temas: ["meio-ambiente"] });
  });

  it("palavra que não é tema nem comando vira busca, no tema ou em todos", () => {
    expect(i("fila do SUS")).toMatchObject({ intencao: "busca", temas: [], termos: ["fila", "sus"], termosOriginais: ["fila", "sus"] });
    expect(i("@saude fila")).toMatchObject({ intencao: "busca", temas: ["saude"], termos: ["fila"] });
    expect(i("Fertilizantes")).toMatchObject({ intencao: "busca", termos: ["fertilizantes"], termosOriginais: ["fertilizantes"] });
    expect(i("saúde mental")).toMatchObject({ intencao: "busca", temas: ["saude"], termos: ["mental"] });
    expect(i("crianças")).toMatchObject({ termos: ["criancas"], termosOriginais: ["crianças"] });
  });

  it("panorama, ajuda e tema desconhecido", () => {
    expect(i("comparar os temas")).toMatchObject({ intencao: "panorama", temas: [] });
    expect(i("panorama")).toMatchObject({ intencao: "panorama" });
    expect(i("ajuda")).toMatchObject({ intencao: "ajuda" });
    expect(i("oi")).toMatchObject({ intencao: "ajuda" });
    expect(i("@xyz")).toMatchObject({ intencao: "desconhecido", desconhecidos: ["xyz"] });
    expect(i("@xyz @saude")).toMatchObject({ intencao: "executivo", temas: ["saude"], desconhecidos: ["xyz"] });
  });

  it("temas que a resposta precisa baixar", () => {
    expect(temasNecessarios(i("@saude"), temas)).toEqual(["saude"]);
    expect(temasNecessarios(i("fila"), temas)).toEqual(ids);
    expect(temasNecessarios(i("comparar os temas"), temas)).toEqual(ids);
    expect(temasNecessarios(i("ajuda"), temas)).toEqual([]);
  });
});

describe("busca por palavra", () => {
  const cit = (arquivo: string, trecho: string) => [{ arquivo, pagina: 1, trecho }];
  const F = "plano-de-governo_flavio.pdf";
  const L = "Programa-Governo-LULA-2026.pdf";
  const comp: Comparacao = {
    theme_id: "saude",
    gerado_em: "2026-10-18T12:00:00-03:00",
    fontes: [],
    candidatos: {
      "flavio-bolsonaro": {
        nao_encontrado: false,
        resumo: [
          { texto: "Reduzir as filas.", camada: "plano", citacoes: cit(F, "acabar com a espera") },
          { texto: "Agricultura sustentável.", camada: "plano", citacoes: cit(F, "produção sustentável") },
        ],
        executivo: [],
      },
      lula: {
        nao_encontrado: false,
        resumo: [{ texto: "Ampliar especialistas.", camada: "plano", citacoes: cit(L, "fila única no SUS") }],
        executivo: [],
      },
    },
    semelhancas: [{ texto: "Prontuário único.", camada: "plano", citacoes: { "flavio-bolsonaro": cit(F, "x"), lula: cit(L, "y") } }],
    diferencas: [],
    omissoes: [{ tratado_por: "lula", texto: "Dignidade menstrual.", camada: "plano", citacoes: cit(L, "absorventes no SUS") }],
  };

  it("termo curto só como palavra inteira; termo longo como começo de palavra, sem o plural", () => {
    expect(contem("sus", palavras("o SUS de todos"))).toBe(true);
    expect(contem("sus", palavras("produção sustentável"))).toBe(false);
    expect(contem("filas", palavras("fila única"))).toBe(true);
    expect(contem("fila", palavras("as filas"))).toBe(true);
  });

  it("acha no texto ou no trecho citado, por candidato, e deixa de fora quem não menciona", () => {
    const [r] = buscar(["fila"], ["saude"], { saude: comp });
    expect(r.candidatos["flavio-bolsonaro"].resumo.map((b) => b.texto)).toEqual(["Reduzir as filas."]);
    expect(r.candidatos.lula.resumo.map((b) => b.texto)).toEqual(["Ampliar especialistas."]);
    const [s] = buscar(["sus"], ["saude"], { saude: comp });
    expect(s.candidatos["flavio-bolsonaro"].resumo).toEqual([]);
    expect(s.candidatos.lula.omissoes.map((o) => o.texto)).toEqual(["Dignidade menstrual."]);
    expect(s.total).toBe(2);
    expect(buscar(["prontuario"], ["saude"], { saude: comp })[0].semelhancas).toHaveLength(1);
    expect(buscar(["inexistente"], ["saude"], { saude: comp })).toEqual([]);
  });

  it("quem casa com mais termos vem primeiro, mantendo a ordem do JSON no empate", () => {
    const [r] = buscar(["sustentavel", "filas"], ["saude"], { saude: comp });
    expect(r.candidatos["flavio-bolsonaro"].resumo.map((b) => b.texto)).toEqual(["Reduzir as filas.", "Agricultura sustentável."]);
    const [d] = buscar(["producao", "sustentavel"], ["saude"], { saude: comp });
    expect(d.candidatos["flavio-bolsonaro"].resumo.map((b) => b.texto)).toEqual(["Agricultura sustentável."]);
  });
});
