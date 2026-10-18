// AC 10, 11, 13 e schema: as guardas de build falham e nomeiam o tema.
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { RAIZ } from "../scripts/caminhos";
import { ErroGuarda, verificarGuardas, type Entradas } from "../scripts/guardas";

const ORIGEM = resolve(RAIZ, "dados", "comparacoes", "saude.json");
let e: Entradas;

function sha(caminho: string) {
  return createHash("sha256").update(readFileSync(caminho)).digest("hex");
}

function aprovar(id: string, hash: string) {
  writeFileSync(e.aprovados, `${id}: ${hash}\n`);
}

function falha(): string {
  try {
    verificarGuardas(e);
  } catch (err) {
    expect(err).toBeInstanceOf(ErroGuarda);
    return (err as Error).message;
  }
  throw new Error("as guardas deveriam ter falhado");
}

beforeEach(() => {
  const d = mkdtempSync(join(tmpdir(), "guardas-"));
  cpSync(ORIGEM, join(d, "saude.json"));
  e = {
    pastaComparacoes: d,
    aprovados: join(d, "aprovados.yaml"),
    themes: resolve(RAIZ, "dados", "themes.yaml"),
    contrato: resolve(RAIZ, "contrato"),
  };
});

describe("guardas de build", () => {
  it("passa com JSON aprovado pelo hash exato", () => {
    aprovar("saude", sha(join(e.pastaComparacoes, "saude.json")));
    const p = verificarGuardas(e);
    expect(p.temas.map((t) => t.id)).toEqual(["saude"]);
  });

  it("hash: JSON sem aprovação falha e nomeia o tema", () => {
    writeFileSync(e.aprovados, "");
    const msg = falha();
    expect(msg).toContain("saude: hash");
    expect(msg).toContain("sem aprovação");
  });

  it("hash: JSON regerado depois da aprovação falha", () => {
    aprovar("saude", sha(join(e.pastaComparacoes, "saude.json")));
    const arq = join(e.pastaComparacoes, "saude.json");
    writeFileSync(arq, readFileSync(arq, "utf8").replace('"theme_id": "saude"', '"theme_id":  "saude"'));
    const msg = falha();
    expect(msg).toMatch(/saude: hash [0-9a-f]{64} diverge do aprovado/);
  });

  it("camada diferente de plano falha", () => {
    const arq = join(e.pastaComparacoes, "saude.json");
    const comp = JSON.parse(readFileSync(arq, "utf8"));
    comp.semelhancas[0].camada = "imprensa";
    writeFileSync(arq, JSON.stringify(comp));
    aprovar("saude", sha(arq));
    const msg = falha();
    expect(msg).toContain('saude: camada diferente de "plano" (imprensa)');
  });

  it("JSON acima de 30 KB falha", () => {
    const arq = join(e.pastaComparacoes, "saude.json");
    const comp = JSON.parse(readFileSync(arq, "utf8"));
    const extra = comp.candidatos.lula.resumo[0];
    while (JSON.stringify(comp).length <= 30 * 1024) comp.candidatos.lula.resumo.push(extra);
    writeFileSync(arq, JSON.stringify(comp));
    aprovar("saude", sha(arq));
    const msg = falha();
    expect(msg).toMatch(/saude: \d+ bytes, acima do limite de 30 KB/);
  });

  it("schema: JSON fora do contrato falha", () => {
    const arq = join(e.pastaComparacoes, "saude.json");
    const comp = JSON.parse(readFileSync(arq, "utf8"));
    comp.candidatos.lula.resumo[0].citacoes[0].pagina = 0;
    writeFileSync(arq, JSON.stringify(comp));
    aprovar("saude", sha(arq));
    expect(falha()).toContain("saude: fora do schema");
  });
});
