import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const CLIENT_ID = "764091335975-pbtrrqp7mqoibidr38fjkj70r377ubsn.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events";

declare global {
  interface Window {
    google?: any;
  }
}

export function useGoogleCalendarSync() {
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    return sessionStorage.getItem("gcal_access_token") || null;
  });
  const [isGsiLoaded, setIsGsiLoaded] = useState(false);

  const utils = trpc.useContext();

  const syncMutation = trpc.smartCalendar.fullBiDirectionalSync.useMutation({
    onSuccess: (data) => {
      utils.smartCalendar.getData.invalidate();
      toast.success(
        `تمت المزامنة بنجاح مع تقويم Google! 🗓️ (تم تصدير ${data.pushedCount} حدث، واستيراد ${data.importedCount} حدث من جوجل)`
      );
    },
    onError: (err) => {
      console.error("GCal Sync Error:", err);
      toast.error(err.message || "فشلت عملية المزامنة مع تقويم جوجل. يرجى إعادة تسجيل الدخول.");
      if (err.message?.includes("401") || err.message?.includes("Invalid Credentials")) {
        disconnect();
      }
    },
  });

  // Dynamically load Google Identity Services SDK script
  useEffect(() => {
    if (window.google?.accounts?.oauth2) {
      setIsGsiLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => setIsGsiLoaded(true);
    document.body.appendChild(script);
  }, []);

  const runSyncWithToken = useCallback(
    async (token: string) => {
      await syncMutation.mutateAsync({ accessToken: token });
    },
    [syncMutation]
  );

  const connectAndSync = useCallback(() => {
    if (!window.google?.accounts?.oauth2) {
      toast.error("جاري تحميل مكتبة Google OAuth... يرجى المحاولة بعد ثوانٍ.");
      return;
    }

    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: async (response: any) => {
          if (response.error) {
            console.error("OAuth Error:", response);
            toast.error("تم إلغاء أو رفض الصلاحيات لتقويم جوجل.");
            return;
          }

          if (response.access_token) {
            const token = response.access_token;
            setAccessToken(token);
            sessionStorage.setItem("gcal_access_token", token);
            toast.info("تم منح الصلاحيات! جارٍ بدء المزامنة ثنائية الاتجاه مع Google Calendar...");
            await runSyncWithToken(token);
          }
        },
      });

      client.requestAccessToken();
    } catch (e) {
      console.error("Token client error:", e);
      toast.error("حدث خطأ أثناء الاتصال بـ Google Calendar.");
    }
  }, [runSyncWithToken]);

  const syncNow = useCallback(async () => {
    if (!accessToken) {
      connectAndSync();
      return;
    }
    await runSyncWithToken(accessToken);
  }, [accessToken, connectAndSync, runSyncWithToken]);

  const disconnect = useCallback(() => {
    setAccessToken(null);
    sessionStorage.removeItem("gcal_access_token");
    toast.info("تم قطع الاتصال بـ Google Calendar في الجلسة الحالية.");
  }, []);

  return {
    isConnected: !!accessToken,
    accessToken,
    isGsiLoaded,
    isSyncing: syncMutation.isPending,
    connectAndSync,
    syncNow,
    disconnect,
  };
}
