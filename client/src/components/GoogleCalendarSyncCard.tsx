import { useGoogleCalendarSync } from "@/hooks/useGoogleCalendarSync";
import { Calendar, RefreshCw, CheckCircle2, Unplug, ArrowRightLeft, Sparkles, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GoogleCalendarSyncCard({ compact = false }: { compact?: boolean }) {
  const { isConnected, isSyncing, connectAndSync, syncNow, disconnect } = useGoogleCalendarSync();

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {isConnected ? (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
              <CheckCircle2 className="size-3.5" />
              <span>مربوط بـ Google Calendar</span>
            </span>
            <Button
              onClick={syncNow}
              disabled={isSyncing}
              size="sm"
              variant="outline"
              className="rounded-xl gap-1 text-xs font-bold border-primary/20"
            >
              <RefreshCw className={`size-3.5 text-primary ${isSyncing ? "animate-spin" : ""}`} />
              <span>مزامنة</span>
            </Button>
          </div>
        ) : (
          <Button
            onClick={connectAndSync}
            size="sm"
            className="rounded-xl gap-1.5 text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:opacity-90 shadow-md shadow-blue-500/20"
          >
            <Calendar className="size-3.5" />
            <span>ربط تقويم جوجل</span>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-3xl border bg-gradient-to-br from-card via-card to-blue-500/5 p-5 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/20">
            <Calendar className="size-6" />
          </div>

          <div>
            <h4 className="text-sm font-black flex items-center gap-2 text-foreground">
              <span>المزامنة ثنائية الاتجاه مع Google Calendar</span>
              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-extrabold border border-blue-500/20">
                <ArrowRightLeft className="size-3" /> Bi-Directional
              </span>
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              تظهر مواعيد الدراسة والمهام تلقائياً في تقويم جوجل على هاتفك، وتُستورد مواعيدك الخارجية هنا.
            </p>
          </div>
        </div>

        {isConnected && (
          <button
            onClick={disconnect}
            className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
            title="قطع الاتصال في هذه الجلسة"
          >
            <Unplug className="size-3.5" />
            <span>إلغاء الربط</span>
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-2xl">
              <CheckCircle2 className="size-4" />
              <span>الحساب متصل وجاهز للمزامنة</span>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Sparkles className="size-3.5 text-blue-500 animate-pulse" />
              <span>اضغط للربط وإعطاء الصلاحية الآمنة لتقويم جوجل</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isConnected ? (
            <Button
              onClick={syncNow}
              disabled={isSyncing}
              size="sm"
              className="rounded-2xl gap-2 font-extrabold text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90"
            >
              <RefreshCw className={`size-4 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "جارٍ المزامنة الآن..." : "مزامنة ثنائية الاتجاه فورية"}</span>
            </Button>
          ) : (
            <Button
              onClick={connectAndSync}
              size="sm"
              className="rounded-2xl gap-2 font-extrabold text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 shadow-md shadow-blue-500/20"
            >
              <Calendar className="size-4" />
              <span>ربط وبدء المزامنة مع Google Calendar</span>
            </Button>
          )}

          <a
            href="https://calendar.google.com"
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded-2xl border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="فتح Google Calendar"
          >
            <ExternalLink className="size-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
