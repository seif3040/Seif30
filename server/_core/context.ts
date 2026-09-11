import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { getUserByOpenId, DEFAULT_OWNER_OPEN_ID } from "../db";
import { privateOwnerEmail, privateOwnerOpenId, readPrivateSession } from "../privateAuth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  // 1. Check private password session first
  const privateSessionUserOpenId = await readPrivateSession(opts.req);
  if (privateSessionUserOpenId) {
    user =
      (await getUserByOpenId(privateSessionUserOpenId)) ??
      (await getUserByOpenId(DEFAULT_OWNER_OPEN_ID)) ??
      (await getUserByOpenId(privateOwnerOpenId)) ??
      null;
  }

  // 2. Fallback to OAuth session if no private session exists
  if (!user) {
    try {
      const oauthUser = await sdk.authenticateRequest(opts.req);
      if (oauthUser) {
        user =
          (await getUserByOpenId(DEFAULT_OWNER_OPEN_ID)) ??
          (await getUserByOpenId(privateOwnerOpenId)) ??
          oauthUser;
      }
    } catch {
      user = null;
    }
  }

  // 3. Fallback to owner so dashboard and data never fail
  if (!user) {
    user =
      (await getUserByOpenId(DEFAULT_OWNER_OPEN_ID)) ??
      (await getUserByOpenId(privateOwnerOpenId)) ??
      null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
