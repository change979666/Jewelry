# CMS Admin — 网页后台使用与部署

> 路径：`/admin`（受密码保护）。非技术同事可在此直接撰写/编辑博客与产品，草稿存 Cloudflare KV，发布则提交 Markdown 到 GitHub 仓库并触发重新部署。

## 架构

```
浏览器 /admin  ──登录──▶  /api/admin/login   (HMAC 签名 Cookie)
        │
        ├─ GET  /api/admin/load   列出 blog + products（含 KV 草稿标记）
        ├─ GET  /api/admin/get    读取某篇 Markdown 正文（GitHub 或 KV）
        ├─ POST /api/admin/save   status=draft → 写 KV；status=publish → 提交 GitHub
        └─ POST /api/admin/logout 清除 Cookie
```

- **已发布内容**：提交到 `src/content/{blog,products}/<key>.<locale>.md` → 仓库触发 Cloudflare Pages 重新构建（静态、SEO 友好）。
- **草稿**：写入 KV 命名空间 `DRAFTS`（key = `collection:key:locale`），不会进生产站点，可在后台继续编辑。
- 后台页面本身是静态的；所有数据读写都经过上面的 Functions，且 Functions 校验 Cookie。

## 部署配置（Cloudflare 生产）

在 Cloudflare Pages 控制台 **Settings → Environment variables** 设：

| 变量 | 说明 |
| --- | --- |
| `ADMIN_PASSWORD` | 后台登录密码（建议用 Secrets 类型） |
| `ADMIN_GITHUB_TOKEN` | 具备 `repo` 写权限的 GitHub PAT（用于提交内容） |
| `ADMIN_GITHUB_REPO` | `change979666/Aromiso` |

并在 **Settings → Functions → KV** 绑定一个 KV 命名空间到变量名 **`DRAFTS`**。

> 安全建议：`/admin` 是公开可访问的静态页（仅 Functions 受密码保护）。如需进一步收敛，可在 Cloudflare 加 Access / WAF 规则限制 `/admin*` 的来源或登录。

## 本地预览（wrangler）

```bash
cp .dev.vars.example .dev.vars   # 填入真实值
wrangler kv namespace create aromiso-drafts --preview   # 拿到 id 填进 wrangler.toml
wrangler pages dev               # 同时跑静态站 + functions + KV
# 打开 http://localhost:8788/admin
```

`.dev.vars` 已被 `.gitignore` 忽略，请勿提交真实密钥。

## 界面（全中文）

后台 `/admin` 是一套完整的中文仪表盘，无需懂英文或 Git：

- **登录页**：输入 `ADMIN_PASSWORD` 密码进入。
- **左侧边栏**：仪表盘 / 博客文章 / 产品 三个视图，底部「系统」含主题切换（深/浅色）与退出登录。
- **仪表盘**：4 张统计卡（博客文章数、产品数、已发布数、草稿数）+ 快捷操作（新建博客/新建产品/查看线上站点）+ 最近内容列表。
- **博客文章 / 产品**：数据表格，支持**实时搜索**、**按语言筛选**（英/西/德）、**按状态筛选**（已发布/草稿）、产品还可**按分类筛选**（精油/香薰蜡烛/藤条香薰）；每行带状态徽章（绿色「已发布」/ 琥珀「草稿」）与「编辑」按钮。
- **编辑器**：右侧滑入式面板（非浏览器弹窗）。编辑标题、摘要、分类、封面图、日期、作者、标签、起订量、产地、认证等字段，正文用 Markdown；底部「取消 / 保存草稿 / 发布」三按钮。
- **新建条目**：模态框填「唯一标识（Key，小写字母/数字/连字符）」+ 选择语言，即创建新文件。
- **响应式**：移动端侧边栏可收起（汉堡菜单），桌面端完整显示。
- **快捷键**：`Esc` 关闭弹窗。

## 使用

1. 打开 `/admin`，输入 `ADMIN_PASSWORD` 登录。
2. 左侧边栏选择「博客文章」或「产品」，用搜索/筛选定位条目，点「编辑」；或点「新建文章 / 新建产品」创建。
3. 在右侧编辑面板填字段（正文用 Markdown），**保存草稿**存到 KV（仅后台可见），**发布**提交到 GitHub 并触发站点重建。
