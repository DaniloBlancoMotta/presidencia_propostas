import { useState, type ReactNode } from "react";
import { Seta, SetaDireita } from "./icones";
import { linkPdf } from "./rotas";
import { CANDIDATO_DO_ARQUIVO, type CandidatoId, type Citacao, type Manifesto } from "./tipos";

/** "Nome (Partido)", com espaço não separável antes do parêntese (crit. 46). */
function nomeCandidato(m: Manifesto, c: CandidatoId) {
  const x = m.candidatos[c];
  return `${x.nome}\xa0(${x.partido})`;
}

/** Nome visível do candidato, com o quadradinho na cor de identidade dele (S7). O quadradinho fica preso à
 *  primeira palavra (.cand não quebra); o resto do nome quebra normalmente, menos o "(Partido)". */
export function NomeCand({ manifesto, c }: { manifesto: Manifesto; c: CandidatoId }) {
  const x = manifesto.candidatos[c];
  const [primeira, ...resto] = x.nome.split(" ");
  return (
    <span className="cand" data-cand={c}>
      {primeira}
      <span className="cand-resto">{`${resto.length ? ` ${resto.join(" ")}` : ""}\xa0(${x.partido})`}</span>
    </span>
  );
}

/** Citações consecutivas do mesmo arquivo e da mesma página formam um grupo (crit. 10): todos os trechos,
 *  uma só linha "arquivo · pág. N" e um só "Ver no PDF". */
export function agruparCitacoes(citacoes: Citacao[]): Citacao[][] {
  const grupos: Citacao[][] = [];
  for (const c of citacoes) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo[0].arquivo === c.arquivo && ultimo[0].pagina === c.pagina) ultimo.push(c);
    else grupos.push([c]);
  }
  return grupos;
}

/** Omissões na ordem vigente (crit. 6): primeiro as do candidato que aparece primeiro; dentro de cada
 *  candidato, a ordem do JSON. */
export function ordenarOmissoes<T extends { tratado_por: CandidatoId }>(omissoes: T[], ordem: CandidatoId[]): T[] {
  return ordem.flatMap((c) => omissoes.filter((o) => o.tratado_por === c));
}

/** Cada trecho leva o candidato do arquivo citado: as aspas de abertura ficam na cor dele (crit. 64). */
export function ListaCitacoes({ citacoes }: { citacoes: Citacao[] }) {
  return (
    <ul className="citacoes" role="list">
      {agruparCitacoes(citacoes).map((g, i) => (
        <li key={i} className="citacao">
          {g.map((c, j) => (
            <blockquote key={j} className="trecho" data-cand={CANDIDATO_DO_ARQUIVO[c.arquivo]}>
              <span className="aspas" aria-hidden="true">
                “
              </span>
              {c.trecho}”
            </blockquote>
          ))}
          <p className="origem">
            <span className="onde">
              <span className="arquivo">{g[0].arquivo}</span> · <span className="pagina">{`pág.\xa0${g[0].pagina}`}</span>
            </span>
            <a className="ver-pdf" href={linkPdf(g[0].arquivo, g[0].pagina)} target="_blank" rel="noopener">
              Ver no PDF<span className="sr"> (abre em nova aba, página {g[0].pagina})</span>
              <SetaDireita />
            </a>
          </p>
        </li>
      ))}
    </ul>
  );
}

/** Item expansível: número, texto resumido e o indicador ▸/▾; ao abrir, o conteúdo surge (crit. 66) — só
 *  quando a pessoa abre: um item que já chega aberto não anima. */
function Item(props: { n?: number; rotulo?: ReactNode; texto: string; cand?: CandidatoId; aberto?: boolean; children: ReactNode }) {
  const [surgir, setSurgir] = useState(false);
  return (
    <li className={props.cand ? "item omissao" : "item"} data-cand={props.cand}>
      <details open={props.aberto}>
        <summary onClick={() => setSurgir(true)}>
          {props.n !== undefined && (
            <span className="num" aria-hidden="true">
              {String(props.n).padStart(2, "0")}
            </span>
          )}
          <span className="resumo-item">
            {props.rotulo && <span className="selo">{props.rotulo}</span>}
            <span className="texto-item">{props.texto}</span>
          </span>
          <Seta />
        </summary>
        <div className={surgir ? "corpo surgindo" : "corpo"}>{props.children}</div>
      </details>
    </li>
  );
}

/** Bullet expansível: o texto resumido; ao expandir, trechos, arquivo, página e "Ver no PDF". */
export function ItemCitado(props: {
  n?: number;
  texto: string;
  citacoes: Citacao[];
  rotulo?: ReactNode;
  aberto?: boolean;
  /** Omissão: o item fica no tom do candidato que trata do ponto. */
  cand?: CandidatoId;
}) {
  return (
    <Item n={props.n} rotulo={props.rotulo} texto={props.texto} cand={props.cand} aberto={props.aberto}>
      <ListaCitacoes citacoes={props.citacoes} />
    </Item>
  );
}

/** Item de semelhança ou diferença: o mesmo componente para os dois lados, na ordem vigente. O nome de cada
 *  lado é h3 logo abaixo de um h2 e h4 abaixo de um h3 (crit. 8). */
export function ItemDoisLados(props: {
  n?: number;
  texto: string;
  citacoes: Record<CandidatoId, Citacao[]>;
  ordem: CandidatoId[];
  manifesto: Manifesto;
  rotulo?: string;
  nivel?: 3 | 4;
}) {
  const Nome = props.nivel === 3 ? "h3" : "h4";
  return (
    <Item n={props.n} rotulo={props.rotulo} texto={props.texto}>
      <div className="par">
        {props.ordem.map((c) => (
          <div key={c} className="lado" data-cand={c}>
            <Nome className="nome-candidato">
              <NomeCand manifesto={props.manifesto} c={c} />
            </Nome>
            <ListaCitacoes citacoes={props.citacoes[c]} />
          </div>
        ))}
      </div>
    </Item>
  );
}

export { nomeCandidato };
