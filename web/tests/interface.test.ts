// Checks da feature interface-site (.specs/features/interface-site/checks.md) provados no nível unitário.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const TOKENS = readFileSync(resolve(import.meta.dirname, "..", "src", "tokens.css"), "utf8");
const raiz = /:root\s*\{([^}]*)\}/.exec(TOKENS)?.[1] ?? "";
const tokens = Object.fromEntries([...raiz.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));

// Cor -> sRGB linear (OKLCH pela matriz de Björn Ottosson; hex pela curva sRGB), e contraste WCAG.
function linear(valor: string): [number, number, number] {
  const ok = /^oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)$/.exec(valor);
  if (ok) {
    const [L, C, h] = [Number(ok[1]) / 100, Number(ok[2]), (Number(ok[3]) * Math.PI) / 180];
    const [a, b] = [C * Math.cos(h), C * Math.sin(h)];
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const rgb: [number, number, number] = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
    return rgb.map((x) => Math.min(1, Math.max(0, x))) as [number, number, number];
  }
  const hex = /^#([0-9a-f]{6})$/i.exec(valor);
  if (!hex) throw new Error(`cor não reconhecida: ${valor}`);
  return [0, 2, 4].map((i) => {
    const x = parseInt(hex[1].slice(i, i + 2), 16) / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
}
const luminancia = ([r, g, b]: number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
function contraste(a: string, b: string) {
  const [x, y] = [luminancia(linear(tokens[a])), luminancia(linear(tokens[b]))].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

describe("S7: cor e tom de área por candidato", () => {
  it("C53: o arquivo de tokens declara as cores e os tons exatos", () => {
    expect(tokens).toMatchObject({
      "cand-lula": "#ee481a",
      "cand-flavio-bolsonaro": "#004f9f",
      semelhanca: "#2f7a55",
      "tom-lula": "oklch(95% 0.03 35)",
      "tom-flavio-bolsonaro": "oklch(95% 0.03 258)",
      "tom-semelhanca": "oklch(95% 0.03 158)",
      "tom-lula-forte": "oklch(93.5% 0.04 35)",
      "tom-flavio-bolsonaro-forte": "oklch(93.5% 0.04 258)",
      "tom-semelhanca-forte": "oklch(93.5% 0.04 158)",
    });
  });

  it("C56: texto em tinta ≥ 4,5:1 sobre papel e tons; cores plenas ≥ 3:1; o par mais apertado mede 3,05:1", () => {
    const tons = ["tom-lula", "tom-lula-forte", "tom-flavio-bolsonaro", "tom-flavio-bolsonaro-forte", "tom-semelhanca", "tom-semelhanca-forte"];
    for (const texto of ["tinta", "tinta-2"])
      for (const fundo of ["papel", ...tons]) expect(contraste(texto, fundo), `${texto} sobre ${fundo}`).toBeGreaterThanOrEqual(4.5);
    for (const [cor, tom] of [["cand-lula", "tom-lula"], ["cand-flavio-bolsonaro", "tom-flavio-bolsonaro"], ["semelhanca", "tom-semelhanca"]])
      for (const fundo of ["papel", tom, `${tom}-forte`]) expect(contraste(cor, fundo), `${cor} sobre ${fundo}`).toBeGreaterThanOrEqual(3);
    expect(contraste("cand-lula", "tom-lula-forte")).toBeCloseTo(3.05, 1);
    expect(Math.abs(contraste("cand-lula", "tom-lula-forte") - 3.05)).toBeLessThanOrEqual(0.02);
  });
});
