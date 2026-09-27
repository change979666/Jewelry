/**
 * d1-exec.mjs — 执行 SQL 文件到 D1
 * 用法: node d1-exec.mjs <sql_file>
 */
import { readFileSync } from 'fs';

const sqlFile = process.argv[2];
if (!sqlFile) { console.error('Usage: node d1-exec.mjs <sql_file>'); process.exit(1); }

const sql = readFileSync(sqlFile, 'utf-8');
const token = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf-8')
  .match(/CLOUDFLARE_API_TOKEN=(.+)/)?.[1]?.trim();
const accountId = '4f482e080a72acfe513b9839869ab645';
const dbId = '91f01781-3c54-458b-8c85-f855eb3f6438';

const res = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${dbId}/query`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql }),
  }
);

const data = await res.json();
if (data.success) {
  const results = data.result?.[0]?.results || [];
  console.log(`OK — ${sqlFile}`);
  if (results.length > 0) console.log(JSON.stringify(results, null, 2));
} else {
  console.error(`FAIL — ${sqlFile}`);
  console.error(JSON.stringify(data.errors, null, 2));
  process.exit(1);
}
