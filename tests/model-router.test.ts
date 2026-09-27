// ---------------------------------------------------------------------------
//  model-router tests（Model Router 预备层 / V5.33）
//  验证「默认关 = 零行为漂移」：KV 未开启时一律回落 deepseek-v4-pro；
//  开启后按蓝图 §19 任务分级表分发（低风险 → Flash，高风险 → Pro）。
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import {
  TASK_MODEL_ROUTES,
  TIER_MODELS,
  DEFAULT_MODEL,
  KV_MODEL_ROUTER_KEY,
  modelForTask,
  resolveModelForTask,
} from "../functions/lib/model-router";
import { mockEnv, MockKV } from "./helpers";
import type { Env } from "../functions/types";

const FLASH_KINDS = [
  "translate",
  "classify",
  "dedupe",
  "seo_triage",
  "product_field_extract",
] as const;
const PRO_KINDS = [
  "content_writer",
  "buyer_audit",
  "strategy",
  "truthfulness_review",
  "code",
] as const;

describe("model-router — 路由表（蓝图 §19 任务分级）", () => {
  it("低风险高频任务 → Flash", () => {
    for (const kind of FLASH_KINDS) {
      expect(TASK_MODEL_ROUTES[kind], kind).toBe("flash");
      expect(modelForTask(kind)).toBe("deepseek-v4-flash");
    }
  });

  it("高风险任务（内容/审计/战略/真实性/代码）→ 永远 Pro", () => {
    for (const kind of PRO_KINDS) {
      expect(TASK_MODEL_ROUTES[kind], kind).toBe("pro");
      expect(modelForTask(kind)).toBe("deepseek-v4-pro");
    }
  });

  it("默认模型 = 升级前的既有行为（deepseek-v4-pro）", () => {
    expect(DEFAULT_MODEL).toBe("deepseek-v4-pro");
    expect(TIER_MODELS.pro).toBe("deepseek-v4-pro");
    expect(TIER_MODELS.flash).toBe("deepseek-v4-flash");
  });
});

describe("model-router — resolveModelForTask（默认关，零行为漂移）", () => {
  it("KV 未配置 → 所有任务都回落默认 Pro（含 Flash 档任务）", async () => {
    const env = mockEnv();
    for (const kind of [...FLASH_KINDS, ...PRO_KINDS]) {
      expect(await resolveModelForTask(env, kind), kind).toBe(DEFAULT_MODEL);
    }
  });

  it("KV 设为非 on 值（off/true/乱码）→ 仍视为关闭", async () => {
    for (const flag of ["off", "true", "1", "ON", "garbage"]) {
      const kv = new MockKV();
      await kv.put(KV_MODEL_ROUTER_KEY, flag);
      const env = mockEnv({ DRAFTS: kv as unknown as KVNamespace });
      expect(await resolveModelForTask(env, "translate"), flag).toBe(DEFAULT_MODEL);
    }
  });

  it("KV 异常 → 视为关闭，不抛错", async () => {
    const env = mockEnv({
      DRAFTS: {
        get: async () => {
          throw new Error("kv down");
        },
      } as unknown as Env["DRAFTS"],
    });
    await expect(resolveModelForTask(env, "translate")).resolves.toBe(DEFAULT_MODEL);
  });

  it("KV 设为 on → 按路由表分发", async () => {
    const kv = new MockKV();
    await kv.put(KV_MODEL_ROUTER_KEY, "on");
    const env = mockEnv({ DRAFTS: kv as unknown as KVNamespace });
    for (const kind of FLASH_KINDS) {
      expect(await resolveModelForTask(env, kind), kind).toBe("deepseek-v4-flash");
    }
    for (const kind of PRO_KINDS) {
      expect(await resolveModelForTask(env, kind), kind).toBe("deepseek-v4-pro");
    }
  });
});
