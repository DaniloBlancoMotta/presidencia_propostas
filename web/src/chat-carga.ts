// O chat fica num arquivo JS à parte, baixado só em /chat (antes de hidratar) ou ao navegar até lá,
// para não pesar no JS inicial das outras rotas (AC 33 e 34). O pré-render registra o componente direto.
import type { Chat } from "./Chat";

type ComponenteChat = typeof Chat;
let componente: ComponenteChat | null = null;

export function registrarChat(c: ComponenteChat) {
  componente = c;
}

export function chatCarregado(): ComponenteChat | null {
  return componente;
}

export async function carregarChat(): Promise<ComponenteChat> {
  if (!componente) componente = (await import("./Chat")).Chat;
  return componente;
}
