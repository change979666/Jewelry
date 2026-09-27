# V2 P0-11: 组件拆分策略
## Component Splitting Strategy

> 基于 V2 设计规范 §46 + CMS_AUDIT_ADMIN_SPA.md + P0-2（页面地图）
> 日期：2026-08-24

---

## 1. 拆分目标

将当前 10,381 行 `admin/index.astro` SPA 从一个文件拆成：

```
1 个 AdminShell（壳层）
8 个模块路由页面
~46 个可复用组件
n 个模块级组件（按需）
```

**拆分不破坏旧页面**：旧 `admin/index.astro` 保留在 `/admin`，V2 新壳在 `/admin-v2` 开发，Phase 14 切换。

---

## 2. 组件树设计

### 2.1 五层复用判断

| 层级 | 范围 | 示例 | 放入 |
|------|------|------|------|
| **L1 全局复用** | 所有模块都用 | DataTable, Drawer, Toast, KPICard | `src/components/admin/shared/` |
| **L2 域内复用** | 同一域多个页面用 | PriceCalculator (commerce 域) | `src/components/admin/commerce/` |
| **L3 页面级** | 单页面专用 | DashboardFunnel | 就近放页面目录 |
| **L4 一次性** | 只用一次且简单 | 特定提示文案 | 保留内联 |
| **L5 保留内联** | 太简单不值得抽 | `<span>共 N 条</span>` | 保留在页面中 |

### 2.2 组件目录结构（V2 §47 建议）

```
src/components/admin/
├── layout/
│   ├── AdminShell.astro         — 壳层（Sidebar + Topbar + 内容区）
│   ├── Sidebar.astro            — 左侧导航
│   ├── SidebarNavItem.astro     — 单个导航项
│   ├── Topbar.astro             — 顶部工具栏
│   ├── Breadcrumb.astro         — 面包屑
│   └── ContentArea.astro        — 主内容区容器
│
├── shared/
│   ├── KPICard.astro            — KPI 统计卡（值/环比/趋势/可点击）
│   ├── StatusBadge.astro        — 状态标签（Draft/Published/Active...）
│   ├── ScoreBadge.astro         — 评分标签（SEO Score/AI Score/Data Completeness）
│   ├── DataTable.astro          — 通用数据表格
│   ├── FilterBar.astro          — 筛选栏
│   ├── SearchBox.astro          — 搜索框
│   ├── Pagination.astro         — 分页
│   ├── BulkActionBar.astro      — 批量操作浮动工具栏
│   ├── Drawer.astro             — 右侧抽屉
│   ├── Modal.astro              — 确认弹窗
│   ├── ConfirmDialog.astro      — 危险操作确认（二次确认）
│   ├── Toast.astro              — Toast 通知
│   ├── EmptyState.astro         — 空状态占位
│   ├── ErrorState.astro         — 错误状态
│   ├── Skeleton.astro           — 骨架屏加载
│   ├── Timeline.astro           — 时间线
│   ├── Stepper.astro            — 步骤条
│   ├── Tabs.astro               — 标签页
│   └── QuickEdit.astro          — 单元格内联编辑
│
├── form/
│   ├── RichEditor.astro         — 富文本编辑器
│   ├── MarkdownEditor.astro     — Markdown 编辑器
│   ├── MediaPicker.astro        — 媒体选择器
│   ├── UploadZone.astro         — 拖拽上传区域
│   ├── TagInput.astro           — 标签输入
│   └── LanguageToggle.astro     — 语言切换
│
├── ai/
│   ├── AIActionButton.astro     — ✨ AI 按钮（对象右上角统一入口）
│   ├── AIPanel.astro            — AI 操作面板（Drawer 内容）
│   ├── AITaskStatus.astro       — AI 任务状态指示器
│   ├── DiffViewer.astro         — AI 修改前后对比
│   ├── VersionHistory.astro     — 版本历史列表
│   ├── AIStatusIndicator.astro  — Topbar 的 AI 状态灯
│   └── AISuggestionCard.astro   — AI 建议卡片
│
├── commerce/
│   ├── PriceCalculator.astro    — 利润率计算器
│   ├── ProductKPIBar.astro      — 商品 KPI 栏（总数/Active/Draft/缺字段...）
│   └── DataQualityPanel.astro   — 数据质量检查面板
│
├── customer/
│   ├── CustomerCard.astro       — 客户信息卡
│   ├── InquiryTimeline.astro    — 询盘时间线
│   ├── LeadScore.astro          — Lead Score 显示
│   └── EmailComposer.astro      — 邮件编辑器
│
├── oem/
│   ├── OEMStepper.astro         — OEM 阶段进度条
│   ├── OEMCalculator.astro      — OEM 报价计算器
│   └── OEMQuoteCompare.astro    — 报价版本对比
│
├── media/
│   ├── MediaGrid.astro          — 媒体网格视图
│   ├── VideoStepCard.astro      — 视频流水线步骤卡
│   ├── AssetDetail.astro        — 资产详情面板
│   └── ImageProcessor.astro     — 图片 AI 处理
│
└── analytics/
    ├── MetricCard.astro         — 指标卡
    ├── FunnelChart.astro        — 漏斗图
    ├── InteractiveChart.astro   — 可交互图表
    └── SEOInspector.astro       — SEO 评分面板
```

---

## 3. 拆分执行计划

### Phase 1：抽取全局 layout + shared 基础组件

从旧代码中**不提取**（因为旧代码是 vanilla JS 内联，无法直接复用），而是**全新编写**。

**基础组件清单**（Phase 1 必须完成）：
1. AdminShell
2. Sidebar (+ SidebarNavItem)
3. Topbar (+ Breadcrumb)
4. KPICard
5. StatusBadge
6. Toast
7. Drawer
8. Modal (+ ConfirmDialog)
9. EmptyState
10. ErrorState
11. Skeleton
12. Tabs

### Phase 2：抽取 AI + 权限组件
1. AIActionButton
2. AIPanel
3. AITaskStatus
4. VersionHistory

### Phase 3：Dashboard 专用组件
1. AIStatusIndicator
2. AISuggestionCard
3. FunnelChart
4. MetricCard

### Phase 4-6：业务组件（随模块迁移抽取）

按需从旧代码中提取逻辑 → 用新组件模式重写。

---

## 4. 组件技术选型

### Astro 组件 vs React Island

| 类型 | 用 Astro 组件 | 用 React Island |
|------|--------------|-----------------|
| 布局组件 (Shell/Sidebar/Topbar) | ✅ | |
| 展示组件 (KPICard/StatusBadge/EmptyState) | ✅ | |
| 简单交互 (Modal/Toast/Drawer/Tabs) | ✅ | |
| 复杂表单 (RichEditor/MarkdownEditor) | | ✅ (Slate/TipTap) |
| AI 面板 (AIPanel/DiffViewer) | | ✅ (复杂状态管理) |
| 图表 (FunnelChart/InteractiveChart) | | ✅ (Chart.js/Recharts) |
| 数据表格 (DataTable/FilterBar/Pagination) | 第一版 ✅ | 复杂交互版 → ✅ |
| 上传 (UploadZone/MediaPicker) | ✅ | |

**原则**：
- 优先用 Astro 组件（零 JS 默认，更快）
- 需要 `useState`/`useEffect`/复杂客户端状态 → React island
- 图表和富文本编辑器 → React island（生态依赖）

### CSS 方案

继承现有 `docs/DESIGN_TOKENS.md` 令牌体系，提取为 CSS 自定义属性：

```css
:root {
  --color-bg: #FAF7F2;           /* 暖灰米白 */
  --color-surface: #FFFFFF;       /* 白色卡片 */
  --color-text-primary: #3C2415;  /* 深棕黑 */
  --color-text-secondary: #6B7280;/* 灰 */
  --color-primary: #7C3AED;       /* 紫色 */
  --color-success: #10B981;       /* 绿色 */
  --color-warning: #F59E0B;       /* 橙色 */
  --color-danger: #EF4444;        /* 红色 */
  --color-ai: linear-gradient(135deg, #7C3AED, #A78BFA); /* AI 渐变 */

  --sidebar-width: 240px;
  --topbar-height: 64px;
  --content-max-width: 1440px;
  --card-gap: 16px;
  --section-gap: 32px;
}
```

---

## 5. 组件 Props 接口设计（核心组件）

```ts
// DataTable
interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  loading?: boolean;
  error?: string;
  emptyMessage?: string;
  // Selection
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  // Sort
  sortColumn?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (column: string, order: 'asc' | 'desc') => void;
  // Actions
  rowActions?: (row: T) => ActionDef[];
  onRowClick?: (row: T) => void;
}

// Drawer
interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  width?: string; // default '480px'
  children: any;
  footer?: any;
}

// KPICard
interface KPICardProps {
  title: string;
  value: number | string;
  change?: { value: number; type: 'up' | 'down' | 'neutral' };
  trend?: 'up' | 'down' | 'flat';
  href?: string; // 点击跳转（带筛选参数）
  loading?: boolean;
}

// AIPanel
interface AIPanelProps {
  objectType: string;   // 'content' | 'product' | 'inquiry' | 'oem_project'
  objectId: string;
  actions: AIActionDef[]; // 该对象类型可用的 AI 操作列表
}

// BulkActionBar
interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  actions: BulkActionDef[];
  onAction: (action: string) => void;
  onClear: () => void;
}
```

---

## 6. 从旧代码迁移组件的原则

### 可以迁移的
- HTML 结构相似的 → 参数化提取
- 相同的事件处理模式 → 统一 handler
- 相同的状态管理 → React island

### 不可以迁移的（重新实现）
- 散落在长函数中的内联逻辑
- 与旧 API 格式紧耦合的代码
- vanilla JS DOM 操作（改用组件状态）

### 迁移策略
1. **不直接拷贝旧代码**（旧代码是 vanilla JS，新组件是 Astro/React）
2. **提取业务规则**（如验证逻辑、权限判断、AI 调用参数）→ 放到 `src/lib/admin/`
3. **UI 重写**（用新设计系统组件 + Astro/React 语法）
4. **API 重接**（V2 组件调 V2 API，不调旧 API）

---

## 7. 组件开发规范

### 命名
- 组件文件：PascalCase，如 `DataTable.astro`, `AIPanel.tsx`
- Props interface：`<ComponentName>Props`
- CSS class：BEM 风格，如 `.data-table__header`, `.kpi-card--loading`

### 状态覆盖
每个数据展示组件必须处理 5 态：
```
Loading   → <Skeleton />
Empty     → <EmptyState message="..." />
Error     → <ErrorState message="..." onRetry={...} />
Success   → 正常渲染
Forbidden → 根据权限隐藏或显示 <EmptyState message="无权限" />
```

### 文档
每个组件文件头部必须包含：
```tsx
/**
 * DataTable — 通用数据表格
 *
 * 状态覆盖: Loading / Empty / Error / Success
 * 功能: 排序 / 选择 / 行操作 / 分页
 *
 * @example
 * <DataTable columns={cols} data={rows} loading={loading} />
 */
```

---

## 8. 与 Astro 的集成方式

### Astro 页面 → 引用组件

```astro
---
// src/pages/admin/content/blogs.astro
import AdminShell from '../../components/admin/layout/AdminShell.astro';
import DataTable from '../../components/admin/shared/DataTable.astro';
import FilterBar from '../../components/admin/shared/FilterBar.astro';

const blogs = await fetch('/api/admin/v2/content/blogs').then(r => r.json());
---

<AdminShell currentModule="content">
  <FilterBar filters={filters} />
  <DataTable
    columns={blogColumns}
    data={blogs.data}
    loading={false}
  />
</AdminShell>
```

### React Island（仅复杂交互）

```astro
---
// src/pages/admin/content/blogs/edit/[id].astro
import AdminShell from '../../components/admin/layout/AdminShell.astro';
import RichEditor from '../../components/admin/form/RichEditor.tsx'; // React island
import AIPanel from '../../components/admin/ai/AIPanel.tsx'; // React island
---

<AdminShell currentModule="content">
  <div class="editor-layout">
    <RichEditor client:load initialContent={content} />
    <AIPanel client:load objectType="content" objectId={id} />
  </div>
</AdminShell>
```

---

*本文基于 V2 规范 §46-47 + 现有代码审计。组件 Props 接口为初步设计，开发时可按需调整。*"