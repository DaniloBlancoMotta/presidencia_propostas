// AC 10, 11, 13 e schema: as guardas de build falham e nomeiam o tema.
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
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

describe("npm run build (nível do comando)", () => {
  function build() {
    return spawnSync("npx", ["tsx", "scripts/build.ts"], {
      cwd: resolve(RAIZ, "web"),
      env: { ...process.env, COMPARACOES: e.pastaComparacoes, APROVADOS: e.aprovados, OUT_DIR: "dist-guardas" },
      encoding: "utf8",
    });
  }
  it("camada: o build sai com código 1 e nomeia o tema", () => {
    const arq = join(e.pastaComparacoes, "saude.json");
    const comp = JSON.parse(readFileSync(arq, "utf8"));
    comp.omissoes[0].camada = "declaracao";
    writeFileSync(arq, JSON.stringify(comp));
    aprovar("saude", sha(arq));
    const r = build();
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('saude: camada diferente de "plano" (declaracao)');
  }, 60_000);
  it("30 KB: o build sai com código 1 e nomeia o tema", () => {
    const arq = join(e.pastaComparacoes, "saude.json");
    const comp = JSON.parse(readFileSync(arq, "utf8"));
    while (JSON.stringify(comp).length <= 30 * 1024) comp.candidatos.lula.resumo.push(comp.candidatos.lula.resumo[0]);
    writeFileSync(arq, JSON.stringify(comp));
    aprovar("saude", sha(arq));
    const r = build();
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/saude: \d+ bytes, acima do limite de 30 KB/);
  }, 60_000);
  it("hash: o build sai com código 1 sem aprovação", () => {
    writeFileSync(e.aprovados, "");
    const r = build();
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("saude: hash");
  }, 60_000);
});
