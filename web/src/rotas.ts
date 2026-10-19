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
