import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Timer,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Sparkles,
  Award,
  BookOpen,
  Volume2,
  VolumeX,
  Zap,
  Flame,
  Clock,
  X,
  Layers,
} from "lucide-react";
import { toast } from "sonner";

interface SmartFocusTimerProps {
  initialResourceId?: number;
  isOpen?: boolean;
  onClose?: () => void;
}

export function SmartFocusTimer({ initialResourceId, isOpen = true, onClose }: SmartFocusTimerProps) {
  const [selectedResourceId, setSelectedResourceId] = useState<number | null>(initialResourceId || null);
  const [mode, setMode] = useState<"countdown" | "stopwatch">("countdown");
  const [presetMinutes, setPresetMinutes] = useState<number>(25);
  const [secondsLeft, setSecondsLeft] = useState<number>(25 * 60);
  const [stopwatchSeconds, setStopwatchSeconds] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [sessionNotes, setSessionNotes] = useState<string>("");
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  const utils = trpc.useContext();
  const { data: resources } = trpc.resourceBridge.list.useQuery();

  const selectedResource = resources?.find((r: any) => r.id === selectedResourceId) || resources?.[0];

  // Sync selected resource ID when resources load or initialResourceId changes
  useEffect(() => {
    if (!selectedResourceId && resources && resources.length > 0) {
      setSelectedResourceId(resources[0].id);
    }
  }, [resources, selectedResourceId]);

  // Handle Preset Change
  const handleSetPreset = (mins: number) => {
    setIsRunning(false);
    setPresetMinutes(mins);
    setSecondsLeft(mins * 60);
  };

  // Web Audio Chime Sound
  const playFinishChime = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.3); // A5
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.8);
    } catch {
      // Audio fallback
    }
  };

  // Timer Tick Interval
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        if (mode === "countdown") {
          setSecondsLeft((prev) => {
            if (prev <= 1) {
              clearInterval(timerRef.current!);
              setIsRunning(false);
              playFinishChime();
              toast.success("🎉 أحسنت! اكتملت جلسة التركيز بنجاح. قم بتسجيل تقدمك الآن!");
              return 0;
            }
            return prev - 1;
          });
        } else {
          setStopwatchSeconds((prev) => prev + 1);
        }
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, mode, soundEnabled]);

  // Log Focus Session Mutation
  const logSessionMutation = trpc.resourceBridge.logFocusSession.useMutation({
    onSuccess: (data) => {
      utils.resourceBridge.list.invalidate();
      utils.resourceBridge.listFocusSessions.invalidate();
      utils.smartCalendar.getData.invalidate();
      toast.success(
        `تم تسجيل الجلسة بنجاح! +${data.earnedCoins} عملة معدنية (الم المنصة: ${selectedResource?.platform || "عام"}) 🎉`
      );
      handleResetTimer();
      setSessionNotes("");
      if (onClose) onClose();
    },
    onError: (err) => {
      toast.error(err.message || "حدث خطأ أثناء حفظ الجلسة.");
    },
  });

  const handleResetTimer = () => {
    setIsRunning(false);
    if (mode === "countdown") {
      setSecondsLeft(presetMinutes * 60);
    } else {
      setStopwatchSeconds(0);
    }
  };

  const handleSaveSession = () => {
    if (!selectedResource) {
      return toast.error("يرجى اختيار كورس خارجي من قائمة المصادر أولاً.");
    }

    let elapsedMinutes = 0;
    if (mode === "countdown") {
      const totalSecs = presetMinutes * 60;
      const doneSecs = totalSecs - secondsLeft;
      elapsedMinutes = Math.max(1, Math.round(doneSecs / 60));
    } else {
      elapsedMinutes = Math.max(1, Math.round(stopwatchSeconds / 60));
    }

    if (elapsedMinutes < 1) {
      return toast.error("يجب أن تكون مدة الجلسة دقيقة واحدة على الأقل لتسجيلها.");
    }

    logSessionMutation.mutate({
      resourceId: selectedResource.id,
      durationMinutes: elapsedMinutes,
      sessionNotes: sessionNotes.trim() || undefined,
    });
  };

  // Format MM:SS
  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const currentDisplaySecs = mode === "countdown" ? secondsLeft : stopwatchSeconds;
  const progressPercent =
    mode === "countdown"
      ? Math.min(100, Math.round(((presetMinutes * 60 - secondsLeft) / (presetMinutes * 60)) * 100))
      : Math.min(100, Math.round((stopwatchSeconds / 3600) * 100));

  if (!isOpen) return null;

  return (
    <div className="surface p-6 rounded-3xl border bg-gradient-to-b from-card via-card to-primary/5 space-y-6 shadow-xl animate-in fade-in">
      {/* HEADER BAR */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
            <Timer className="size-6 animate-pulse" />
          </div>
          <div>
            <h3 className="font-extrabold text-base flex items-center gap-2">
              <span>مؤقت التركيز الذكي (Smart Focus Timer)</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
                تلقائي الربط
              </span>
            </h3>
            <p className="text-xs text-muted-foreground">
              سجّل جلسات دراستك لكورسات Udemy وCoursera مع التوثيق التلقائي لاسم المنصة وساعات الإنجاز.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-xl border bg-card hover:bg-muted text-muted-foreground transition-all"
            title={soundEnabled ? "إيقاف التنبيه الصوتي" : "تفعيل التنبيه الصوتي"}
          >
            {soundEnabled ? <Volume2 className="size-4 text-primary" /> : <VolumeX className="size-4 text-muted-foreground" />}
          </button>
          {onClose && (
            <button onClick={onClose} className="p-2 rounded-xl border bg-card hover:bg-muted text-muted-foreground transition-all">
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* RESOURCE SELECTION BAR */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-muted-foreground block">
          اختر الكورس الخارجي الذي تدرسه الآن:
        </label>
        {resources && resources.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              value={selectedResourceId || ""}
              onChange={(e) => setSelectedResourceId(Number(e.target.value))}
              className="w-full h-11 rounded-2xl border bg-card px-3 text-xs font-bold text-foreground focus:ring-2 focus:ring-primary outline-none"
            >
              {resources.map((r: any) => (
                <option key={r.id} value={r.id}>
                  {r.title} ({r.platform}) — {r.progressPercent}%
                </option>
              ))}
            </select>

            {selectedResource && (
              <div className="p-2.5 rounded-2xl border bg-muted/30 flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-extrabold border">
                    {selectedResource.platform}
                  </span>
                  <span className="truncate max-w-[120px]">{selectedResource.subject}</span>
                </span>
                <span className="text-muted-foreground font-mono">
                  {selectedResource.completedMinutes} / {selectedResource.totalMinutes} دقيقة
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="p-3 rounded-2xl border border-dashed bg-muted/20 text-xs text-muted-foreground text-center">
            لا توجد دورات خارجية مسجلة بجسر المصادر. يرجى إدخال كورس أولاً للربط التلقائي.
          </div>
        )}
      </div>

      {/* TIMER MODES & PRESETS */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-y py-3">
        <div className="flex items-center gap-1.5 bg-muted p-1 rounded-2xl text-xs font-bold">
          <button
            onClick={() => {
              setMode("countdown");
              setIsRunning(false);
              setSecondsLeft(presetMinutes * 60);
            }}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              mode === "countdown" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            عد تنازلي (Pomodoro)
          </button>
          <button
            onClick={() => {
              setMode("stopwatch");
              setIsRunning(false);
              setStopwatchSeconds(0);
            }}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              mode === "stopwatch" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            ساعة توقيت مفتوحة
          </button>
        </div>

        {mode === "countdown" && (
          <div className="flex items-center gap-1.5">
            {[15, 25, 45, 60].map((mins) => (
              <button
                key={mins}
                onClick={() => handleSetPreset(mins)}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition-all ${
                  presetMinutes === mins
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card hover:border-primary/40 text-muted-foreground"
                }`}
              >
                {mins} دقيقة
              </button>
            ))}
          </div>
        )}
      </div>

      {/* DISPLAY RING & CONTROLS */}
      <div className="flex flex-col items-center justify-center space-y-6 py-4">
        <div className="relative flex items-center justify-center size-52 rounded-full border-8 border-muted bg-card shadow-inner">
          {/* Progress Ring Bar background styling */}
          <div
            className="absolute inset-0 rounded-full border-8 border-primary transition-all duration-1000 opacity-80"
            style={{
              clipPath: `inset(0 ${100 - progressPercent}% 0 0)`,
            }}
          />

          <div className="text-center z-10 space-y-1">
            <span className="font-mono text-5xl font-black text-foreground tracking-tight">
              {formatTime(currentDisplaySecs)}
            </span>
            <div className="flex items-center justify-center gap-1 text-xs font-bold text-muted-foreground">
              {isRunning ? (
                <span className="text-emerald-500 flex items-center gap-1 animate-pulse">
                  <Flame className="size-3.5 fill-emerald-500" /> جاري التركيز...
                </span>
              ) : (
                <span>متوقف</span>
              )}
            </div>
          </div>
        </div>

        {/* TIMER ACTION BUTTONS */}
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setIsRunning(!isRunning)}
            size="lg"
            className={`rounded-2xl px-8 font-black text-sm gap-2 shadow-lg transition-all ${
              isRunning ? "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20" : "bg-primary shadow-primary/25"
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="size-5 fill-current" /> إيقاف مؤقت
              </>
            ) : (
              <>
                <Play className="size-5 fill-current" /> بدء التركيز الآن
              </>
            )}
          </Button>

          <Button onClick={handleResetTimer} variant="outline" size="lg" className="rounded-2xl px-4 text-xs font-bold gap-1">
            <RotateCcw className="size-4" /> إعادة ضبط
          </Button>
        </div>
      </div>

      {/* REFLECTION & SAVE SESSION BOX */}
      <div className="p-4 rounded-2xl border bg-card space-y-3">
        <label className="text-xs font-bold text-muted-foreground block">ملاحظات الجلسة أو المحتوى المنجز (اختياري):</label>
        <Input
          value={sessionNotes}
          onChange={(e) => setSessionNotes(e.target.value)}
          placeholder="مثال: شاهدت المحاضرة 4 وكتبت الملاحظات الجانبية..."
          className="text-xs"
        />

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="text-xs font-bold text-muted-foreground flex items-center gap-1">
            <Award className="size-4 text-amber-500" />
            <span>
              مكافأة الجلسة: +
              {Math.max(
                10,
                Math.round(
                  (mode === "countdown"
                    ? Math.max(1, Math.round((presetMinutes * 60 - secondsLeft) / 60))
                    : Math.max(1, Math.round(stopwatchSeconds / 60))) * 1.5
                )
              )}{" "}
              عملة معدنية
            </span>
          </div>

          <Button
            onClick={handleSaveSession}
            disabled={logSessionMutation.isPending}
            className="rounded-xl text-xs font-extrabold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
          >
            <CheckCircle2 className="size-4" /> حفظ وتوثيق الجلسة
          </Button>
        </div>
      </div>
    </div>
  );
}
