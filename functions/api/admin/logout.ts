import type { Env } from "../../types";
import { clearCookie, json } from "./shared";

export const onRequestPost: PagesFunction<Env> = async () => {
  const res = json({ ok: true });
  res.headers.set("Set-Cookie", clearCookie());
  return res;
};
