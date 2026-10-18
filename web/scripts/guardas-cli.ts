import { ErroGuarda, verificarGuardas } from "./guardas";
import { entradasPadrao } from "./caminhos";

try {
  const p = verificarGuardas(entradasPadrao());
  console.log(`guardas ok: ${p.temas.map((t) => t.id).join(", ") || "(nenhum tema)"}`);
} catch (e) {
  console.error(e instanceof ErroGuarda ? e.message : e);
  process.exit(1);
}
