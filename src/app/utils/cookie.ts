import type { CookieOptions } from "express";
import envConfig from "../config/env";

const ACCESS_TOKEN_MAX_AGE = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

export type TokenType = "access" | "refresh";

export const getCookieOptions = (type: TokenType): CookieOptions => {
  const isProduction = envConfig.node_env === "production";

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    // Without a Domain the cookie is host-only on api.<site>, so the frontend's
    // proxy.ts on <site> can never read it. Unset locally (localhost).
    ...(envConfig.cookie_domain && { domain: envConfig.cookie_domain }),
    maxAge: type === "access" ? ACCESS_TOKEN_MAX_AGE : REFRESH_TOKEN_MAX_AGE,
  };
};
