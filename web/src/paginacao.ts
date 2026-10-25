// Decisões da paginação do visualizador (visualizador.ts), puras para serem provadas no nível unitário
// (C19, C20 e C26). Só o visualizador importa este módulo: ele não divide um pedaço de JS com o site.

/** Um desenho por vez: cada pedido invalida o desenho em curso (`cancelar`), e o laço desenha de novo até um
 *  desenho terminar sem pedido mais novo; assim o pedido mais recente vence (crit. 19). `desenhar` devolve
 *  falso quando `vigente(meu)` deixou de valer no meio do caminho. */
export function filaDeDesenho(desenhar: (meu: number) => Promise<boolean>, cancelar: () => void) {
  let pedido = 0;
  let ocupado = false;
  return {
    vigente: (meu: number) => meu === pedido,
    async pedir() {
      pedido++;
      cancelar();
      if (ocupado) return;
      ocupado = true;
      try {
        while (!(await desenhar(pedido))) {
          // um pedido mais novo chegou: desenha de novo
        }
      } finally {
        ocupado = false;
      }
    },
  };
}

export type Botao = "anterior" | "proxima";

/** Estado dos botões na página `alvo` de `total`. Se o botão focado ficou desabilitado, o foco passa para o
 *  outro, e não para o <body> (crit. 20); `foco` é null quando o foco fica onde está. */
export function botoesDaPagina(alvo: number, total: number, focado: Botao | null) {
  const desabilitado: Record<Botao, boolean> = { anterior: alvo <= 1, proxima: alvo >= total };
  const foco: Botao | null = focado && desabilitado[focado] ? (focado === "anterior" ? "proxima" : "anterior") : null;
  return { desabilitado, foco };
}

/** Só uma largura nova redesenha a página (crit. 26). */
export function redesenharNaLargura(atual: number, desenhada: number): boolean {
  return atual !== desenhada;
}
