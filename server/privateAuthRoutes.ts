import type { Express } from "express";
import { getUserByOpenId, upsertUser } from "./db";
import {
  createPrivateSession,
  generateAndStoreOtp,
  sendOtpEmail,
  verifyOtp,
  PRIVATE_SESSION_COOKIE,
  privateOwnerEmail,
  privateOwnerOpenId,
  readPrivateSession,
  validPrivateCredentials,
} from "./privateAuth";

function cookieOptions(req: Parameters<Express["post"]>[1] extends (req: infer R, ...args: any[]) => any ? R : never) {
  const secure = req.protocol === "https" || req.headers["x-forwarded-proto"] === "https";
  return { httpOnly: true, secure, sameSite: "lax" as const, maxAge: 14 * 24 * 60 * 60 * 1000, path: "/" };
}

async function ensurePrivateOwner() {
  await upsertUser({ openId: privateOwnerOpenId, email: privateOwnerEmail, name: "Seif", loginMethod: "private-password", role: "admin", lastSignedIn: new Date() });
  return getUserByOpenId(privateOwnerOpenId);
}

export function registerPrivateAuthRoutes(app: Express) {
  // Step 1: Verify Password and Generate OTP + Dispatch Email
  app.post("/api/private-auth/request-otp", async (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (typeof email !== "string" || typeof password !== "string" || !validPrivateCredentials(email, password)) {
      res.status(401).json({ success: false, message: "كلمة المرور غير صحيحة." });
      return;
    }
    const recipient = email || privateOwnerEmail;
    const { otpId, code } = generateAndStoreOtp(recipient);
    const emailPreview = await sendOtpEmail(recipient, code);

    res.json({
      success: true,
      requiresOtp: true,
      otpId,
      emailPreview,
      message: emailPreview.sentRealEmail
        ? `تم إرسال رمز الأمان إلى بريدك الإلكتروني (${recipient}) بنجاح! ✉️`
        : `تم إرسال إشعار البريد الإلكتروني الخاص برمز الأمان (OTP) إلى ${recipient} 📩`,
    });
  });

  // Step 2: Verify OTP and Grant Session
  app.post("/api/private-auth/verify-otp", async (req, res) => {
    const { otpId, otpCode } = req.body as { otpId?: string; otpCode?: string };
    if (!otpId || !otpCode || !verifyOtp(otpId, otpCode)) {
      res.status(401).json({ success: false, message: "رمز التحقق OTP غير صحيح أو انتهت صلاحيته." });
      return;
    }

    const user = await ensurePrivateOwner();
    if (!user) {
      res.status(500).json({ success: false, message: "تعذّر تجهيز الحساب الخاص." });
      return;
    }

    const token = await createPrivateSession();
    res.cookie(PRIVATE_SESSION_COOKIE, token, cookieOptions(req));
    res.json({ success: true, email: user.email, token, message: "تم التحقق وتسجيل الدخول بنجاح." });
  });

  // Fallback sign-in endpoint
  app.post("/api/private-auth/sign-in", async (req, res) => {
    const { email, password, otpId, otpCode } = req.body as { email?: string; password?: string; otpId?: string; otpCode?: string };

    // If OTP is provided, verify it directly
    if (otpId && otpCode) {
      if (!verifyOtp(otpId, otpCode)) {
        res.status(401).json({ success: false, message: "رمز التحقق OTP غير صحيح أو انتهت صلاحيته." });
        return;
      }
      const user = await ensurePrivateOwner();
      if (!user) { res.status(500).json({ success: false, message: "تعذّر تجهيز الحساب الخاص." }); return; }
      const token = await createPrivateSession();
      res.cookie(PRIVATE_SESSION_COOKIE, token, cookieOptions(req));
      res.json({ success: true, email: user.email, token });
      return;
    }

    // Otherwise, check credentials and issue OTP
    if (typeof email !== "string" || typeof password !== "string" || !validPrivateCredentials(email, password)) {
      res.status(401).json({ success: false, message: "كلمة المرور غير صحيحة." });
      return;
    }

    const recipient = email || privateOwnerEmail;
    const { otpId: newOtpId, code } = generateAndStoreOtp(recipient);
    const emailPreview = await sendOtpEmail(recipient, code);

    res.json({
      success: true,
      requiresOtp: true,
      otpId: newOtpId,
      emailPreview,
      message: emailPreview.sentRealEmail
        ? `تم إرسال رمز الأمان إلى بريدك الإلكتروني (${recipient}) بنجاح! ✉️`
        : `تم تجهيز إشعار البريد الإلكتروني إلى ${recipient} 📩`,
    });
  });


  app.post("/api/private-auth/firebase-login", async (req, res) => {
    try {
      const { email, name, uid } = req.body as { email?: string; name?: string; uid?: string };
      if (!uid || !email) {
        res.status(400).json({ success: false, message: "بيانات Firebase غير مكتملة." });
        return;
      }
      const openId = `firebase_${uid}`;
      await upsertUser({
        openId,
        email,
        name: name || "طالب Seif Study",
        loginMethod: "firebase-google",
        role: "admin",
        lastSignedIn: new Date(),
      });
      const sessionToken = await createPrivateSession();
      res.cookie(PRIVATE_SESSION_COOKIE, sessionToken, cookieOptions(req));
      res.json({ success: true, email, openId });
    } catch (err: any) {
      console.error("Firebase login error:", err);
      res.status(500).json({ success: false, message: "تعذر إتمام الدخول بـ Firebase" });
    }
  });

  app.get("/api/private-auth/session", async (req, res) => {
    const signedIn = Boolean(await readPrivateSession(req));
    res.status(signedIn ? 200 : 401).json({ authenticated: signedIn, email: signedIn ? privateOwnerEmail : null });
  });

  app.post("/api/private-auth/sign-out", (req, res) => {
    res.clearCookie(PRIVATE_SESSION_COOKIE, { ...cookieOptions(req), maxAge: -1 });
    res.json({ success: true });
  });
}
