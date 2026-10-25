// Decisões da navegação no cliente (App.tsx), puras para serem provadas no nível unitário (C28 a C31).
import type { DadosPagina, Rota } from "./tipos";

/** Cada navegação recebe um número; só a mais recente chega à tela (crit. 31). */
export function criarVez() {
  let ultima = 0;
  return {
    nova: () => ++ultima,
    vale: (n: number) => n === ultima,
  };
}

/** Ao empilhar uma rota: a entrada que fica para trás guarda a rolagem de quem sai, e a nova começa no topo
 *  (crit. 29). O resto do estado da entrada atual é mantido. */
export function estadosAoEmpilhar(atual: unknown, y: number): { saida: Record<string, unknown>; nova: { y: number } } {
  const base = atual && typeof atual === "object" ? (atual as Record<string, unknown>) : {};
  return { saida: { ...base, y }, nova: { y: 0 } };
}

/** Rolagem a devolver quando o navegador volta a uma entrada: a guardada nela, ou o topo. */
export function rolagemDoEstado(estado: unknown): number {
  const y = estado && typeof estado === "object" ? (estado as { y?: unknown }).y : undefined;
  return typeof y === "number" ? y : 0;
}

/** Destino da rolagem depois de trocar de rota: a âncora do endereço, se ela existe na página e a posição é o
 *  topo; senão a posição (a guardada, no Voltar, ou 0) (crit. 29). */
export function destinoDaRolagem<T>(y: number, alvo: T | null): { alvo: T } | { y: number } {
  return alvo !== null && y === 0 ? { alvo } : { y };
}

/** Temas cujo JSON a rota mostra. */
export function temasDaRota(rota: Rota, atual: DadosPagina): string[] {
  if (rota.tipo === "tema") return [rota.id];
  if (rota.tipo === "semelhancas" || rota.tipo === "diferencas") return atual.manifesto.temas.map((t) => t.id);
  return [];
}

/** Se a rota precisa baixar algo (o JSON de um tema ou o arquivo do chat) antes de aparecer; enquanto baixa, a tela
 *  diz "Carregando…" (crit. 30). */
export function faltaBaixar(rota: Rota, atual: DadosPagina, chatJaCarregado: boolean): boolean {
  if ((rota.tipo === "chat" || rota.tipo === "conversa") && !chatJaCarregado) return true;
  return temasDaRota(rota, atual).some((id) => !atual.comparacoes[id]);
}

/** Âncora da mesma página ("Pular para o conteúdo", índice dos temas): foco no destino, sem buscar dados e
 *  sem entrada nova no histórico (crit. 28). */
export function ancoraDaPagina(link: { pathname: string; search: string; hash: string }, local: { pathname: string; search: string }): boolean {
  return !!link.hash && link.pathname === local.pathname && link.search === local.search;
}
