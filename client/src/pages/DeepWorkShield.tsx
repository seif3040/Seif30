import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldAlert, Play, Pause, RotateCcw, Award, Volume2, Sparkles, Lock, CheckCircle2, Flame } from "lucide-react";
import { toast } from "sonner";

export default function DeepWorkShield() {
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [subject, setSubject] = useState("");

  const completeMutation = trpc.deepWork.completeSession.useMutation({
    onSuccess: (data) => {
      toast.success(`🎉 أحسنت! أتممت جلسة التركيز العميق وبدون تشتيت وحصلت على ${data.coinsEarned} Coins!`);
      setIsActive(false);
      setIsLocked(false);
      setTimeLeft(durationMinutes * 60);
    },
  });

  useEffect(() => {
    let interval: any = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (isActive && timeLeft === 0) {
      clearInterval(interval);
      completeMutation.mutate({ durationMinutes, subject });
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const handleStart = () => {
    if (!isLocked) {
      toast.error("يرجى تفعيل عهد الالتزام ومنع المشتتات للبدء!");
      return;
    }
    setTimeLeft(durationMinutes * 60);
    setIsActive(true);
    toast.success("بدأت جلسة درع التركيز الآن! ركز على مذاكرتك فقط.");
  };

  const handleReset = () => {
    setIsActive(false);
    setTimeLeft(durationMinutes * 60);
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const progressPercent = Math.round(((durationMinutes * 60 - timeLeft) / (durationMinutes * 60)) * 100);

  return (
    <div className="space-y-6">
      <PageHeader
        title="درع التركيز الصارم (Deep Work Shield)"
        description="وضع غمس كامل لمنع المشتتات وإغلاق التشتت البصري أثناء المذاكرة للحصول على أقصى تركيز ومكافآت مضاعفة."
      />

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Main Focus Shield Center */}
        <div className="lg:col-span-8 space-y-6">
          <div
            className={`surface p-8 sm:p-12 rounded-3xl border text-center transition-all ${
              isActive ? "border-primary shadow-2xl bg-primary/5" : "border-border/80"
            }`}
          >
            <div className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-primary/10 text-primary mb-4">
              <ShieldAlert className="size-8 animate-pulse" />
            </div>

            <h2 className="text-2xl font-bold tracking-tight">
              {isActive ? "درع التركيز نَشِط الآن 🛡️" : "جاهز لبدء جلسة التركيز العميق؟"}
            </h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              تعهد بعدم فتح المشتتات أو الانتقال للتطبيقات طوال الجلسة لتربح مكافأة Coins مضاعفة.
            </p>

            {/* Timer Display */}
            <div className="my-8 space-y-3">
              <div className="font-mono text-6xl sm:text-7xl font-extrabold tracking-widest text-primary">
                {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
              </div>

              {/* Progress bar */}
              <div className="w-full bg-muted h-3 rounded-full overflow-hidden max-w-md mx-auto">
                <div
                  className="bg-primary h-full transition-all duration-500 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Lock pledge toggle */}
            {!isActive && (
              <div className="max-w-md mx-auto mb-6 p-4 rounded-2xl border bg-card text-right space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isLocked}
                    onChange={(e) => setIsLocked(e.target.checked)}
                    className="mt-1 size-4 rounded text-primary focus:ring-primary"
                  />
                  <div>
                    <span className="font-bold text-xs block">عهد الالتزام ومنع المشتتات</span>
                    <span className="text-[11px] text-muted-foreground leading-4 block">
                      أتعهد بالتركيز التام على المادة المحددة وعدم فتح وسائل التواصل أو المشتتات طوال مدة الـ {durationMinutes} دقيقة.
                    </span>
                  </div>
                </label>
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center justify-center gap-3">
              {!isActive ? (
                <Button
                  onClick={handleStart}
                  size="lg"
                  className="h-14 px-8 rounded-2xl gap-2 font-bold text-base shadow-lg shadow-primary/20"
                >
                  <Play className="size-5 fill-current" /> بدء درع التركيز الآن
                </Button>
              ) : (
                <>
                  <Button
                    onClick={() => setIsActive(false)}
                    variant="outline"
                    size="lg"
                    className="h-12 rounded-2xl gap-2 font-bold"
                  >
                    <Pause className="size-5" /> إيقاف مؤقت
                  </Button>
                  <Button onClick={handleReset} variant="ghost" size="lg" className="h-12 rounded-2xl gap-2 text-muted-foreground">
                    <RotateCcw className="size-5" /> إعادة ضبط
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Settings */}
        <div className="lg:col-span-4 space-y-4">
          <div className="surface p-6 rounded-3xl border border-border/80 space-y-4">
            <h3 className="font-bold text-base border-b pb-3 flex items-center gap-2">
              <Lock className="size-4 text-primary" /> إعدادات الجلسة
            </h3>

            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">مدة الجلسة (بالدقائق)</label>
              <div className="grid grid-cols-3 gap-2">
                {[15, 25, 45, 60, 90, 120].map((m) => (
                  <Button
                    key={m}
                    variant={durationMinutes === m ? "default" : "outline"}
                    size="sm"
                    disabled={isActive}
                    onClick={() => {
                      setDurationMinutes(m);
                      setTimeLeft(m * 60);
                    }}
                    className="rounded-xl font-bold text-xs"
                  >
                    {m} د
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">المادة المُراد تركيز المذاكرة عليها</label>
              <Input
                disabled={isActive}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="مثال: رياضيات، فيزياء، لغة عربية"
              />
            </div>

            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs space-y-1">
              <span className="font-bold flex items-center gap-1">
                <Sparkles className="size-3.5" /> مكافأة العهد الصارم
              </span>
              <p className="leading-5">
                إتمام الجلسة بدون خروج يمنحك <strong>+{Math.round(durationMinutes * 1.5) + 20} Coins</strong> ومضاعف استمرار لرفع ترتيبك!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
