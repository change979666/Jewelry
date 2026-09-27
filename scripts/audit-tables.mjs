// Audit: find tables referenced by server code that are NOT in the migrations.
// Filters out non-table matches (SQL keywords, English prose after "from the…").
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const SQL_KEYWORDS = new Set([
  "select", "where", "set", "values", "dual", "json", "the", "a", "an", "this", "that",
  "and", "or", "not", "null", "true", "false", "case", "when", "then", "else", "end",
  "order", "group", "limit", "offset", "join", "left", "right", "inner", "outer", "on",
  "as", "is", "it", "to", "in", "of", "for", "with", "any", "all", "one", "each", "new",
  "string", "number", "boolean", "object", "array", "promise", "error", "response",
  "request", "headers", "body", "url", "search", "params", "context", "env", "d1", "db",
  "kv", "r2", "docs", "github", "pages", "raw", "scalar", "meta", "source", "existing",
  "first", "role", "permissions", "settings", "knowledge", "index", "copy", "customer",
  "media", "content", "admin", "translation", "draft", "recycle", "rate", "why", "is",
  "are", "was", "were", "be", "been", "has", "have", "had", "do", "does", "did",
]);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) walk(abs, out);
    else if (e.name.endsWith(".ts")) out.push(abs);
  }
  return out;
}

// schema tables
const schema = new Set();
for (const f of fs.readdirSync("migrations")) {
  if (!f.endsWith(".sql")) continue;
  const sql = fs.readFileSync(path.join("migrations", f), "utf8");
  for (const m of sql.matchAll(/CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-z0-9_]+)/gi)) {
    schema.add(m[1].toLowerCase());
  }
}

const REF = /\b(FROM|JOIN|INTO|UPDATE)\s+([a-z][a-z0-9_]{2,})/gi;

const findings = new Map(); // table -> Set(files)

for (const dir of ["src/pages/api", "src/lib", "src/middleware.ts"]) {
  const files = dir.endsWith(".ts") ? [dir] : walk(dir);
  for (const file of files) {
    const code = fs.readFileSync(file, "utf8");
    for (const m of code.matchAll(REF)) {
      const table = m[2].toLowerCase();
      if (SQL_KEYWORDS.has(table)) continue;
      if (schema.has(table)) continue;
      if (!findings.has(table)) findings.set(table, new Set());
      findings.get(table).add(file);
    }
  }
}

console.log(`schema tables (${schema.size}): ${[...schema].sort().join(", ")}`);
console.log("");
const sorted = [...findings.entries()].sort((a, b) => b[1].size - a[1].size);
console.log(`REFERENCED BUT NOT IN SCHEMA (${sorted.length}):`);
for (const [table, files] of sorted) {
  console.log(`  ${table}  (${files.size} file${files.size > 1 ? "s" : ""})`);
  for (const f of [...files].sort()) console.log(`      ${f}`);
}
