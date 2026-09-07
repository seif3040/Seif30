import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Presentation, Mic, MicOff, CheckCircle, AlertCircle, Lightbulb, Trophy, BookOpen } from "lucide-react";
import { toast } from "sonner";

export default function FeynmanStudio() {
  const utils = trpc.useUtils();
  const { data: sessions, isLoading } = trpc.feynman.list.useQuery();

  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("الفيزياء");
  const [explanation, setExplanation] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [result, setResult] = useState<any>(null);

  const evaluateMutation = trpc.feynman.evaluateAI.useMutation({
    onSuccess: (data) => {
      setResult(data.result);
      toast.success("تم تقييم شرحك بنجاح! (+30 Coins)");
      utils.feynman.list.invalidate();
    },
    onError: (e) => toast.error(e.message || "تعذر تقييم الشرح حالياً."),
  });

  const handleSpeechToText = () => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      toast.error("متصفحك لا يدعم التعرف الصوتي المباشر. يمكنك الكتابة بدلاً من ذلك.");
      return;
    }

    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = "ar-EG";
      recognition.continuous = true;
      recognition.interimResults = true;

      if (!isRecording) {
        setIsRecording(true);
        recognition.start();
        toast.info("جارٍ الاستماع لشرحك... تحدث بوضوح.");

        recognition.onresult = (event: any) => {
          let text = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            text += event.results[i][0].transcript;
          }
          setExplanation((prev) => (prev ? prev + " " + text : text));
        };

        recognition.onerror = () => {
          setIsRecording(false);
        };

        recognition.onend = () => {
          setIsRecording(false);
        };
      } else {
        setIsRecording(false);
        recognition.stop();
      }
    } catch {
      toast.error("حدث خطأ أثناء تشغيل الميكروفون.");
      setIsRecording(false);
    }
  };

  const handleSubmit = () => {
    if (!topic.trim()) {
      toast.error("يرجى كتابة اسم الموضوع أو المفهوم المراد شرحه.");
      return;
    }
    if (!explanation.trim() || explanation.trim().length < 10) {
      toast.error("يرجى كتابة أو تسجيل شرح مبسط يتكون من بضع جمل على الأقل.");
      return;
    }
    evaluateMutation.mutate({ topic, subject, userExplanation: explanation });
  };

  if (isLoading) return <div className="h-64 animate-pulse rounded-2xl bg-muted" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="استوديو فاينمان للشرح الذكي (Feynman Studio)"
        description="إذا لم تستطع شرح المفهوم بأسلوب بسيط لطفل في العاشرة، فأنت لم تفهمه بعد. اشرح الدرس بصوتك أو كتابتك واطلب تقييم Gemini!"
      />

      {/* Main Interactive Studio */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 space-y-5">
          <div className="surface p-6 rounded-3xl border border-border/80 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Presentation className="size-5" />
              </div>
              <div>
                <h2 className="font-bold">اشرح المفهوم بأسلوبك البسيط</h2>
                <p className="text-xs text-muted-foreground">تخيل أنك تشرح صديقًا لك لا يعرف شيئًا عن هذا الموضوع.</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1 block">المفهوم / الموضوع *</label>
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="مثال: الظاهرة الكهرودوئية / النظرية النسبية"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1 block">المادة الدراسية</label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="مثال: الفيزياء / الكيمياء" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-muted-foreground">شرحك المبسط *</label>
                <Button
                  type="button"
                  size="sm"
                  variant={isRecording ? "destructive" : "outline"}
                  onClick={handleSpeechToText}
                  className="h-8 rounded-lg gap-1.5 text-xs font-bold"
                >
                  {isRecording ? <MicOff className="size-3.5 animate-pulse" /> : <Mic className="size-3.5" />}
                  <span>{isRecording ? "إيقاف التسجيل الصوتي" : "تحدث بصوتك بدل الكتابة"}</span>
                </Button>
              </div>
              <Textarea
                rows={6}
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="ابدأ بالشرح بالأسلوب الذي تفضله... مثلاً: بص يا سيدي، الضوء لما بيسقط على المعدن..."
                className="leading-6"
              />
            </div>

            <Button
              disabled={evaluateMutation.isPending || !topic.trim() || !explanation.trim()}
              onClick={handleSubmit}
              className="w-full h-12 rounded-2xl gap-2 font-bold text-base shadow-md shadow-primary/20"
            >
              <Sparkles className="size-5" />
              <span>{evaluateMutation.isPending ? "جارٍ تحليل الشرح بالذكاء الاصطناعي…" : "تقييم شرحي بالذكاء الاصطناعي (+30 Coins)"}</span>
            </Button>
          </div>
        </div>

        {/* AI Feedback Display */}
        <div className="lg:col-span-5 space-y-5">
          {result ? (
            <div className="surface p-6 rounded-3xl border border-primary/30 bg-card space-y-4 shadow-md">
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-2">
                  <Trophy className="size-6 text-amber-500" />
                  <h3 className="font-bold text-lg">نتيجة التقييم</h3>
                </div>
                <div className="flex items-center gap-1 rounded-2xl bg-primary/10 px-3 py-1 font-[Manrope] text-xl font-extrabold text-primary">
                  <span>{result.masteryScore}</span>
                  <span className="text-xs opacity-75">/ 100</span>
                </div>
              </div>

              <div className="text-sm leading-6">
                <p className="font-medium text-foreground">{result.summary}</p>
              </div>

              {result.strengths && result.strengths.length > 0 && (
                <div className="space-y-1 text-sm">
                  <p className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle className="size-4" /> نقاط القوة في شرحك:
                  </p>
                  <ul className="list-disc list-inside text-xs space-y-1 text-muted-foreground mr-2">
                    {result.strengths.map((s: string, idx: number) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.gaps && result.gaps.length > 0 && (
                <div className="space-y-1 text-sm">
                  <p className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertCircle className="size-4" /> ثغرات أو تفاصيل ناقصة:
                  </p>
                  <ul className="list-disc list-inside text-xs space-y-1 text-muted-foreground mr-2">
                    {result.gaps.map((g: string, idx: number) => (
                      <li key={idx}>{g}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.simplifiedAnalogy && (
                <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 text-xs leading-5">
                  <p className="font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5 mb-1">
                    <Lightbulb className="size-4" /> تشبيه فاينمان التبسيطي:
                  </p>
                  <p>{result.simplifiedAnalogy}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="surface p-6 rounded-3xl border border-dashed border-border text-center space-y-3">
              <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <BookOpen className="size-6" />
              </div>
              <h3 className="font-bold">مستعد لتقييم فهمك؟</h3>
              <p className="text-xs text-muted-foreground leading-5">
                اكتب أو سجل شرحك على اليمين واضغط تقييم ليقوم Gemini بتحليل شرحك وإعطائك النسبة وتنبيهك للنقاط الناقصة.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Previous Sessions */}
      {sessions && sessions.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-bold text-lg">جلسات التقييم السابقة</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {sessions.map((s: any) => {
              let fb: any = {};
              try {
                fb = JSON.parse(s.aiFeedback || "{}");
              } catch {}
              return (
                <div key={s.id} className="surface p-5 rounded-2xl border border-border/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-primary">{s.topic}</span>
                    <span className="text-xs rounded-full bg-primary/10 px-2.5 py-0.5 font-bold text-primary">
                      {s.masteryScore}% إتقان
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{s.userExplanation}</p>
                  {fb.summary && <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-2">{fb.summary}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
