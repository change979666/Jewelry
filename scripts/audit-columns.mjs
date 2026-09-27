/**
 * Column-level audit.
 *
 * The `order_items.created_at` bug was invisible to type-checking and to unit
 * tests (it only failed at runtime, and only when the admin detail drawer was
 * opened). This script catches the whole class: it builds the real schema from
 * migrations/*.sql, then checks every SQL string literal in the server code for
 * column references that do not exist on the table being queried.
 *
 * Scope note: this is a heuristic, not a SQL parser. It reports candidates for
 * human review. Known false positive: when a subquery appears in the SELECT
 * list, the "FROM" table can be resolved to the subquery's table instead of the
 * outer one — e.g. `SELECT r.*, (SELECT COUNT(*) FROM admin_permissions ...)
 * FROM admin_roles r ORDER BY r.created_at` is reported against
 * `admin_permissions` even though the ORDER BY targets `admin_roles`, which does
 * have `created_at`. Verify each hit against the real DDL.
 *
 * Usage: node scripts/audit-columns.mjs
 * Requires Node >= 22.5 (built-in node:sqlite — no extra dependency).
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sqlite3 = (() => {
  try {
    // node:sqlite is available in Node 22.5+ without a native dependency.
    return require("node:sqlite");
  } catch {
    return null;
  }
})();

const ROOT = process.cwd();

// ---- 1. Build the real schema by replaying migrations into an in-memory DB ----
if (!sqlite3) {
  console.error("node:sqlite unavailable — run with Node >= 22.5");
  process.exit(2);
}
const db = new sqlite3.DatabaseSync(":memory:");
const migrationFiles = fs
  .readdirSync("migrations")
  .filter((f) => f.endsWith(".sql"))
  .sort();
for (const f of migrationFiles) {
  db.exec(fs.readFileSync(path.join("migrations", f), "utf8"));
}

const tables = new Map(); // table -> Set(columns)
for (const row of db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
  .all()) {
  const name = row.name;
  const cols = new Set(
    db
      .prepare(`PRAGMA table_info(${name})`)
      .all()
      .map((c) => c.name),
  );
  cols.add("rowid");
  tables.set(name, cols);
}

// ---- 2. Scan server code for SQL literals ----
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) walk(abs, out);
    else if (e.name.endsWith(".ts")) out.push(abs);
  }
  return out;
}

const files = [...walk("src/pages/api"), ...walk("src/lib")].filter((f) => fs.existsSync(f));
const LITERAL = /(`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g;

const problems = [];
const phantomTables = new Map();

for (const file of files) {
  const code = fs
    .readFileSync(file, "utf8")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  for (const lit of code.matchAll(LITERAL)) {
    const sql = lit[1].slice(1, -1);
    if (!/\b(SELECT|INSERT|UPDATE|DELETE)\b/i.test(sql)) continue;
    if (!/\b(FROM|JOIN|INTO|UPDATE)\b/i.test(sql)) continue;

    // Single-table check only: the table right after FROM.
    const from = /\bFROM\s+([a-z_][a-z0-9_]*)/i.exec(sql);
    if (!from) continue;
    const table = from[1].toLowerCase();
    if (!tables.has(table)) {
      if (!phantomTables.has(table)) phantomTables.set(table, new Set());
      phantomTables.get(table).add(file);
      continue;
    }
    const cols = tables.get(table);

    // High-signal check only: ORDER BY / GROUP BY always name real columns
    // (unlike the SELECT list, which is full of aliases, string literals and
    // qualified refs and produced ~200 false positives). This is exactly the
    // pattern that broke the admin order drawer:
    //   SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at ASC
    // `order_items` has no created_at  ->  runtime D1_ERROR  ->  opaque 404.
    for (const clause of ["ORDER\\s+BY", "GROUP\\s+BY"]) {
      const re = new RegExp(`\\b${clause}\\s+([a-z_][a-z0-9_.,\\s]*)`, "gi");
      for (const m of sql.matchAll(re)) {
        const terms = m[1].split(",");
        for (const term of terms) {
          const col = term.trim().split(/\s+/)[0].split(".").pop().toLowerCase();
          if (!col || !/^[a-z_][a-z0-9_]*$/.test(col)) continue;
          if (col === "rowid" || col === "random") continue;
          if (/^(asc|desc|collate|nulls|first|last)$/.test(col)) continue;
          if (cols.has(col)) continue;
          problems.push({ file, table, column: col, sql: sql.replace(/\s+/g, " ").slice(0, 130) });
        }
      }
    }
  }
}

// ---- 3. Report ----
console.log(`migrations replayed: ${migrationFiles.length}  |  tables: ${tables.size}\n`);

console.log(`PHANTOM TABLES (${phantomTables.size}):`);
for (const [t, fs_] of [...phantomTables.entries()].sort()) {
  console.log(`  ${t}  (${fs_.size} file${fs_.size > 1 ? "s" : ""})`);
}

console.log(`\nUNKNOWN COLUMN CANDIDATES (${problems.length}) — review for false positives:`);
const byKey = new Map();
for (const p of problems) {
  const k = `${p.table}.${p.column}`;
  if (!byKey.has(k)) byKey.set(k, []);
  byKey.get(k).push(p);
}
for (const [k, list] of [...byKey.entries()].sort()) {
  console.log(`  ${k}  (${list.length}x)  e.g. ${path.relative(ROOT, list[0].file)}`);
  console.log(`      ${list[0].sql}`);
}
