// Estado do chat por tema, fora dos componentes: as duas páginas (/chat e /chat/conversa) leem o mesmo
// estado, e um pedido que termina depois da troca de página ainda chega à conversa. Vive só na memória
// da aba: nada vai para cookie, localStorage ou URL, e recarregar a página zera a conversa.
import { useSyncExternalStore } from "react";
import { perguntaParaAsk, perguntarAsk, TEXTO_CARREGANDO, type RespostaAsk } from "./ask-cliente";
import { interpretar, temasNecessarios, type Consulta } from "./consulta";
import type { Comparacao, Manifesto } from "./tipos";

export interface PerguntaIA {
  estado: "carregando" | "pronta" | "erro";
  pergunta: string; // o texto que foi ao /ask
  resposta?: RespostaAsk;
  erro?: string;
  ms?: number;
}

export interface Mensagem {
  id: number;
  texto: string;
  consulta: Consulta;
  estado: "carregando" | "pronta" | "erro";
  ia?: PerguntaIA;
}

export interface EstadoChat {
  mensagens: Mensagem[];
  comps: Record<string, Comparacao>;
  status: string; // texto da região role="status"
  selecionada: number | null; // a mensagem cujo contexto o painel mostra
}

const VAZIO: EstadoChat = { mensagens: [], comps: {}, status: "", selecionada: null };
let estado: EstadoChat = VAZIO;
let proximo = 0;
const ouvintes = new Set<() => void>();
const pedidos = new Map<string, Promise<Comparacao>>();

function mudar(f: (e: EstadoChat) => EstadoChat) {
  estado = f(estado);
  for (const o of ouvintes) o();
}

function assinar(o: () => void) {
  ouvintes.add(o);
  return () => ouvintes.delete(o);
}

/** O estado atual; no pré-render, sempre vazio (a conversa só existe no navegador). */
export function usarChat(): EstadoChat {
  return useSyncExternalStore(assinar, () => estado, () => VAZIO);
}

function mudarMensagem(id: number, f: (m: Mensagem) => Mensagem) {
  mudar((e) => ({ ...e, mensagens: e.mensagens.map((m) => (m.id === id ? f(m) : m)) }));
}

function baixar(id: string): Promise<Comparacao> {
  let p = pedidos.get(id);
  if (!p) {
    p = fetch(`/comparacoes/${id}.json`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<Comparacao>;
    });
    p.catch(() => pedidos.delete(id));
    pedidos.set(id, p);
  }
  return p;
}

/** Comparações que a página já trouxe no HTML entram no estado sem novo download. */
export function semear(comps: Record<string, Comparacao>) {
  const novas = Object.keys(comps).filter((id) => !estado.comps[id]);
  if (novas.length) mudar((e) => ({ ...e, comps: { ...comps, ...e.comps } }));
}

/** Acrescenta a pergunta, baixa os temas que faltam e marca a resposta pronta (ou com erro).
 *  `titulo(consulta)` dá o texto anunciado quando a resposta fica pronta. Devolve o id da mensagem. */
export function enviar(bruto: string, manifesto: Manifesto, titulo: (c: Consulta) => string): number | null {
  const t = bruto.trim();
  if (!t) return null;
  const consulta = interpretar(t, manifesto.temas);
  const id = ++proximo;
  const faltam = temasNecessarios(consulta, manifesto.temas).filter((x) => !estado.comps[x]);
  const pronta = (situacao: Mensagem["estado"]) => {
    mudarMensagem(id, (m) => ({ ...m, estado: situacao }));
    mudar((e) => ({
      ...e,
      status: situacao === "erro" ? "Não foi possível carregar os dados do tema." : `Resposta pronta: ${titulo(consulta)}.`,
    }));
  };
  mudar((e) => ({
    ...e,
    mensagens: [...e.mensagens, { id, texto: t, consulta, estado: faltam.length ? "carregando" : "pronta" }],
    selecionada: id,
    status: faltam.length ? "Buscando nos planos…" : e.status,
  }));
  if (!faltam.length) pronta("pronta");
  else
    Promise.all(faltam.map(baixar)).then(
      (novos) => {
        mudar((e) => ({ ...e, comps: { ...e.comps, ...Object.fromEntries(faltam.map((x, i) => [x, novos[i]])) } }));
        pronta("pronta");
      },
      () => pronta("erro"),
    );
  return id;
}

/** Pergunta livre ao /ask (só na prévia), guardando a pergunta enviada e o tempo de resposta. */
export function perguntarIA(id: number, manifesto: Manifesto) {
  const url = manifesto.ask;
  const m = estado.mensagens.find((x) => x.id === id);
  if (!url || !m) return;
  const pergunta = perguntaParaAsk(m.texto, manifesto.temas);
  const inicio = performance.now();
  mudarMensagem(id, (x) => ({ ...x, ia: { estado: "carregando", pergunta } }));
  mudar((e) => ({ ...e, status: TEXTO_CARREGANDO, selecionada: id }));
  void perguntarAsk(url, pergunta, manifesto).then((r) => {
    const ms = Math.round(performance.now() - inicio);
    if (r.tipo === "ok") {
      mudarMensagem(id, (x) => ({ ...x, ia: { estado: "pronta", pergunta, resposta: r.resposta, ms } }));
      mudar((e) => ({ ...e, status: r.resposta.origem === "extrativo" ? "Trechos dos planos prontos." : "Resposta da IA pronta." }));
    } else {
      mudarMensagem(id, (x) => ({ ...x, ia: { estado: "erro", pergunta, erro: r.mensagem, ms } }));
      mudar((e) => ({ ...e, status: r.mensagem }));
    }
  });
}

export function selecionar(id: number) {
  mudar((e) => ({ ...e, selecionada: id }));
}

export function limpar() {
  mudar((e) => ({ ...e, mensagens: [], selecionada: null, status: "" }));
}
