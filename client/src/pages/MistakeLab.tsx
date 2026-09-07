import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Sparkles, Brain, CheckCircle2, XCircle, RotateCcw, AlertTriangle, BookOpen, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export default function MistakeLab() {
  const [selectedSubject, setSelectedSubject] = useState("الكل");
  const [quizData, setQuizData] = useState<any>(null);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  const generateMutation = trpc.mistakeQuiz.generateAI.useMutation({
    onSuccess: (data) => {
      setQuizData(data);
      setUserAnswers({});
      setIsSubmitted(false);
      if (!data.hasMistakes) {
        toast.message("لا توجد أخطاء مسجلة في دفتر الأخطاء لهذه المادة حتى الآن.");
      } else {
        toast.success("تم توليد اختبار تثبيت المعلومة بناءً على أخطائك السابقة!");
      }
    },
    onError: (e) => toast.error(e.message || "حدث خطأ أثناء توليد اختبار الأخطاء."),
  });

  const handleSelectOption = (qId: number, optIdx: number) => {
    if (isSubmitted) return;
    setUserAnswers((prev) => ({ ...prev, [qId]: optIdx }));
  };

  const handleFinishQuiz = () => {
    if (Object.keys(userAnswers).length < (quizData?.questions?.length || 0)) {
      toast.error("يرجى الإجابة على جميع الأسئلة قبل الإنهاء.");
      return;
    }
    setIsSubmitted(true);
    toast.success("أحسنت! تم تصحيح الاختبار وتثبيت المفاهيم.");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="مختبر التكرار المتباعد للأخطاء (Mistake Quizzer)"
        description="يعيد الذكاء الاصطناعي اختبارك في النقاط التي أخطأت فيها سابقاً فقط حتى تضمن عدم تكرار الخلل في الامتحان الحقيقي."
      />

      <div className="surface p-6 rounded-3xl border border-border/80 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Brain className="size-5" />
            </div>
            <div>
              <h2 className="font-bold">اختر المادة لتمرير أخطائها السابقة</h2>
              <p className="text-xs text-muted-foreground">سيستخرج الذكاء الاصطناعي أخطاءك السابقة وينشئ منها اختباراً.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              disabled={generateMutation.isPending}
              onClick={() => generateMutation.mutate({ subject: selectedSubject })}
              className="gap-2 rounded-2xl font-bold shadow-md shadow-primary/20"
            >
              <Sparkles className="size-4" />
              <span>{generateMutation.isPending ? "جارٍ إعداد الاختبار..." : "توليد اختبار أخطائي الآن"}</span>
            </Button>
          </div>
        </div>

        {/* Quiz Display Panel */}
        {quizData?.questions && quizData.questions.length > 0 ? (
          <div className="space-y-6 pt-2">
            {quizData.questions.map((q: any, idx: number) => {
              const selectedOpt = userAnswers[q.id];
              const isCorrect = selectedOpt === q.correctOptionIndex;

              return (
                <div key={q.id || idx} className="p-5 rounded-2xl border bg-card space-y-3">
                  <div className="flex items-center justify-between gap-2 border-b pb-2">
                    <span className="font-bold text-xs text-primary">السؤال {idx + 1} ({q.subject})</span>
                    {isSubmitted && (
                      <span
                        className={`text-xs font-extrabold flex items-center gap-1 ${
                          isCorrect ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {isCorrect ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
                        {isCorrect ? "إجابة صحيحة!" : "إجابة خاطئة"}
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-sm sm:text-base leading-6">{q.question}</h3>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {q.options?.map((opt: string, oIdx: number) => {
                      const isOptionSelected = selectedOpt === oIdx;
                      let btnStyle = "border-border bg-background hover:border-primary/40";

                      if (isSubmitted) {
                        if (oIdx === q.correctOptionIndex) {
                          btnStyle = "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold";
                        } else if (isOptionSelected && !isCorrect) {
                          btnStyle = "border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300 font-bold";
                        }
                      } else if (isOptionSelected) {
                        btnStyle = "border-primary bg-primary/10 text-primary font-bold";
                      }

                      return (
                        <button
                          key={oIdx}
                          onClick={() => handleSelectOption(q.id, oIdx)}
                          className={`p-3.5 rounded-xl border text-right text-xs transition-all ${btnStyle}`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>

                  {isSubmitted && q.explanation && (
                    <div className="p-3 rounded-xl bg-muted/30 border text-xs text-muted-foreground leading-5">
                      <strong className="text-foreground block mb-1">الشرح التوضيحي لتثبيت الفهم:</strong>
                      {q.explanation}
                    </div>
                  )}
                </div>
              );
            })}

            {!isSubmitted ? (
              <Button onClick={handleFinishQuiz} className="w-full h-12 rounded-2xl font-bold text-base shadow-md">
                إنهاء وتصحيح الاختبار
              </Button>
            ) : (
              <Button onClick={() => setQuizData(null)} variant="outline" className="w-full h-12 rounded-2xl font-bold gap-2">
                <RotateCcw className="size-4" /> إجراء اختبار آخر
              </Button>
            )}
          </div>
        ) : (
          <div className="p-10 text-center space-y-3">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <BookOpen className="size-6" />
            </div>
            <h3 className="font-bold text-base">اختبار التكرار المتباعد جاهز</h3>
            <p className="text-xs text-muted-foreground leading-5 max-w-md mx-auto">
              اضغط على زر "توليد اختبار أخطائي الآن" بالأعلى لتحويل أخطائك السابقة المسجلة في دفتر الأخطاء إلى اختبار لتقييم مدى استيعابك وتثبيتك لها.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
