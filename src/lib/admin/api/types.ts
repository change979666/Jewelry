// V2 API shared types — Phase 1 bootstrap
// All V2 APIs return this unified envelope (V2 §37)

export interface ApiEnvelope<T = unknown> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string; details?: unknown } | null;
  meta: PaginationMeta | null;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "AI_BUDGET_EXCEEDED"
  | "AI_TRUTH_FAILED"
  | "AI_PERMISSION_DENIED"
  | "INTERNAL_ERROR"
  | "EXTERNAL_SERVICE_ERROR";
