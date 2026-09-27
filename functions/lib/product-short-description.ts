// ---------------------------------------------------------------------------
//  Audit D01 — commerce_products.short_description 派生与空白判定
//
//  背景（SILENT_FAILURE_AUDIT.md D01）：D1 中 2431 条 active 商品的
//  short_description 全为空，公开商品页按 `short_description || ''` 渲染，
//  把「必填数据缺失」伪装成「正常的空描述」。三个根因：导入未映射该字段、
//  创建/发布 API 无校验、前端静默渲染空白。本模块只负责其中可复用的两件事：
//
//    1. deriveShortDescription() —— 从**库里已存在的真实长描述**中确定性地
//       截取首句（≤ SHORT_DESCRIPTION_MAX 字符，超长按词边界截断），
//       作为短描述。纯函数、零 AI、零随机、可复算。
//    2. isBlankText() —— 发布闸门用的空白判定。
//
//  红线（AGENTS.md + 本次审计要求）：**绝不为了填满字段而编造文案**。
//  源文本不存在时本模块返回空串，由调用方把商品标记为 incomplete 并交给
//  发布闸门拦截；不要用 title + category 拼一句话冒充短描述 —— 那正是
//  「把缺失伪装成正常」的另一种形态。
// ---------------------------------------------------------------------------

/** 短描述目标上限（与卡片 line-clamp-1 / meta description 的显示需求对齐）。 */
export const SHORT_DESCRIPTION_MAX = 160;

/**
 * HTML → 纯文本。库中 `description` 是 AI 写入的 `<p>…</p>` 形态，
 * 派生短描述前必须去标签，否则会把标签名一起截进文案里。
 * 只做去标签 + 解码常见实体 + 压平空白，不改写、不增删任何实词。
 */
export function htmlToPlainText(html: unknown): string {
  if (typeof html !== "string" || !html) return "";
  const stripped = html
    // 整段丢弃 script/style（含内容）
    .replace(/<\s*(script|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, " ")
    // 块级边界转空格（不插入原文没有的标点）
    .replace(/<\s*br\s*\/?\s*>/gi, " ")
    .replace(/<\s*\/?\s*(p|div|li|ul|ol|h[1-6]|tr|td|th|section|article)\b[^>]*>/gi, " ")
    // 其余标签一律去掉
    .replace(/<[^>]*>/g, " ");

  const decoded = stripped
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&#0*(\d+);/g, (_m, d: string) => String.fromCharCode(Number(d)))
    .replace(/&amp;/gi, "&")
    // 兜底：残留的命名实体（&reg; &trade; …）转空格，避免把实体名当文案
    .replace(/&[a-z][a-z0-9]{1,10};/gi, " ");

  return decoded.replace(/\s+/g, " ").trim();
}

/** 空白判定：非字符串、空串、纯空白都算「缺失」。 */
export function isBlankText(value: unknown): boolean {
  return typeof value !== "string" || value.trim() === "";
}

/**
 * 从长描述确定性派生短描述。
 *
 * 规则（固定、可复算，不含任何生成/编造成分）：
 *   1. 去 HTML → 纯文本；空则返回 ""（**不**回退到标题拼接）。
 *   2. 全文 ≤ max → 原样返回。
 *   3. 取首句（句末 . ! ?，且句长 ≥ 20 字符，避免 "200ml." 之类误切）；
 *      首句 ≤ max → 返回首句。
 *   4. 否则在 max 处按最后一个空格截断（不切半个单词），去尾部悬挂标点，
 *      补省略号表明「这是截断，不是完整文案」。
 */
export function deriveShortDescription(
  source: unknown,
  max: number = SHORT_DESCRIPTION_MAX,
): string {
  const text = htmlToPlainText(source);
  if (!text) return "";
  if (text.length <= max) return text;

  const sentence = text.match(/^[^.!?]{20,}?[.!?](?=\s|$)/);
  if (sentence && sentence[0].length <= max) return sentence[0];

  const window = text.slice(0, max);
  const lastSpace = window.lastIndexOf(" ");
  // 只有当最后一个空格不太靠前时才按词边界截，否则宁可硬截也不留半行
  const cut = lastSpace > max * 0.6 ? window.slice(0, lastSpace) : window;
  const cleaned = cut.replace(/[\s,;:·、，。；：—–-]+$/, "");
  if (!cleaned) return "";
  return `${cleaned}…`;
}
