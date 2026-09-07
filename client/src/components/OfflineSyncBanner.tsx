import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { WifiOff, RefreshCw, HardDriveDownload, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OfflineSyncBanner() {
  const { isOnline, pendingSyncCount, syncOfflineQueue } = useOnlineStatus();

  if (isOnline && pendingSyncCount === 0) return null;

  return (
    <div
      className={`fixed bottom-4 left-4 right-4 sm:right-auto sm:max-w-md z-50 p-4 rounded-3xl border shadow-2xl backdrop-blur-md transition-all animate-in slide-in-from-bottom-5 ${
        !isOnline
          ? "bg-amber-500/15 border-amber-500/40 text-amber-900 dark:text-amber-100"
          : "bg-emerald-500/15 border-emerald-500/40 text-emerald-900 dark:text-emerald-100"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ${
              !isOnline ? "bg-amber-500/20 text-amber-600 dark:text-amber-300" : "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300"
            }`}
          >
            {!isOnline ? <WifiOff className="size-5 animate-pulse" /> : <HardDriveDownload className="size-5" />}
          </div>

          <div className="space-y-0.5 text-xs">
            <h5 className="font-black flex items-center gap-1.5">
              {!isOnline ? "مفيش إنترنت دلوقتي (شغال أوفلاين) 📶" : "جاهز لمزامنة المذاكرة على السحابة ☁️"}
            </h5>
            <p className="text-[11px] opacity-90">
              {!isOnline
                ? "ولا تشيل هم.. كل دروسك وملاحظاتك متسجلة تمام محلياً وهتترفع فوراً أول ما النت يرجع!"
                : `فيه ${pendingSyncCount} تحديثات دراسية متسجلة محلياً مستنية تترفع للسحابة.`}
            </p>
          </div>
        </div>

        {isOnline && pendingSyncCount > 0 && (
          <Button
            onClick={syncOfflineQueue}
            size="sm"
            className="rounded-xl text-xs font-bold gap-1 bg-emerald-600 text-white hover:bg-emerald-700 shrink-0"
          >
            <RefreshCw className="size-3.5" /> ارفع التحديثات دلوقتي
          </Button>
        )}
      </div>
    </div>
  );
}
