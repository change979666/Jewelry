/**
 * Admin V2 全局客户端运行时类型声明
 *
 * JewelryToast 由 `src/components/admin/shared/Toast.astro` 通过
 * `is:inline` 脚本挂载到 window 上，供后台各页面的客户端脚本直接调用。
 * 这里补一份类型声明，避免 astro check 报 TS2304。
 */

declare global {
  interface Window {
    JewelryToast: {
      show(message: string, type?: "success" | "error" | "warning" | "info"): void;
      success(message: string): void;
      error(message: string): void;
      warning(message: string): void;
      info(message: string): void;
    };
    /**
     * V5.67：后台各页面历史上调用的全局提示函数。此前从未被定义（静默 no-op），
     * 现由 Toast.astro 桥接到 JewelryToast。声明于此避免 astro check 报 TS2339。
     */
    showToast?: (message: string, type?: "success" | "error" | "warning" | "info") => void;
    /** M5/S12：检查 API 载荷的降级/错误标记并显示持久横幅；返回是否检测到降级。 */
    JewelryNotifyDegraded?: (data: unknown, label?: string) => boolean;
    /** 直接显示一条降级横幅。 */
    JewelryShowDegraded?: (message: string, detail?: string) => void;
    /**
     * 全站后台统一分页控件（由 AdminShell.astro 的 is:inline 脚本挂载）。
     * 一次升级、所有列表页复用：共 N 条 · 第 X/Y 页 · 上一页 · 页码 · 下一页 ·
     * [每页 N 条] · 跳转到 [ ] 页。render 可选，页面调用前需判空以兼容旧壳层。
     */
    JewelryPagination?: {
      render(
        infoEl: HTMLElement | null,
        controlsEl: HTMLElement | null,
        opts: {
          total?: number;
          page?: number;
          totalPages?: number;
          pageSize?: number;
          pageSizes?: number[];
          showPageSize?: boolean;
          onChange?: (next: { page: number; pageSize?: number }) => void;
        },
      ): void;
      clamp(n: number, lo: number, hi: number): number;
    };
    /**
     * 表格排序状态可视化（由 AdminShell.astro 挂载）。mark 把当前排序列标记为
     * data-order=asc|desc + aria-sort，其余列清除，使「当前按什么排、升还是降」可见。
     */
    JewelrySort?: {
      mark(scope: Document | HTMLElement | null, sortKey: string, order: string): void;
    };
  }

  // 允许在页面 <script> 中直接以裸标识符调用（等价于 window.JewelryToast）
  const JewelryToast: Window["JewelryToast"];
}

export {};
