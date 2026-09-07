import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import {
  Bell,
  BellRing,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  X,
  Volume2,
  VolumeX,
  Sliders,
  Calendar,
  BookOpen,
  Laptop,
  CheckSquare,
  Zap,
  ArrowRight,
  Bot,
  Flame,
  ShieldAlert,
  Send,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [aiNudge, setAiNudge] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "urgent" | "calendar" | "tasks">("all");

  const [, navigate] = useLocation();
  const utils = trpc.useContext();
  const notifiedIdsRef = useRef<Set<string>>(new Set());

  const [permissionState, setPermissionState] = useState<NotificationPermission>(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return "default";
  });

  const { data: notifications, isLoading } = trpc.notifications.list.useQuery(undefined, {
    refetchInterval: 25000, // Auto-refresh notifications every 25s
  });

  const { data: settings } = trpc.notifications.getSettings.useQuery();

  const dismissMutation = trpc.notifications.dismiss.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
    },
  });

  const updateSettingsMutation = trpc.notifications.updateSettings.useMutation({
    onSuccess: () => {
      utils.notifications.getSettings.invalidate();
      toast.success("تم تحديث إعدادات التنبيهات والوقاية من التسويف بنجاح!");
    },
  });

  const aiCoachMutation = trpc.notifications.getAiCoachNudge.useMutation({
    onSuccess: (data) => {
      setAiNudge(data.advice);
    },
  });

  // Keep track of Notification.permission updates
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermissionState(Notification.permission);
    }
  }, [isOpen, showSettings]);

  // Cheerful Sound Chime Synthesizer
  const playNotificationChime = () => {
    if (settings?.soundEnabled === false) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      // Arpeggio chord C5 -> E5 -> G5
      osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, audioCtx.currentTime + 0.15); // E5
      osc.frequency.exponentialRampToValueAtTime(783.99, audioCtx.currentTime + 0.3); // G5
      gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    } catch {
      // Audio context fallback
    }
  };

  // Browser Push Notification Setup Request
  const handleRequestPushPermission = async () => {
    if (!("Notification" in window)) {
      toast.error("متصفحك الحالي لا يدعم الإشعارات المكتبية.");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setPermissionState(permission);

      if (permission === "granted") {
        updateSettingsMutation.mutate({ browserPushEnabled: true });
        toast.success("تم تفعيل الإشعارات المكتبية المباشرة بنجاح! 🚀");

        const welcomeNotif = new Notification("⚡ Seif Study OS | تم تفعيل الإشعارات الذكية!", {
          body: "عاش يا بطل! سننبهك فوراً قبل مواعيد الدروس والمهام العاجلة بالتقويم التعليمي. 🎯",
          icon: "/favicon.ico",
          badge: "/favicon.ico",
        });

        playNotificationChime();

        welcomeNotif.onclick = (e) => {
          e.preventDefault();
          window.focus();
          navigate("/smart-learning-calendar");
          welcomeNotif.close();
        };
      } else if (permission === "denied") {
        toast.error("تم رفض إذن الإشعارات من إعدادات المتصفح. يرجى تفعيلها من إعدادات الموقع.");
      }
    } catch {
      toast.error("حدث خطأ أثناء طلب إذن الإشعارات.");
    }
  };

  // Test Live Notification Trigger
  const handleTestNotification = () => {
    if (!("Notification" in window)) {
      toast.error("متصفحك لا يدعم الإشعارات المكتبية.");
      return;
    }

    if (Notification.permission !== "granted") {
      handleRequestPushPermission();
      return;
    }

    const testNotif = new Notification("🚨 Seif Study OS | تنبيه تجريبي للمواعيد!", {
      body: "⚡ جهز كشكولك! عندك سيشن مذاكرة مجدولة بالتقويم التعليمي الذكي بعد قليل.\nاضغط هنا للانتقال فوراً!",
      icon: "/favicon.ico",
      tag: "test-notif-" + Date.now(),
    });

    playNotificationChime();

    testNotif.onclick = (e) => {
      e.preventDefault();
      window.focus();
      navigate("/smart-learning-calendar");
      testNotif.close();
    };

    toast.success("تم إرسال إشعار تجريبي للمكتب! تحقق من زاوية شاشتك 🔔");
  };

  // PROACTIVE CONTEXT-AWARE BACKGROUND BROWSER NOTIFICATIONS
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    if (!notifications || notifications.length === 0) return;

    notifications.forEach((item) => {
      if (notifiedIdsRef.current.has(item.id)) return;

      // Filter context-aware items that require proactive browser alerts
      const isUrgentTask = item.type === "task_deadline" && (item.urgency === "urgent" || item.urgency === "warning");
      const isCalendarLesson = item.type === "calendar_lesson" || item.type === "hybrid_session";
      const isMotivation = item.type === "anti_procrastination" && item.urgency === "motivation";

      if (isUrgentTask || isCalendarLesson || isMotivation) {
        notifiedIdsRef.current.add(item.id);

        let prefixEmoji = "⚡";
        if (item.type === "task_deadline") prefixEmoji = "🚨";
        if (item.type === "hybrid_session") prefixEmoji = "🏫";
        if (item.type === "anti_procrastination") prefixEmoji = "💡";

        const youthfulTitle = `${prefixEmoji} Seif Study OS | ${item.title}`;
        const youthfulBody = `${item.message}\n👉 اضغط هنا للانتقال والإنجاز فوراً!`;

        try {
          const notif = new Notification(youthfulTitle, {
            body: youthfulBody,
            icon: "/favicon.ico",
            badge: "/favicon.ico",
            tag: item.id,
            requireInteraction: item.urgency === "urgent",
          });

          playNotificationChime();

          notif.onclick = (e) => {
            e.preventDefault();
            window.focus();
            if (item.actionUrl) {
              navigate(item.actionUrl);
            }
            notif.close();
          };
        } catch {
          // Native notification fallback
        }
      }
    });
  }, [notifications, navigate]);

  const handleDismiss = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    dismissMutation.mutate({ key });
  };

  const urgentCount = notifications?.filter((n) => n.urgency === "urgent").length || 0;
  const totalCount = notifications?.length || 0;

  const filteredList = (notifications || []).filter((n) => {
    if (filter === "urgent") return n.urgency === "urgent" || n.urgency === "warning";
    if (filter === "calendar") return n.type === "calendar_lesson" || n.type === "hybrid_session";
    if (filter === "tasks") return n.type === "task_deadline";
    return true;
  });

  return (
    <div className="relative">
      {/* BELL BUTTON IN HEADER */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen && urgentCount > 0) playNotificationChime();
        }}
        className="relative flex size-10 items-center justify-center rounded-2xl border bg-card hover:bg-muted text-foreground transition-all shadow-sm"
        title="مركز التنبيهات المباشرة والوقاية من التسويف"
      >
        {urgentCount > 0 ? (
          <BellRing className="size-5 text-amber-500 animate-bounce" />
        ) : (
          <Bell className="size-5 text-muted-foreground" />
        )}

        {totalCount > 0 && (
          <span
            className={`absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full text-[10px] font-black text-white ${
              urgentCount > 0 ? "bg-red-500 animate-pulse" : "bg-primary"
            }`}
          >
            {totalCount > 9 ? "+9" : totalCount}
          </span>
        )}
      </button>

      {/* NOTIFICATIONS PANEL */}
      {isOpen && (
        <div className="absolute left-0 mt-3 w-80 sm:w-96 rounded-3xl border bg-card shadow-2xl p-4 z-[9999] animate-in fade-in slide-in-from-top-2 space-y-4">
          {/* PANEL HEADER */}
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-violet-600 text-white shadow-sm">
                <Zap className="size-4" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm flex items-center gap-1.5">
                  <span>تنبيهات المذاكرة المخصصة</span>
                  {urgentCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-600 text-[10px] font-mono border border-red-500/20">
                      {urgentCount} هامة
                    </span>
                  )}
                </h4>
                <p className="text-[11px] text-muted-foreground">تتبع مباشر للمواعيد والدروس بالمتصفح</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-1.5 rounded-xl border bg-muted/40 hover:bg-muted text-muted-foreground transition-all"
                title="إعدادات الإشعارات المكتبية"
              >
                <Sliders className="size-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-xl border bg-muted/40 hover:bg-muted text-muted-foreground transition-all"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* PROACTIVE BROWSER PUSH SETTINGS CARD */}
          {showSettings && (
            <div className="p-3.5 rounded-2xl border bg-gradient-to-br from-muted/50 via-card to-primary/5 text-xs space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="font-extrabold text-foreground flex items-center gap-1.5">
                  <Smartphone className="size-4 text-primary" />
                  <span>إشعارات المتصفح المكتبية (Browser Push)</span>
                </span>
                <Badge
                  variant="secondary"
                  className={`text-[10px] font-bold ${
                    permissionState === "granted"
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                      : permissionState === "denied"
                      ? "bg-red-500/10 text-red-600 border-red-500/20"
                      : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                  }`}
                >
                  {permissionState === "granted"
                    ? "مفعلة وشغالة 🔥"
                    : permissionState === "denied"
                    ? "محظورة ❌"
                    : "تحتاج تفعيل 🔔"}
                </Badge>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground leading-snug">
                  يرسل المتصفح تنبيهات منبثقة تفاعلية للمواعيد القادمة والمهام المتأخرة دون حاجة لفتح التطبيق طوال الوقت.
                </p>

                <div className="flex items-center justify-between gap-2 pt-1">
                  {permissionState !== "granted" ? (
                    <Button
                      onClick={handleRequestPushPermission}
                      size="sm"
                      className="w-full rounded-xl text-xs font-bold gap-1.5 bg-gradient-to-r from-primary to-teal-600"
                    >
                      <BellRing className="size-3.5" />
                      <span>تفعيل الإشعارات المكتبية الآن</span>
                    </Button>
                  ) : (
                    <Button
                      onClick={handleTestNotification}
                      size="sm"
                      variant="outline"
                      className="w-full rounded-xl text-xs font-bold gap-1.5 border-primary/30 text-primary"
                    >
                      <Send className="size-3.5" />
                      <span>إرسال تنبيه تجريبي للمكتب 🚀</span>
                    </Button>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">صوت التنبيهات:</span>
                  <button
                    onClick={() => updateSettingsMutation.mutate({ soundEnabled: !settings?.soundEnabled })}
                    className="px-2.5 py-1 rounded-xl border text-[11px] font-bold bg-card"
                  >
                    {settings?.soundEnabled ? "مفعل 🔊" : "معطل 🔇"}
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">التذكير المسبق بالدروس:</span>
                  <select
                    value={settings?.leadMinutes || 30}
                    onChange={(e) => updateSettingsMutation.mutate({ leadMinutes: Number(e.target.value) })}
                    className="rounded-xl border bg-card px-2 py-1 text-[11px] font-bold outline-none"
                  >
                    <option value={15}>قبل 15 دقيقة</option>
                    <option value={30}>قبل 30 دقيقة</option>
                    <option value={60}>قبل ساعة كاملة</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* AI ANTI-PROCRASTINATION COACH BANNER */}
          <div className="p-3 rounded-2xl border bg-gradient-to-r from-amber-500/10 via-primary/10 to-card space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black flex items-center gap-1 text-amber-700 dark:text-amber-400">
                <Sparkles className="size-3.5" /> مدرب محاربة التسويف (Gemini AI):
              </span>
              <button
                onClick={() => aiCoachMutation.mutate()}
                disabled={aiCoachMutation.isPending}
                className="text-[10px] font-extrabold text-primary underline"
              >
                {aiCoachMutation.isPending ? "جارٍ التوليد…" : "توليد نصيحة الآن"}
              </button>
            </div>
            {aiNudge ? (
              <p className="text-xs font-medium leading-relaxed text-foreground bg-card/80 p-2 rounded-xl border">
                {aiNudge}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground leading-snug">
                انقر على توليد للحصول على توجيه محفز لمنع تأجيل دروسك المجدولة بالتقويم.
              </p>
            )}
          </div>

          {/* FILTER TABS */}
          <div className="flex items-center gap-1 border-b pb-2 text-[11px] font-bold overflow-x-auto">
            <button
              onClick={() => setFilter("all")}
              className={`px-2.5 py-1 rounded-xl transition-all whitespace-nowrap ${
                filter === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              الكل ({notifications?.length || 0})
            </button>
            <button
              onClick={() => setFilter("urgent")}
              className={`px-2.5 py-1 rounded-xl transition-all whitespace-nowrap ${
                filter === "urgent" ? "bg-red-500 text-white" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              عاجل / متأخر ({urgentCount})
            </button>
            <button
              onClick={() => setFilter("calendar")}
              className={`px-2.5 py-1 rounded-xl transition-all whitespace-nowrap ${
                filter === "calendar" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              الدروس والتقويم
            </button>
            <button
              onClick={() => setFilter("tasks")}
              className={`px-2.5 py-1 rounded-xl transition-all whitespace-nowrap ${
                filter === "tasks" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              المهام والتسليمات
            </button>
          </div>

          {/* NOTIFICATION LIST */}
          <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
            {isLoading ? (
              <div className="py-8 text-center text-xs text-muted-foreground">جارٍ فحص التقويم والمواعيد…</div>
            ) : filteredList.length > 0 ? (
              filteredList.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    navigate(item.actionUrl);
                    setIsOpen(false);
                  }}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer space-y-1.5 ${
                    item.urgency === "urgent"
                      ? "bg-red-500/5 border-red-500/30 hover:border-red-500/60"
                      : item.urgency === "warning"
                      ? "bg-amber-500/5 border-amber-500/30 hover:border-amber-500/60"
                      : "bg-card hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h5 className="font-extrabold text-xs text-foreground flex items-center gap-1.5 leading-snug">
                      {item.urgency === "urgent" && <AlertTriangle className="size-3.5 text-red-500 shrink-0" />}
                      {item.urgency === "warning" && <Clock className="size-3.5 text-amber-500 shrink-0" />}
                      {item.urgency === "info" && <BookOpen className="size-3.5 text-primary shrink-0" />}
                      {item.urgency === "motivation" && <Flame className="size-3.5 text-orange-500 shrink-0" />}
                      <span>{item.title}</span>
                    </h5>

                    <button
                      onClick={(e) => handleDismiss(item.key, e)}
                      className="text-[10px] text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted shrink-0"
                      title="تجاهل التنبيه"
                    >
                      تجاهل
                    </button>
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed">{item.message}</p>

                  <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[10px] font-bold">
                    <span className="text-primary flex items-center gap-1">
                      <span>{item.actionText}</span>
                      <ArrowRight className="size-3 rotate-180" />
                    </span>
                    {item.timeRemainingText && (
                      <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-mono">
                        {item.timeRemainingText}
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 className="size-8 mx-auto text-emerald-500 opacity-80" />
                <p className="text-xs font-bold text-foreground">جدولك نظيف ومكتمل بالكامل! 🎉</p>
                <p className="text-[11px] text-muted-foreground">لا توجد دروس أو مهام متأخرة بالتقويم التعليمي الذكي.</p>
              </div>
            )}
          </div>

          {/* PANEL FOOTER */}
          <div className="border-t pt-3 flex items-center justify-between">
            <Button
              onClick={() => {
                navigate("/smart-learning-calendar");
                setIsOpen(false);
              }}
              variant="outline"
              size="sm"
              className="w-full rounded-2xl text-xs font-extrabold gap-1 text-primary border-primary/30"
            >
              <Calendar className="size-3.5" /> استعراض التقويم التعليمي الكامل
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

