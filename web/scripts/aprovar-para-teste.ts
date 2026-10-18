// SÓ PARA TESTE: aprova os JSONs atuais num arquivo temporário (/tmp/aprovados-teste.yaml), para
// que o build de teste (dist-teste) rode antes da revisão humana. Nunca toca revisao/aprovados.yaml,
// e dist-teste nunca é publicado (dock.sh só devolve web/dist).
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { RAIZ } from "./caminhos";

const pasta = resolve(RAIZ, "dados", "comparacoes");
const linhas = readdirSync(pasta)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => `${f.replace(/\.json$/, "")}: ${createHash("sha256").update(readFileSync(resolve(pasta, f))).digest("hex")}`);
writeFileSync("/tmp/aprovados-teste.yaml", "# aprovação de TESTE, não publicar\n" + linhas.join("\n") + "\n");
console.log(`aprovação de teste: ${linhas.length} temas em /tmp/aprovados-teste.yaml`);
