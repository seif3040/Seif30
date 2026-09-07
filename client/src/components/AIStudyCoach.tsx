import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Bot,
  Sparkles,
  Zap,
  Timer,
  FolderGit2,
  AlertTriangle,
  CheckCircle2,
  Volume2,
  VolumeX,
  RefreshCw,
  Trophy,
  Flame,
  ArrowRight,
  Lightbulb,
  Target,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

export function AIStudyCoach() {
  const { data, isLoading, isFetching, refetch } = trpc.studyCoach.getInsights.useQuery(undefined, {
    staleTime: 1000 * 60 * 5, // 5 mins
  });

  const [completedTips, setCompletedTips] = useState<Record<number, boolean>>({});
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const report = data?.coachReport;
  const stats = data?.statsSummary;

  const toggleTip = (index: number) => {
    setCompletedTips((prev) => {
      const next = { ...prev, [index]: !prev[index] };
      if (next[index]) {
        toast.success("عاش يا بطل! كمل المذاكرة وطبق باقي النصائح 💪");
      }
      return next;
    });
  };

  const handleSpeakText = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.error("خاصية نطق الصوت غير مدعومة في متصفحك.");
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ar-EG"; // Egyptian / Arabic
    utterance.rate = 0.95;

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  if (isLoading) {
    return (
      <div className="surface p-6 rounded-3xl border bg-card space-y-4 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-2xl bg-muted" />
          <div className="space-y-2 flex-1">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-3 bg-muted rounded w-2/3" />
          </div>
        </div>
        <div className="h-20 bg-muted rounded-2xl" />
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="surface overflow-hidden rounded-3xl border bg-gradient-to-br from-card via-card to-primary/5 p-6 shadow-md space-y-6 transition-all duration-300">
      {/* HEADER BAR */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-600 text-white shadow-lg shadow-teal-500/25">
              <Bot className="size-8 animate-bounce-slow" />
            </div>
            <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-black text-black ring-2 ring-background">
              🇪🇬
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-black text-lg text-foreground">كوتش المذاكرة والتركيز الذكي 🤖🇪🇬</h3>
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-xs font-bold">
                {report.overallRating || "بطل تركيز 🏆"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              تحليل موجه بالذكاء الاصطناعي لعادات البومودورو والـ Resource Bridge بلهجة مصرية مشجعة.
            </p>
          </div>
        </div>

        {/* RIGHT SCORE & RE-ANALYZE */}
        <div className="flex items-center gap-3">
          <div className="text-left bg-primary/10 border border-primary/20 px-3.5 py-1.5 rounded-2xl">
            <span className="text-[10px] font-black text-muted-foreground uppercase block">مؤشر التركيز</span>
            <span className="text-base font-black text-primary">
              %{report.concentrationScore || 85}
            </span>
          </div>

          <Button
            onClick={() => refetch()}
            disabled={isFetching}
            variant="outline"
            size="sm"
            className="rounded-2xl gap-1.5 text-xs font-bold"
            title="إعادة تحليل عادات المذاكرة"
          >
            <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">تحليل جديد</span>
          </Button>

          <Button
            onClick={() => setIsExpanded(!isExpanded)}
            variant="ghost"
            size="sm"
            className="rounded-2xl p-2 text-muted-foreground hover:text-foreground"
          >
            {isExpanded ? <ChevronUp className="size-5" /> : <ChevronDown className="size-5" />}
          </Button>
        </div>
      </div>

      {/* MAIN SPEECH BUBBLE FROM EGYPTIAN COACH */}
      <div className="relative rounded-2xl border-2 border-primary/20 bg-primary/5 p-4 md:p-5 shadow-sm space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-black text-primary">
            <Sparkles className="size-4" />
            <span>رسالة الكوتش لك اليوم:</span>
          </div>

          <button
            onClick={() => handleSpeakText(report.headline)}
            className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-xl transition-all ${
              isSpeaking
                ? "bg-amber-500 text-black animate-pulse"
                : "bg-background text-muted-foreground hover:text-foreground border"
            }`}
          >
            {isSpeaking ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
            <span>{isSpeaking ? "إيقاف الصوت" : "استمع للكوتش 🔊"}</span>
          </button>
        </div>

        <p className="text-sm md:text-base font-extrabold text-foreground leading-relaxed pr-2">
          "{report.headline}"
        </p>

        {report.quickChallengeToday && (
          <div className="flex items-center gap-2 pt-2 border-t border-primary/10 text-xs font-bold text-amber-600 dark:text-amber-400">
            <Target className="size-4 shrink-0 text-amber-500" />
            <span>تحدي اليوم: {report.quickChallengeToday}</span>
          </div>
        )}
      </div>

      {/* EXPANDABLE DETAILED BREAKDOWN */}
      {isExpanded && (
        <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* 3 ANALYSIS CARDS GRID */}
          <div className="grid gap-3 sm:grid-cols-3">
            {/* CARD 1: POMODORO */}
            <div className="rounded-2xl border bg-card p-4 space-y-2 border-orange-500/20 bg-orange-500/5">
              <div className="flex items-center gap-2 text-xs font-bold text-orange-600 dark:text-orange-400">
                <Timer className="size-4" />
                <span>عادات البومودورو ⏱️</span>
              </div>
              <p className="text-xs text-foreground/90 font-medium leading-relaxed">
                {report.pomodoroAnalysis}
              </p>
              {stats && (
                <div className="pt-2 text-[11px] font-bold text-muted-foreground border-t border-orange-500/10">
                  {stats.completedPomodoros} جلسة مكتملة ({stats.totalPomoMinutes} دقيقة)
                </div>
              )}
            </div>

            {/* CARD 2: RESOURCE BRIDGE */}
            <div className="rounded-2xl border bg-card p-4 space-y-2 border-teal-500/20 bg-teal-500/5">
              <div className="flex items-center gap-2 text-xs font-bold text-teal-600 dark:text-teal-400">
                <FolderGit2 className="size-4" />
                <span>جسر المصادر 📚</span>
              </div>
              <p className="text-xs text-foreground/90 font-medium leading-relaxed">
                {report.resourceBridgeAnalysis}
              </p>
              {stats && (
                <div className="pt-2 text-[11px] font-bold text-muted-foreground border-t border-teal-500/10">
                  {stats.totalResources} مصدر مسجل • {stats.pdfCount} ملف PDF
                </div>
              )}
            </div>

            {/* CARD 3: DISTRACTION BOTTLENECK */}
            <div className="rounded-2xl border bg-card p-4 space-y-2 border-rose-500/20 bg-rose-500/5">
              <div className="flex items-center gap-2 text-xs font-bold text-rose-600 dark:text-rose-400">
                <AlertTriangle className="size-4" />
                <span>أكبر مشتت لوحظ ⚠️</span>
              </div>
              <p className="text-xs text-foreground/90 font-medium leading-relaxed">
                {report.topDistractionFound || "عدم الالتزام ببريك البومودورو والتنقل بين التبويبات."}
              </p>
            </div>
          </div>

          {/* ACTIONABLE TIPS CHECKLIST */}
          {report.actionableTips && report.actionableTips.length > 0 && (
            <div className="space-y-3 pt-2 border-t">
              <h4 className="text-xs font-black text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Lightbulb className="size-4 text-amber-500" />
                <span>نصائح الكوتش لزيادة التركيز الآن (حدد ما قمت بتطبيقه):</span>
              </h4>

              <div className="grid gap-2 sm:grid-cols-3">
                {report.actionableTips.map((tip: string, idx: number) => {
                  const isChecked = !!completedTips[idx];
                  return (
                    <div
                      key={idx}
                      onClick={() => toggleTip(idx)}
                      className={`flex items-start gap-2.5 p-3 rounded-2xl border transition-all cursor-pointer ${
                        isChecked
                          ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-950 dark:text-emerald-200 line-through opacity-70"
                          : "bg-card hover:border-primary/40 hover:bg-primary/5 text-foreground"
                      }`}
                    >
                      <button
                        type="button"
                        className={`size-5 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                          isChecked
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : "border-muted-foreground/40 hover:border-primary"
                        }`}
                      >
                        {isChecked && <CheckCircle2 className="size-3.5" />}
                      </button>
                      <span className="text-xs font-bold leading-snug">{tip}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
