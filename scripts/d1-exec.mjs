/**
 * d1-exec.mjs — 执行 SQL 文件到 D1
 * 用法: node d1-exec.mjs <sql_file>
 * 账户/数据库 ID 从环境变量读取（不入库、不进日志参数）。
 */
import { readFileSync } from 'fs';

const sqlFile = process.argv[2];
if (!sqlFile) { console.error('Usage: node d1-exec.mjs <sql_file>'); process.exit(1); }

const sql = readFileSync(sqlFile, 'utf-8');
const devVars = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf-8');
const token = devVars.match(/CLOUDFLARE_API_TOKEN=(.+)/)?.[1]?.trim();
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  ?? devVars.match(/CLOUDFLARE_ACCOUNT_ID=(.+)/)?.[1]?.trim();
const dbId = process.env.D1_DATABASE_ID
  ?? devVars.match(/D1_DATABASE_ID=(.+)/)?.[1]?.trim();

if (!token || !accountId || !dbId) {
  console.error('Missing CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID / D1_DATABASE_ID (env or .dev.vars)');
  process.exit(1);
}

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
