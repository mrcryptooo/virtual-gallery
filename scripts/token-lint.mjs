/**
 * Token lint (M0.3, doc 12): the built CSS may contain no hex color, px size,
 * or ms/s duration literal that is not present in src/styles/tokens.css —
 * the design system (doc 11) is the only source of visual values.
 * Also enforces the self-hosted font budget: ≤ 120 KB total (doc 08 §3).
 *
 * Run AFTER `pnpm build`. Reports every violation at once (contract §8),
 * exits non-zero on any.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const APP = 'apps/portfolio';
const TOKENS_FILE = join(APP, 'src/styles/tokens.css');
const DIST_ASSETS = join(APP, 'dist/assets');
const FONTS_DIR = join(APP, 'src/styles/fonts');
const FONT_BUDGET_BYTES = 120 * 1024;

const HEX_RE = /#[0-9a-f]{3,8}\b/gi;
const PX_RE = /(?<![\w.])\d+(?:\.\d+)?px\b/g;
// Minifiers rewrite units (1400ms → 1.4s, 100ms → .1s), so durations are
// normalized to canonical milliseconds and compared numerically.
const TIME_RE = /(?<![\w.#-])(\d*\.?\d+)(ms|s)\b/g;

/** @param {string} css @param {RegExp} re */
const extract = (css, re) => new Set([...css.matchAll(re)].map((m) => m[0].toLowerCase()));

/** @param {string} css */
const extractTimesMs = (css) =>
  new Set(
    [...css.matchAll(TIME_RE)].map(
      ([, num, unit]) => `${String(Number(num) * (unit === 's' ? 1000 : 1))}ms`,
    ),
  );

// Allowed literal sets come from tokens.css by construction.
const tokensCss = readFileSync(TOKENS_FILE, 'utf8');
const allowed = {
  hex: extract(tokensCss, HEX_RE),
  px: extract(tokensCss, PX_RE).add('0px'),
  time: extractTimesMs(tokensCss).add('0ms'),
};

const failures = [];

// ── Built CSS scan ───────────────────────────────────────────────────────────
let cssFiles = [];
try {
  cssFiles = readdirSync(DIST_ASSETS).filter((f) => f.endsWith('.css'));
} catch {
  console.error(`[pipeline] token-lint: ${DIST_ASSETS} not found — run \`pnpm build\` first.`);
  process.exit(1);
}

for (const file of cssFiles) {
  const css = readFileSync(join(DIST_ASSETS, file), 'utf8');
  for (const [kind, re] of [
    ['hex', HEX_RE],
    ['px', PX_RE],
  ]) {
    for (const literal of extract(css, re)) {
      if (!allowed[kind].has(literal)) {
        failures.push(`${file}: ${kind} literal "${literal}" is not defined in tokens.css`);
      }
    }
  }
  for (const ms of extractTimesMs(css)) {
    if (!allowed.time.has(ms)) {
      failures.push(`${file}: duration "${ms}" is not defined in tokens.css`);
    }
  }
}

// ── Font budget ──────────────────────────────────────────────────────────────
let fontTotal = 0;
for (const f of readdirSync(FONTS_DIR).filter((f) => f.endsWith('.woff2'))) {
  fontTotal += statSync(join(FONTS_DIR, f)).size;
}
if (fontTotal > FONT_BUDGET_BYTES) {
  failures.push(
    `fonts: ${String(fontTotal)} bytes exceeds the ${String(FONT_BUDGET_BYTES)}-byte budget (doc 08 §3)`,
  );
}

// ── Report ───────────────────────────────────────────────────────────────────
if (failures.length > 0) {
  console.error(`[pipeline] token-lint: ${String(failures.length)} violation(s):\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error(
    '\n  Fix: use var(--token) from src/styles/tokens.css. New values require an owner-approved amendment to docs/11 (or docs/10 for motion) first.',
  );
  process.exit(1);
}

console.log(
  `[pipeline] token-lint: OK — ${String(cssFiles.length)} css file(s) clean; fonts ${String(fontTotal)} / ${String(FONT_BUDGET_BYTES)} bytes.`,
);
