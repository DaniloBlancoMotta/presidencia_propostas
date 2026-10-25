// Decisões da navegação no cliente (App.tsx), puras para serem provadas no nível unitário (C28, C29 e C31).

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

/** Âncora da mesma página ("Pular para o conteúdo", índice dos temas): foco no destino, sem buscar dados e
 *  sem entrada nova no histórico (crit. 28). */
export function ancoraDaPagina(link: { pathname: string; search: string; hash: string }, local: { pathname: string; search: string }): boolean {
  return !!link.hash && link.pathname === local.pathname && link.search === local.search;
}
