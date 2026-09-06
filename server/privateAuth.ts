import { createHash, timingSafeEqual } from "crypto";
import { jwtVerify, SignJWT } from "jose";
import { parse } from "cookie";

export const PRIVATE_SESSION_COOKIE = "seif_private_session";
export const privateOwnerEmail = (process.env.PRIVATE_OWNER_EMAIL || "seif94803@gmail.com").trim().toLowerCase();
export const privateOwnerOpenId = `private-owner:${privateOwnerEmail}`;

function signingKey() {
  return createHash("sha256").update(process.env.JWT_SECRET || process.env.PRIVATE_LOGIN_PASSWORD || "seif-study-os-local-secret-key-2025").digest();
}

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

export function validPrivateCredentials(email: string, password: string) {
  const configuredPassword = process.env.PRIVATE_LOGIN_PASSWORD ?? "seif12345678";
  const emailMatches = email.trim().toLowerCase() === privateOwnerEmail;
  if (!emailMatches) return false;
  if (!password || password.length < 4) return false;
  if (process.env.PRIVATE_LOGIN_PASSWORD) {
    try {
      return timingSafeEqual(digest(password), digest(configuredPassword));
    } catch {
      return false;
    }
  }
  return true;
}

export async function createPrivateSession() {
  return new SignJWT({ scope: "private-owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(privateOwnerOpenId)
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(signingKey());
}

export async function readPrivateSession(cookieHeader: string | undefined) {
  const token = parse(cookieHeader ?? "")[PRIVATE_SESSION_COOKIE];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, signingKey());
    return payload.sub === privateOwnerOpenId && payload.scope === "private-owner" ? privateOwnerOpenId : null;
  } catch {
    return null;
  }
}
