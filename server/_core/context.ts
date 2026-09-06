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

  try {
    const oauthUser = await sdk.authenticateRequest(opts.req);
    if (oauthUser) {
      user = (await getUserByOpenId(DEFAULT_OWNER_OPEN_ID)) ?? (await getUserByOpenId(privateOwnerOpenId)) ?? oauthUser;
    }
  } catch {
    user = null;
  }
  if (!user && await readPrivateSession(opts.req.headers.cookie)) {
    user = (await getUserByOpenId(DEFAULT_OWNER_OPEN_ID)) ?? (await getUserByOpenId(privateOwnerOpenId)) ?? null;
  }
  // Standalone mode default: provide the local owner user
  if (!user) {
    user = (await getUserByOpenId(DEFAULT_OWNER_OPEN_ID)) ?? (await getUserByOpenId(privateOwnerOpenId)) ?? null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
