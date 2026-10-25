import type { Rota } from "./tipos";

/** URL pública (decisão 5) -> rota. `temas` são os ids publicados. */
export function resolverRota(caminho: string, temas: string[]): Rota {
  const p = caminho.replace(/\/index\.html$/, "/").replace(/\/+$/, "") || "/";
  if (p === "/") return { tipo: "inicio" };
  if (p === "/semelhancas") return { tipo: "semelhancas" };
  if (p === "/diferencas") return { tipo: "diferencas" };
  if (p === "/metodologia") return { tipo: "metodologia" };
  if (p === "/sobre") return { tipo: "sobre" };
  if (p === "/chat") return { tipo: "chat" };
  if (p === "/chat/conversa") return { tipo: "conversa" };
  const m = /^\/tema\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(p);
  if (m && temas.includes(m[1])) return { tipo: "tema", id: m[1] };
  return { tipo: "nao-encontrada" };
}

export function caminhoDaRota(r: Rota): string {
  switch (r.tipo) {
    case "inicio":
      return "/";
    case "tema":
      return `/tema/${r.id}`;
    case "nao-encontrada":
      return "/404";
    case "conversa":
      return "/chat/conversa";
    default:
      return `/${r.tipo}`;
  }
}

export function linkPdf(arquivo: string, pagina: number): string {
  return `/pdf/visualizador.html?arquivo=${encodeURIComponent(arquivo)}&pagina=${pagina}`;
}

export function dataBR(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

/** Filtro da tela de tema (porta 1): `?filtro=semelhancas` ou `?filtro=diferencas`; sem o parâmetro, ou com
 *  valor desconhecido, "Mostrar tudo". */
export type Filtro = "tudo" | "semelhancas" | "diferencas";

export function filtroDaUrl(busca: string): Filtro {
  const f = new URLSearchParams(busca).get("filtro");
  return f === "semelhancas" || f === "diferencas" ? f : "tudo";
}

/** Endereço do tema com o filtro: "Mostrar tudo" tira o parâmetro. */
export function urlComFiltro(caminho: string, f: Filtro): string {
  return f === "tudo" ? caminho : `${caminho}?filtro=${f}`;
}
