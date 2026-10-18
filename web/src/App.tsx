import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { Inicio, Metodologia, NaoEncontrada, Sobre, Tema, Transversal } from "./paginas";
import { caminhoDaRota, dataBR, resolverRota } from "./rotas";
import { AVISO_IA, CANDIDATOS_BASE, type CandidatoId, type Comparacao, type DadosPagina, type Rota } from "./tipos";

export type Ordem = "ab" | "ba";

export function candidatosNaOrdem(o: Ordem): CandidatoId[] {
  return o === "ab" ? CANDIDATOS_BASE : [...CANDIDATOS_BASE].reverse();
}

export function tituloDaRota(r: Rota, d: DadosPagina): string {
  const site = "Compare os planos de governo 2026";
  switch (r.tipo) {
    case "inicio":
      return site;
    case "tema":
      return d.manifesto.temas.find((t) => t.id === r.id)?.rotulo ?? site;
    case "semelhancas":
      return "Semelhanças";
    case "diferencas":
      return "Diferenças";
    case "metodologia":
      return "Como funciona";
    case "sobre":
      return "Sobre os dados";
    default:
      return "Página não encontrada";
  }
}

async function carregarDados(rota: Rota, atual: DadosPagina): Promise<DadosPagina> {
  const precisa =
    rota.tipo === "tema" ? [rota.id] : rota.tipo === "semelhancas" || rota.tipo === "diferencas" ? atual.manifesto.temas.map((t) => t.id) : [];
  const comparacoes: Record<string, Comparacao> = { ...atual.comparacoes };
  await Promise.all(
    precisa
      .filter((id) => !comparacoes[id])
      .map(async (id) => {
        const r = await fetch(`/comparacoes/${id}.json`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        comparacoes[id] = (await r.json()) as Comparacao;
      }),
  );
  return { rota, manifesto: atual.manifesto, comparacoes };
}

export function App({ inicial }: { inicial: DadosPagina }) {
  const [dados, setDados] = useState(inicial);
  const [ordem, setOrdem] = useState<Ordem>("ab");

  // A ordem foi sorteada pelo script inline do <head> antes da 1ª pintura (decisão 12).
  useEffect(() => {
    const o = document.documentElement.dataset.ordem;
    if (o === "ab" || o === "ba") setOrdem(o);
  }, []);

  const trocar = useCallback(() => {
    setOrdem((o) => {
      const n: Ordem = o === "ab" ? "ba" : "ab";
      document.documentElement.dataset.ordem = n;
      return n;
    });
  }, []);

  const ir = useCallback(
    async (caminho: string, empilhar: boolean) => {
      const rota = resolverRota(caminho, dados.manifesto.temas.map((t) => t.id));
      if (rota.tipo === "nao-encontrada") {
        window.location.assign(caminho); // o servidor responde 404
        return;
      }
      try {
        const novo = await carregarDados(rota, dados);
        if (empilhar) history.pushState(null, "", caminhoDaRota(rota));
        setDados(novo);
        document.title = tituloDaRota(rota, novo);
        window.scrollTo(0, 0);
        requestAnimationFrame(() => document.getElementById("titulo")?.focus());
      } catch {
        window.location.assign(caminho);
      }
    },
    [dados],
  );

  useEffect(() => {
    const voltar = () => void ir(window.location.pathname, false);
    window.addEventListener("popstate", voltar);
    return () => window.removeEventListener("popstate", voltar);
  }, [ir]);

  function aoClicar(e: MouseEvent<HTMLDivElement>) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as HTMLElement).closest("a");
    if (!a || a.target || a.origin !== window.location.origin) return;
    if (a.pathname.startsWith("/pdf/") || a.pathname.startsWith("/comparacoes/")) return;
    e.preventDefault();
    void ir(a.pathname, true);
  }

  const lista = candidatosNaOrdem(ordem);
  const base = { manifesto: dados.manifesto, ordem: lista };
  const r = dados.rota;
  let conteudo;
  if (r.tipo === "inicio") conteudo = <Inicio {...base} />;
  else if (r.tipo === "tema") {
    const tema = dados.manifesto.temas.find((t) => t.id === r.id)!;
    conteudo = <Tema key={r.id} {...base} tema={tema} comp={dados.comparacoes[r.id]} />;
  } else if (r.tipo === "semelhancas" || r.tipo === "diferencas")
    conteudo = <Transversal key={r.tipo} {...base} tipo={r.tipo} comparacoes={dados.comparacoes} />;
  else if (r.tipo === "metodologia") conteudo = <Metodologia {...base} />;
  else if (r.tipo === "sobre") conteudo = <Sobre {...base} />;
  else conteudo = <NaoEncontrada {...base} />;

  const coleta = dados.manifesto.fontes.map((f) => f.coletado_em).sort()[0];
  return (
    <div className="pagina" onClick={aoClicar}>
      <a className="pular" href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className="topo">
        <div className="faixa">
          <a className="marca" href="/">
            Compare os planos de governo 2026
          </a>
          <button type="button" className="botao trocar" onClick={trocar}>
            Trocar ordem dos candidatos
          </button>
        </div>
        <p className="aviso-ia" role="note">
          {AVISO_IA}
        </p>
      </header>
      <main id="conteudo" className="conteudo">
        {conteudo}
      </main>
      <footer className="rodape">
        <p className="coleta">Documentos coletados do TSE em {dataBR(coleta)}</p>
        <nav aria-label="Rodapé">
          <a href="/metodologia">Como funciona</a> · <a href="/sobre">Sobre os dados</a>
        </nav>
      </footer>
    </div>
  );
}
