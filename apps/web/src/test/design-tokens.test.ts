import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Guardrail: components and pages must use token classes, never raw colours.
const SRC = join(__dirname, "..");
const RAW_COLOUR = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|\b(?:bg|text|border|fill|stroke)-\[#/;
const ALLOWED = new Set(["styles/tokens.css", "styles/index.css"]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("design tokens", () => {
  it("has no raw colour values outside tokens.css", () => {
    const offenders = walk(SRC)
      .filter((f) => /\.(tsx?|css)$/.test(f) && !f.endsWith(".test.ts") && !f.endsWith(".test.tsx"))
      .map((f) => relative(SRC, f).replace(/\\/g, "/"))
      .filter((rel) => !ALLOWED.has(rel))
      .filter((rel) => RAW_COLOUR.test(readFileSync(join(SRC, rel), "utf8")));
    expect(offenders).toEqual([]);
  });
});
