// Cliente do POST /ask (plano-final §11), usado só no build de prévia (manifesto.ask). Nenhum cookie,
// nenhum referrer; a resposta é validada antes de virar tela, e citação de arquivo que não é do
// candidato é descartada (não vira link "Ver no PDF").
import type { CandidatoId, Citacao, Manifesto, TemaPublico } from "./tipos";

export interface AreaAsk {
  nao_encontrado: boolean;
  resumo: { texto: string; citacoes: Citacao[] }[];
}

export interface RecorteAsk {
  arquivo: string;
  pagina: number;
  paginas: number[];
  viradas: [number, number][]; // [posição no texto, página que começa ali]
  texto: string;
}

/** O que o /ask usou: a pergunta como foi processada, os termos da busca e os recortes de cada plano
 *  que foram ao modelo. Numa resposta do cache, `pergunta` é a que foi de fato respondida. */
export interface ContextoAsk {
  pergunta: string;
  termos: string[];
  trechos: Record<CandidatoId, RecorteAsk[]>;
}

export interface RespostaAsk {
  origem: "gerado" | "cache" | "extrativo";
  camada: "plano";
  recusada?: boolean;
  motivo?: "opiniao" | "previsao" | "ataque" | "fora_dos_planos";
  candidatos: Record<CandidatoId, AreaAsk>;
  modelos: string[];
  contexto: ContextoAsk | null;
}

export type ResultadoAsk = { tipo: "ok"; resposta: RespostaAsk } | { tipo: "erro"; mensagem: string };

export const ESPERA_ASK_MS = 15_000;
export const TEXTO_CARREGANDO = "Buscando nos dois planos…";
export const TEXTO_INDISPONIVEL = "Pergunta livre indisponível no momento — veja os temas acima";
export const TEXTO_RECUSA =
  "Este site só mostra o que os planos de governo registrados no TSE dizem. Ele não opina, não compara qual é melhor e não faz previsões.";
export const TAM_MAX_PERGUNTA = 300;

/** A mensagem do chat como pergunta: `@saude` vira "Saúde"; espaços colapsados; até 300 caracteres. */
export function perguntaParaAsk(texto: string, temas: TemaPublico[]): string {
  return texto
    .replace(/@([\p{L}\p{N}-]+)/gu, (m, id: string) => temas.find((t) => t.id === id)?.rotulo ?? m)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, TAM_MAX_PERGUNTA);
}

export function validarResposta(dados: unknown, manifesto: Manifesto): RespostaAsk | null {
  if (!dados || typeof dados !== "object") return null;
  const d = dados as Record<string, unknown>;
  if (!["gerado", "cache", "extrativo"].includes(d.origem as string) || d.camada !== "plano") return null;
  const cands = d.candidatos as Record<string, unknown> | undefined;
  if (!cands || typeof cands !== "object") return null;
  const candidatos = {} as Record<CandidatoId, AreaAsk>;
  for (const f of manifesto.fontes) {
    const a = cands[f.candidato] as { nao_encontrado?: unknown; resumo?: unknown } | undefined;
    if (!a || !Array.isArray(a.resumo)) return null;
    const resumo = (a.resumo as { texto?: unknown; citacoes?: unknown }[])
      .filter((b) => typeof b?.texto === "string" && Array.isArray(b.citacoes))
      .map((b) => ({
        texto: b.texto as string,
        citacoes: (b.citacoes as Citacao[]).filter(
          (c) => c?.arquivo === f.arquivo && Number.isInteger(c.pagina) && c.pagina >= 1 && typeof c.trecho === "string",
        ),
      }))
      .filter((b) => b.citacoes.length > 0);
    candidatos[f.candidato] = { nao_encontrado: resumo.length === 0, resumo };
  }
  const motivos = ["opiniao", "previsao", "ataque", "fora_dos_planos"];
  return {
    origem: d.origem as RespostaAsk["origem"],
    camada: "plano",
    recusada: d.recusada === true,
    motivo: motivos.includes(d.motivo as string) ? (d.motivo as RespostaAsk["motivo"]) : undefined,
    candidatos,
    modelos: Array.isArray(d.modelos) ? (d.modelos as unknown[]).filter((x): x is string => typeof x === "string") : [],
    contexto: validarContexto(d.contexto, manifesto),
  };
}

function validarContexto(bruto: unknown, manifesto: Manifesto): ContextoAsk | null {
  const c = bruto as { pergunta?: unknown; termos?: unknown; trechos?: Record<string, unknown> } | null;
  if (!c || typeof c.pergunta !== "string" || typeof c.trechos !== "object" || c.trechos === null) return null;
  const trechos = {} as Record<CandidatoId, RecorteAsk[]>;
  for (const f of manifesto.fontes) {
    const lista = Array.isArray(c.trechos[f.candidato]) ? (c.trechos[f.candidato] as RecorteAsk[]) : [];
    trechos[f.candidato] = lista
      .filter((r) => r?.arquivo === f.arquivo && typeof r.texto === "string" && Number.isInteger(r.pagina))
      .map((r) => ({
        arquivo: r.arquivo,
        pagina: r.pagina,
        paginas: Array.isArray(r.paginas) ? r.paginas.filter(Number.isInteger) : [r.pagina],
        viradas: Array.isArray(r.viradas) ? r.viradas.filter((v) => Array.isArray(v) && v.length === 2 && v.every(Number.isInteger)) : [[0, r.pagina]],
        texto: r.texto,
      }));
  }
  const termos = Array.isArray(c.termos) ? (c.termos as unknown[]).filter((x): x is string => typeof x === "string") : [];
  return { pergunta: c.pergunta, termos, trechos };
}

export async function perguntarAsk(url: string, pergunta: string, manifesto: Manifesto, espera = ESPERA_ASK_MS): Promise<ResultadoAsk> {
  const ctl = new AbortController();
  const relogio = setTimeout(() => ctl.abort(), espera);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pergunta }),
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
      signal: ctl.signal,
    });
    if (r.status === 429) {
      const s = Number(r.headers.get("Retry-After"));
      const min = Number.isFinite(s) && s > 0 ? Math.ceil(s / 60) : 60;
      return { tipo: "erro", mensagem: `Você chegou ao limite de 10 perguntas por hora. Tente de novo em ${min} min.` };
    }
    const dados = await r.json().catch(() => null);
    if (r.status === 400 && (dados as { erro?: string } | null)?.erro === "pergunta_muito_longa")
      return { tipo: "erro", mensagem: `A pergunta passa de ${TAM_MAX_PERGUNTA} caracteres.` };
    const resposta = r.ok ? validarResposta(dados, manifesto) : null;
    return resposta ? { tipo: "ok", resposta } : { tipo: "erro", mensagem: TEXTO_INDISPONIVEL };
  } catch {
    return { tipo: "erro", mensagem: TEXTO_INDISPONIVEL };
  } finally {
    clearTimeout(relogio);
  }
}
