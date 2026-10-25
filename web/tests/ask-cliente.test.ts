// /ask na prévia (plano-final §11): pergunta enviada, validação da resposta e os textos de erro.
import { afterEach, describe, expect, it, vi } from "vitest";
import { perguntaParaAsk, perguntarAsk, TEXTO_INDISPONIVEL, validarResposta } from "../src/ask-cliente";
import type { Manifesto } from "../src/tipos";

const F = "plano-de-governo_flavio.pdf";
const L = "Programa-Governo-LULA-2026.pdf";
const manifesto = {
  temas: [{ id: "saude", rotulo: "Saúde", icone: "cruz", descricao: "" }],
  fontes: [
    { arquivo: F, candidato: "flavio-bolsonaro" },
    { arquivo: L, candidato: "lula" },
  ],
} as unknown as Manifesto;

const ok = {
  origem: "gerado",
  camada: "plano",
  candidatos: {
    "flavio-bolsonaro": { nao_encontrado: false, resumo: [{ texto: "A", citacoes: [{ arquivo: F, pagina: 3, trecho: "a" }] }] },
    lula: {
      nao_encontrado: false,
      resumo: [
        { texto: "B", citacoes: [{ arquivo: L, pagina: 5, trecho: "b" }, { arquivo: F, pagina: 1, trecho: "do outro" }] },
        { texto: "C", citacoes: [{ arquivo: "../../x.pdf", pagina: 1, trecho: "c" }] },
      ],
    },
  },
};

function resposta(status: number, corpo: unknown, cabecalhos: Record<string, string> = {}) {
  return new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json", ...cabecalhos } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("cliente do /ask", () => {
  it("troca a menção pelo rótulo e corta em 300 caracteres", () => {
    expect(perguntaParaAsk("  fila   @saude  ", manifesto.temas)).toBe("fila Saúde");
    expect(perguntaParaAsk("x".repeat(400), manifesto.temas)).toHaveLength(300);
  });

  it("valida a resposta e descarta citação de arquivo que não é do candidato", () => {
    const r = validarResposta(ok, manifesto)!;
    expect(r.candidatos.lula.resumo.map((b) => b.texto)).toEqual(["B"]);
    expect(r.candidatos.lula.resumo[0].citacoes.map((c) => c.arquivo)).toEqual([L]);
    expect(r.candidatos["flavio-bolsonaro"].nao_encontrado).toBe(false);
    expect(validarResposta({ ...ok, origem: "inventada" }, manifesto)).toBeNull();
    expect(validarResposta({ ...ok, candidatos: { lula: ok.candidatos.lula } }, manifesto)).toBeNull();
    expect(validarResposta("texto", manifesto)).toBeNull();
  });

  it("contexto: recortes de outro arquivo saem; modelos e termos passam", () => {
    const r = validarResposta(
      {
        ...ok,
        modelos: ["groq:x", 3],
        contexto: {
          pergunta: "fila",
          termos: ["fila"],
          trechos: {
            lula: [
              { arquivo: L, pagina: 5, paginas: [5, 6], viradas: [[0, 5], [9, 6]], texto: "um dois" },
              { arquivo: F, pagina: 1, paginas: [1], viradas: [[0, 1]], texto: "do outro" },
            ],
          },
        },
      },
      manifesto,
    )!;
    expect(r.modelos).toEqual(["groq:x"]);
    expect(r.contexto!.trechos.lula.map((x) => x.texto)).toEqual(["um dois"]);
    expect(r.contexto!.trechos["flavio-bolsonaro"]).toEqual([]);
    expect(validarResposta(ok, manifesto)!.contexto).toBeNull();
  });

  it("manda só a pergunta, sem cookie nem referrer", async () => {
    const f = vi.fn(async () => resposta(200, ok));
    vi.stubGlobal("fetch", f);
    const r = await perguntarAsk("http://127.0.0.1:8099/ask", "fila", manifesto);
    expect(r.tipo).toBe("ok");
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:8099/ask");
    expect(JSON.parse(init.body as string)).toEqual({ pergunta: "fila" });
    expect(init.credentials).toBe("omit");
    expect(init.referrerPolicy).toBe("no-referrer");
  });

  it("429 diz quando tentar de novo; 400 de tamanho; erro de rede e 500 viram indisponível", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => resposta(429, { erro: "limite" }, { "Retry-After": "600" })));
    expect(await perguntarAsk("u", "q", manifesto)).toEqual({ tipo: "erro", mensagem: "Você chegou ao limite de 10 perguntas por hora. Tente de novo em 10 min." });
    vi.stubGlobal("fetch", vi.fn(async () => resposta(400, { erro: "pergunta_muito_longa" })));
    expect(await perguntarAsk("u", "q", manifesto)).toEqual({ tipo: "erro", mensagem: "A pergunta passa de 300 caracteres." });
    vi.stubGlobal("fetch", vi.fn(async () => resposta(500, { erro: "interno" })));
    expect(await perguntarAsk("u", "q", manifesto)).toEqual({ tipo: "erro", mensagem: TEXTO_INDISPONIVEL });
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("rede"))));
    expect(await perguntarAsk("u", "q", manifesto)).toEqual({ tipo: "erro", mensagem: TEXTO_INDISPONIVEL });
  });

  it("depois de 15 s sem resposta, desiste e mostra o texto da §11", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_u: string, init: RequestInit) => new Promise((_, rejeita) => init.signal!.addEventListener("abort", () => rejeita(new Error("abort"))))),
    );
    const p = perguntarAsk("u", "q", manifesto);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(await p).toEqual({ tipo: "erro", mensagem: "Pergunta livre indisponível no momento — veja os temas acima" });
  });
});
