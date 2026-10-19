import type { ReactNode } from "react";
import { linkPdf } from "./rotas";
import type { CandidatoId, Citacao, Manifesto } from "./tipos";

function nomeCandidato(m: Manifesto, c: CandidatoId) {
  const x = m.candidatos[c];
  return `${x.nome} (${x.partido})`;
}

/** Nome visível do candidato, com o quadradinho na cor de identidade dele (S7). */
export function NomeCand({ manifesto, c }: { manifesto: Manifesto; c: CandidatoId }) {
  return (
    <span className="cand" data-cand={c}>
      {nomeCandidato(manifesto, c)}
    </span>
  );
}

export function ListaCitacoes({ citacoes }: { citacoes: Citacao[] }) {
  return (
    <ul className="citacoes">
      {citacoes.map((c, i) => (
        <li key={i} className="citacao">
          <blockquote className="trecho">“{c.trecho}”</blockquote>
          <p className="origem">
            <span className="arquivo">{c.arquivo}</span> · <span className="pagina">pág. {c.pagina}</span>
          </p>
          <a className="botao ver-pdf" href={linkPdf(c.arquivo, c.pagina)} target="_blank" rel="noopener">
            Ver no PDF<span className="sr"> (abre em nova aba, página {c.pagina})</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Bullet expansível: o texto resumido; ao expandir, trechos, arquivo, página e "Ver no PDF". */
export function ItemCitado(props: {
  texto: string;
  citacoes: Citacao[];
  rotulo?: ReactNode;
  aberto?: boolean;
  /** Omissão: o item fica no tom do candidato que trata do ponto. */
  cand?: CandidatoId;
}) {
  return (
    <li className={props.cand ? "item omissao" : "item"} data-cand={props.cand}>
      <details open={props.aberto}>
        <summary>
          {props.rotulo && <span className="selo">{props.rotulo}</span>}
          <span className="texto-item">{props.texto}</span>
        </summary>
        <ListaCitacoes citacoes={props.citacoes} />
      </details>
    </li>
  );
}

/** Item de semelhança ou diferença: o mesmo componente para os dois lados, na ordem vigente. */
export function ItemDoisLados(props: {
  texto: string;
  citacoes: Record<CandidatoId, Citacao[]>;
  ordem: CandidatoId[];
  manifesto: Manifesto;
  rotulo?: string;
}) {
  return (
    <li className="item">
      <details>
        <summary>
          {props.rotulo && <span className="selo">{props.rotulo}</span>}
          <span className="texto-item">{props.texto}</span>
        </summary>
        <div className="par">
          {props.ordem.map((c) => (
            <section key={c} className="lado" data-cand={c} aria-label={nomeCandidato(props.manifesto, c)}>
              <h4 className="nome-candidato">
                <NomeCand manifesto={props.manifesto} c={c} />
              </h4>
              <ListaCitacoes citacoes={props.citacoes[c]} />
            </section>
          ))}
        </div>
      </details>
    </li>
  );
}

export { nomeCandidato };
