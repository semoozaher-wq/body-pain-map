// scripts/check-imports.mjs
// Verifies that every relative import/require in the project resolves to a real file.
// This catches "missing barrel/index file" bugs — e.g. a missing
// services/aiAssistant/index.ts — that break the Metro web bundle and therefore
// break both GitHub Actions ("Build and Validate") and the Vercel deployment.
//
// Run locally with:  npm run check:imports
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

const ROOT = resolve(process.cwd());

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', '.expo', 'build', 'outputs', '.browser_data',
]);

// Dev-only helper scripts that *emit* import statements as strings (they are not
// real modules and are never bundled), so they are excluded from the scan.
const IGNORE_FILES = new Set(['scripts/fix-and-package.js']);

const EXTS = [
  '', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json',
  '.web.ts', '.web.tsx', '.web.js', '.web.jsx',
  '.native.ts', '.native.tsx', '.native.js',
  '/index.ts', '/index.tsx', '/index.js', '/index.jsx',
  '/index.mjs', '/index.cjs', '/index.json',
];

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (IGNORE_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(name)) acc.push(full);
  }
  return acc;
}

// Remove // line comments and /* block */ comments so that import examples inside
// documentation comments are not mistaken for real imports.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

const IMPORT_RE =
  /(?:import\s[^'"]*from\s*|import\s*|require\s*\(\s*|export\s[^'"]*from\s*)['"](\.[^'"]+)['"]/g;

function isFile(p) {
  return existsSync(p) && statSync(p).isFile();
}

function resolves(base) {
  // The bare path must be a real file (not a directory), otherwise a directory
  // import such as '../services/aiAssistant' would falsely "resolve" to the folder.
  return EXTS.some((ext) => isFile(base + ext));
}

const files = walk(ROOT);
const problems = [];
let checked = 0;

for (const file of files) {
  const rel = file.replace(ROOT + '/', '');
  if (IGNORE_FILES.has(rel)) continue;
  const src = stripComments(readFileSync(file, 'utf8'));
  let m;
  while ((m = IMPORT_RE.exec(src)) !== null) {
    const spec = m[1];
    checked++;
    const base = resolve(dirname(file), spec);
    if (!resolves(base)) problems.push({ file: rel, spec });
  }
}

if (problems.length) {
  console.error(`\n\u274c ${problems.length} unresolved relative import(s) out of ${checked} checked:\n`);
  for (const p of problems) console.error(`  ${p.file}  ->  ${p.spec}`);
  console.error('\nFix: add the missing file (e.g. an index.ts barrel) or correct the path.');
  process.exit(1);
} else {
  console.log(`\u2705 All ${checked} relative imports resolve correctly across ${files.length} files.`);
}
