// Guardas de build (AC 10, 11, 13 e schema): qualquer falha impede a publicação.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { parse } from "yaml";
import type { Comparacao, TemaPublico } from "../src/tipos";

export const LIMITE_BYTES = 30 * 1024;

export interface Entradas {
  pastaComparacoes: string;
  aprovados: string;
  themes: string;
  contrato: string;
}

export class ErroGuarda extends Error {
  constructor(public erros: string[]) {
    super("Build bloqueado pelas guardas:\n  - " + erros.join("\n  - "));
  }
}

export interface Publicavel {
  temas: TemaPublico[];
  comparacoes: Record<string, Comparacao>;
  bytes: Record<string, Buffer>;
}

function camadasInvalidas(c: Comparacao): string[] {
  const itens = [
    ...Object.values(c.candidatos).flatMap((a) => a.resumo),
    ...c.semelhancas,
    ...c.diferencas,
    ...c.omissoes,
  ];
  return itens.filter((i) => i.camada !== "plano").map((i) => String(i.camada));
}

export function verificarGuardas(e: Entradas): Publicavel {
  const erros: string[] = [];
  const temasYaml = (parse(readFileSync(e.themes, "utf8")) as { temas: (TemaPublico & { palavras_chave: string[] })[] }).temas;
  const ids = temasYaml.map((t) => t.id);
  const aprovados: Record<string, string> = existsSync(e.aprovados) ? (parse(readFileSync(e.aprovados, "utf8")) ?? {}) : {};

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  ajv.addSchema(JSON.parse(readFileSync(join(e.contrato, "citacao.schema.json"), "utf8")));
  const validar = ajv.compile(JSON.parse(readFileSync(join(e.contrato, "comparacao.schema.json"), "utf8")));

  const comparacoes: Record<string, Comparacao> = {};
  const bytes: Record<string, Buffer> = {};
  const arquivos = existsSync(e.pastaComparacoes)
    ? readdirSync(e.pastaComparacoes).filter((f) => f.endsWith(".json")).sort()
    : [];
  for (const f of arquivos) {
    const id = f.replace(/\.json$/, "");
    const buf = readFileSync(join(e.pastaComparacoes, f));
    let comp: Comparacao;
    try {
      comp = JSON.parse(buf.toString("utf8"));
    } catch {
      erros.push(`${id}: JSON inválido`);
      continue;
    }
    if (!ids.includes(id)) erros.push(`${id}: tema não existe em themes.yaml`);
    if (comp.theme_id !== id) erros.push(`${id}: theme_id do arquivo é ${JSON.stringify(comp.theme_id)}`);
    if (!validar(comp)) {
      erros.push(`${id}: fora do schema (${ajv.errorsText(validar.errors, { separator: "; " }).slice(0, 300)})`);
    }
    const camadas = Array.isArray(comp.semelhancas) && comp.candidatos ? camadasInvalidas(comp) : [];
    if (camadas.length) erros.push(`${id}: camada diferente de "plano" (${[...new Set(camadas)].join(", ")})`);
    if (buf.length > LIMITE_BYTES) erros.push(`${id}: ${buf.length} bytes, acima do limite de 30 KB (${LIMITE_BYTES})`);
    const sha = createHash("sha256").update(buf).digest("hex");
    if (!aprovados[id]) erros.push(`${id}: hash ${sha} sem aprovação em revisao/aprovados.yaml`);
    else if (aprovados[id] !== sha) erros.push(`${id}: hash ${sha} diverge do aprovado ${aprovados[id]}`);
    comparacoes[id] = comp;
    bytes[id] = buf;
  }
  if (erros.length) throw new ErroGuarda(erros);
  const temas = temasYaml
    .filter((t) => comparacoes[t.id])
    .map(({ id, rotulo, icone, descricao }) => ({ id, rotulo, icone, descricao }));
  return { temas, comparacoes, bytes };
}
