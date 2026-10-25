// AC 9 e AC 24: textos exatos de "não encontrado" e de visão transversal vazia.
// Estruturas sintéticas de TESTE: nenhum desses textos é publicado.
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "../src/App";
import { NAO_ENCONTRADO, TRANSVERSAL_VAZIA, type Comparacao, type DadosPagina } from "../src/tipos";

const manifesto: DadosPagina["manifesto"] = {
  temas: [{ id: "saude", rotulo: "Saúde", icone: "cruz", descricao: "teste" }],
  fontes: [
    { arquivo: "plano-de-governo_flavio.pdf", candidato: "flavio-bolsonaro", partido: "PL", sha256: "a".repeat(64), coletado_em: "2026-10-17", url_tse: "https://www.tse.jus.br/", conferido_tse: false },
    { arquivo: "Programa-Governo-LULA-2026.pdf", candidato: "lula", partido: "PT", sha256: "b".repeat(64), coletado_em: "2026-10-17", url_tse: "https://www.tse.jus.br/", conferido_tse: false },
  ],
  candidatos: { "flavio-bolsonaro": { nome: "Flávio Bolsonaro", partido: "PL" }, lula: { nome: "Lula", partido: "PT" } },
  responsavel: null,
};

const comp: Comparacao = {
  theme_id: "saude",
  gerado_em: "2026-10-17T20:00:00-03:00",
  fontes: [],
  candidatos: {
    "flavio-bolsonaro": { nao_encontrado: false, resumo: [{ texto: "item de teste", camada: "plano", citacoes: [{ arquivo: "plano-de-governo_flavio.pdf", pagina: 1, trecho: "teste" }] }], executivo: [] },
    lula: { nao_encontrado: true, resumo: [], executivo: [] },
  },
  semelhancas: [],
  diferencas: [],
  omissoes: [],
};

function html(d: Partial<DadosPagina>) {
  return renderToString(<App inicial={{ manifesto, comparacoes: {}, rota: { tipo: "inicio" }, ...d }} />);
}

describe("textos fixos", () => {
  it("nao encontrado: área do candidato sem bullet mostra o texto exato", () => {
    const h = html({ rota: { tipo: "tema", id: "saude" }, comparacoes: { saude: comp } });
    const painel = h.slice(h.indexOf('id="painel-lula"'));
    expect(painel).toContain(`<p class="nao-encontrado">${NAO_ENCONTRADO}</p>`);
    expect(NAO_ENCONTRADO).toBe("Não encontrado no plano de governo registrado no TSE");
    expect(h.slice(h.indexOf('id="painel-flavio-bolsonaro"'), h.indexOf('id="painel-lula"'))).not.toContain(NAO_ENCONTRADO);
  });

  it("vazia: visão transversal sem itens mostra o texto exato", () => {
    for (const tipo of ["semelhancas", "diferencas"] as const) {
      const h = html({ rota: { tipo }, comparacoes: { saude: comp } });
      expect(h).toContain(TRANSVERSAL_VAZIA);
    }
    expect(TRANSVERSAL_VAZIA).toBe("Nenhum ponto encontrado nos temas publicados");
  });
});
