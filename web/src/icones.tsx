// Ícones SVG inline, monocromáticos (currentColor), sem associação a candidato (decisão 22).
const CAMINHOS: Record<string, string> = {
  semelhancas: "M5 9h14M5 15h14",
  chat: "M4 5h16v10H11l-5 4v-4H4V5ZM8 9h8M8 12h5",
  diferencas: "M5 9h14M5 15h14M16 5 8 19",
  maos: "M4 14c2 0 3-2 5-2h4a2 2 0 0 1 0 4h-3m-6 2 3 2h7l5-5a2 2 0 0 0-3-3l-3 3M9 7a3 3 0 1 0 6 0 3 3 0 0 0-6 0",
  escudo: "M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z",
  cruz: "M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6V4Z",
  chip: "M8 8h8v8H8zM10 3v3M14 3v3M10 18v3M14 18v3M3 10h3M3 14h3M18 10h3M18 14h3M6 6h12v12H6z",
  livro: "M4 5c3-1 6-1 8 1 2-2 5-2 8-1v14c-3-1-6-1-8 1-2-2-5-2-8-1V5ZM12 6v14",
  folha: "M5 19c0-8 5-14 15-14 0 10-6 15-14 15M5 19l8-8",
  carrinho: "M3 4h2l2 11h11l2-8H6M9 20a1 1 0 1 0 0-.1M17 20a1 1 0 1 0 0-.1",
  espiga: "M12 21V8M12 8c-2-1-3-3-3-5 2 0 3 2 3 5Zm0 0c2-1 3-3 3-5-2 0-3 2-3 5Zm0 4c-2-1-4-1-5-3 2-1 4 0 5 3Zm0 0c2-1 4-1 5-3-2-1-4 0-5 3Zm0 4c-2-1-4-1-5-3 2-1 4 0 5 3Zm0 0c2-1 4-1 5-3-2-1-4 0-5 3Z",
};

export function Icone({ nome, classe = "icone" }: { nome: string; classe?: string }) {
  return (
    <svg className={classe} viewBox="0 0 24 24" width="32" height="32" aria-hidden="true" focusable="false">
      <path d={CAMINHOS[nome] ?? CAMINHOS.livro} fill="none" stroke="currentColor" strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Glifos fora do subconjunto latino das fontes (▸ ▾ ← → ⇄) são SVG com aria-hidden, nunca texto (crit. 69).
function Desenho({ classe, d, cheio }: { classe: string; d: string; cheio?: boolean }) {
  const traco = cheio
    ? { fill: "currentColor" }
    : { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg className={classe} viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
      <path d={d} {...traco} />
    </svg>
  );
}

/** Indicador de item expansível: ▸ fechado; o CSS gira 90° quando aberto (▾). */
export const Seta = () => <Desenho classe="seta" d="M7 4 19 12 7 20Z" cheio />;
export const SetaVoltar = () => <Desenho classe="seta-voltar" d="M20 12H5m0 0 6-6m-6 6 6 6" />;
export const SetaDireita = () => <Desenho classe="seta-direita" d="M4 12h15m0 0-6-6m6 6-6 6" />;
export const IconeTrocar = () => <Desenho classe="icone-trocar" d="M7 7h12m0 0-4-4m4 4-4 4M17 17H5m0 0 4-4m-4 4 4 4" />;
