// Chat por tema (AC 38-43): interpreta a mensagem e escolhe o que mostrar dos JSONs aprovados.
// Nada aqui chama rede ou modelo: é regra fixa sobre o texto digitado e busca por palavra.
import type { Bullet, CandidatoId, Citacao, Comparacao, ItemDoisLados, Omissao, TemaPublico } from "./tipos";
import { CANDIDATOS_BASE } from "./tipos";

export type Intencao = "executivo" | "comparar" | "semelhancas" | "diferencas" | "busca" | "panorama" | "ajuda" | "desconhecido";

export interface Consulta {
  intencao: Intencao;
  temas: string[]; // ids, na ordem em que aparecem na mensagem
  termos: string[]; // palavras buscadas, sem acento e em minúsculas
  termosOriginais: string[]; // as mesmas palavras como foram digitadas (em minúsculas), para exibir
  desconhecidos: string[]; // menções com @ que não são tema
}

export function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Palavras sem acento, em minúsculas, sem pontuação. */
export function palavras(s: string): string[] {
  return normalizar(s).split(/[^a-z0-9]+/).filter(Boolean);
}

function chave(s: string): string {
  return palavras(s).join("");
}

/** `@saude`, `@saúde`, `@Meio-Ambiente`, `@meioambiente` ou um prefixo único com 3+ letras (`@seg`). */
export function resolverMencao(bruta: string, temas: TemaPublico[]): string | null {
  const k = chave(bruta);
  if (!k) return null;
  const exato = temas.find((t) => chave(t.id) === k || chave(t.rotulo) === k);
  if (exato) return exato.id;
  if (k.length < 3) return null;
  const prefixo = temas.filter((t) => chave(t.id).startsWith(k) || chave(t.rotulo).startsWith(k));
  return prefixo.length === 1 ? prefixo[0].id : null;
}

const COMPARAR = new Set(["comparar", "compare", "compara", "comparando", "comparacao", "comparacoes", "comparativo", "comparativa", "versus", "vs", "confrontar", "confronto"]);
const SEMELHANCAS = new Set(["semelhanca", "semelhancas", "semelhante", "semelhantes", "comum", "parecido", "parecidos", "parecida", "parecidas", "concordam", "convergem", "convergencia", "convergencias", "iguais"]);
const DIFERENCAS = new Set(["diferenca", "diferencas", "diferente", "diferentes", "divergem", "divergencia", "divergencias", "discordam", "omissao", "omissoes"]);
const RESUMO = new Set(["resumo", "resumos", "resumir", "resuma", "resume", "executivo", "executiva", "sintese", "sintetize", "sintetizar", "principais", "principal", "ponto", "pontos", "chave"]);
const PANORAMA = new Set(["temas", "panorama", "geral", "todos", "tudo"]);
const AJUDA = new Set(["ajuda", "ajudar", "help", "usar", "uso", "funciona", "instrucoes", "comandos"]);
const VAZIAS = new Set([
  "a", "o", "as", "os", "de", "da", "do", "das", "dos", "e", "em", "no", "na", "nos", "nas", "num", "numa", "um", "uma",
  "uns", "umas", "para", "pra", "pro", "por", "pelo", "pela", "pelos", "pelas", "com", "sem", "sobre", "que", "qual",
  "quais", "quem", "como", "onde", "quando", "me", "mostre", "mostrar", "mostra", "quero", "queria", "gostaria", "ver",
  "veja", "diz", "dizem", "dizer", "fala", "falam", "falar", "propoe", "propoem", "propor", "proposta", "propostas",
  "plano", "planos", "governo", "candidato", "candidatos", "candidata", "cada", "entre", "eles", "ele", "ela", "elas",
  "dois", "duas", "ambos", "isso", "isto", "este", "esta", "esse", "essa", "nesse", "neste", "nessa", "nesta", "desse",
  "deste", "dessa", "desta", "ao", "aos", "ou", "se", "ha", "tem", "tema", "sao", "ser", "mais", "muito", "so", "trata",
  "tratam", "faz", "fazem", "fazer", "vai", "vao", "lula", "flavio", "bolsonaro", "pt", "pl", "partido", "presidente",
  "presidencial", "eleicao", "turno", "oi", "ola", "bom", "dia", "boa", "tarde", "noite", "favor", "obrigado",
  "obrigada", "sim", "nao", "lado", "seu", "sua", "seus", "suas", "deles", "delas", "dele", "dela", "agora", "aqui",
]);

interface Palavra {
  original: string;
  norm: string;
}

/** Acha `alvo` (palavras normalizadas) em sequência dentro de `lista` e devolve o índice inicial. */
function acharSequencia(lista: Palavra[], alvo: string[]): number {
  for (let i = 0; i + alvo.length <= lista.length; i++) {
    if (alvo.every((a, j) => lista[i + j].norm === a)) return i;
  }
  return -1;
}

export function interpretar(texto: string, temas: TemaPublico[]): Consulta {
  const pedacos = texto.split(/\s+/).filter(Boolean);
  const ids: string[] = [];
  const desconhecidos: string[] = [];
  let lista: Palavra[] = [];
  for (let i = 0; i < pedacos.length; i++) {
    const m = /^@([\p{L}\p{N}-]*)/u.exec(pedacos[i]);
    if (m) {
      if (!m[1]) continue;
      const id = resolverMencao(m[1], temas);
      if (!id) {
        desconhecidos.push(m[1]);
        continue;
      }
      if (!ids.includes(id)) ids.push(id);
      // "@meio ambiente", "@custo de vida": o resto do rótulo digitado sem hífen faz parte da menção
      const rotulo = palavras(temas.find((t) => t.id === id)!.rotulo);
      if (rotulo.length > 1 && chave(m[1]) === rotulo[0]) {
        let j = 1;
        while (j < rotulo.length && i + j < pedacos.length && chave(pedacos[i + j]) === rotulo[j]) j++;
        if (j === rotulo.length) i += j - 1;
      }
      continue;
    }
    for (const w of pedacos[i].split(/[^\p{L}\p{N}]+/u).filter(Boolean)) {
      lista.push({ original: w.toLowerCase(), norm: normalizar(w) });
    }
  }
  // sem @: o rótulo completo de um tema escrito na frase também vale ("compare saúde e educação")
  if (!ids.length) {
    const candidatos = temas
      .flatMap((t) => [palavras(t.rotulo), t.id.split("-")].map((seq) => ({ id: t.id, seq })))
      .sort((a, b) => b.seq.length - a.seq.length);
    const achados: { id: string; pos: number }[] = [];
    for (const c of candidatos) {
      if (achados.some((a) => a.id === c.id)) continue;
      const pos = acharSequencia(lista, c.seq);
      if (pos === -1) continue;
      achados.push({ id: c.id, pos });
      lista = [...lista.slice(0, pos), ...lista.slice(pos + c.seq.length)];
    }
    // na ordem em que apareceram (a posição é anterior à remoção dos que vieram antes)
    ids.push(...achados.sort((a, b) => a.pos - b.pos).map((a) => a.id));
  }
  let comparar = false, sem = false, dif = false, panorama = false, ajuda = false;
  const termos: string[] = [];
  const termosOriginais: string[] = [];
  for (const p of lista) {
    if (COMPARAR.has(p.norm)) comparar = true;
    else if (SEMELHANCAS.has(p.norm)) sem = true;
    else if (DIFERENCAS.has(p.norm)) dif = true;
    else if (PANORAMA.has(p.norm)) panorama = true;
    else if (AJUDA.has(p.norm)) ajuda = true;
    else if (RESUMO.has(p.norm) || VAZIAS.has(p.norm) || p.norm.length < 2) continue;
    else if (!termos.includes(p.norm)) {
      termos.push(p.norm);
      termosOriginais.push(p.original);
    }
  }
  let intencao: Intencao;
  if (ids.length) {
    if (termos.length) intencao = "busca";
    else if (sem && !dif && !comparar) intencao = "semelhancas";
    else if (dif && !sem && !comparar) intencao = "diferencas";
    else if (comparar || sem || dif) intencao = "comparar";
    else intencao = "executivo";
  } else if (termos.length) intencao = "busca";
  else if (desconhecidos.length && !comparar && !sem && !dif && !panorama) intencao = "desconhecido";
  else if (comparar || sem || dif || panorama) intencao = "panorama";
  else intencao = ajuda || !desconhecidos.length ? "ajuda" : "desconhecido";
  return { intencao, temas: ids, termos, termosOriginais, desconhecidos };
}

/** Temas cujo JSON a resposta precisa ter em mãos. */
export function temasNecessarios(c: Consulta, temas: TemaPublico[]): string[] {
  if (c.intencao === "panorama" || (c.intencao === "busca" && !c.temas.length)) return temas.map((t) => t.id);
  if (c.intencao === "ajuda" || c.intencao === "desconhecido") return [];
  return c.temas;
}

// ------------------------------------------------------------------ menção no campo

/** A menção sendo digitada antes do cursor: `@` no início ou depois de espaço, sem espaço depois. */
export function mencaoNoCursor(texto: string, cursor: number): { inicio: number; busca: string } | null {
  const m = /(^|\s)@([\p{L}\p{N}-]*)$/u.exec(texto.slice(0, cursor));
  return m ? { inicio: cursor - m[2].length - 1, busca: m[2] } : null;
}

/** Temas para a lista do `@`: primeiro os que começam com a busca, depois os que a contêm no rótulo ou na descrição. */
export function sugerir(busca: string, temas: TemaPublico[]): TemaPublico[] {
  const k = chave(busca);
  if (!k) return temas;
  const inicio = temas.filter((t) => chave(t.rotulo).startsWith(k) || chave(t.id).startsWith(k));
  const resto = temas.filter(
    (t) => !inicio.includes(t) && (chave(t.rotulo).includes(k) || palavras(t.descricao).some((p) => p.startsWith(k))),
  );
  return [...inicio, ...resto];
}

/** Troca a menção parcial que começa em `inicio` por `@<id> ` e devolve o novo texto e a posição do cursor. */
export function inserirMencao(texto: string, cursor: number, inicio: number, id: string): { texto: string; cursor: number } {
  const depois = texto.slice(cursor).replace(/^[\p{L}\p{N}-]*/u, "").replace(/^\s+/, "");
  return { texto: `${texto.slice(0, inicio)}@${id} ${depois}`, cursor: inicio + id.length + 2 };
}

// ------------------------------------------------------------------ busca por palavra

/** Termo com até 3 letras precisa ser a palavra inteira ("sus" não acha "sustentável"); os maiores
 *  valem como começo de palavra, com o plural tirado ("filas" acha "fila"). */
export function contem(termo: string, ps: string[]): boolean {
  if (termo.length <= 3) return ps.includes(termo);
  const r = termo.endsWith("s") ? termo.slice(0, -1) : termo;
  return ps.some((p) => p.startsWith(r));
}

function citacoesDe(item: { citacoes: Citacao[] | Record<string, Citacao[]> }): Citacao[] {
  return Array.isArray(item.citacoes) ? item.citacoes : Object.values(item.citacoes).flat();
}

/** Quantos termos aparecem no texto do item ou nos trechos que ele cita. */
export function pontuar(termos: string[], item: { texto: string; citacoes: Citacao[] | Record<string, Citacao[]> }): number {
  const ps = [item.texto, ...citacoesDe(item).map((c) => c.trecho)].flatMap(palavras);
  return termos.filter((t) => contem(t, ps)).length;
}

function filtrar<T extends { texto: string; citacoes: Citacao[] | Record<string, Citacao[]> }>(itens: T[], termos: string[]): T[] {
  return itens
    .map((item, i) => ({ item, i, p: pontuar(termos, item) }))
    .filter((x) => x.p > 0)
    .sort((a, b) => b.p - a.p || a.i - b.i)
    .map((x) => x.item);
}

export interface BuscaTema {
  tema: string;
  candidatos: Record<CandidatoId, { resumo: Bullet[]; omissoes: Omissao[] }>;
  semelhancas: ItemDoisLados[];
  diferencas: ItemDoisLados[];
  total: number;
}

/** Itens publicados que mencionam os termos, por tema (na ordem de `ids`); só temas com algum achado. */
export function buscar(termos: string[], ids: string[], comps: Record<string, Comparacao>): BuscaTema[] {
  const saida: BuscaTema[] = [];
  for (const id of ids) {
    const c = comps[id];
    if (!c) continue;
    const candidatos = Object.fromEntries(
      CANDIDATOS_BASE.map((cid) => [
        cid,
        {
          resumo: filtrar(c.candidatos[cid].resumo, termos),
          omissoes: filtrar(c.omissoes.filter((o) => o.tratado_por === cid), termos),
        },
      ]),
    ) as BuscaTema["candidatos"];
    const semelhancas = filtrar(c.semelhancas, termos);
    const diferencas = filtrar(c.diferencas, termos);
    const total =
      semelhancas.length + diferencas.length + Object.values(candidatos).reduce((n, a) => n + a.resumo.length + a.omissoes.length, 0);
    if (total) saida.push({ tema: id, candidatos, semelhancas, diferencas, total });
  }
  return saida;
}
