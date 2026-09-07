import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, HelpCircle, CheckCircle2, XCircle, RotateCcw, Trophy, Brain, ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function QuizGenerator() {
  const [subject, setSubject] = useState("الفيزياء");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [questionCount, setQuestionCount] = useState(5);
  const [topicText, setTopicText] = useState("");

  const [quizData, setQuizData] = useState<any>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [scoreResult, setScoreResult] = useState<{ score: number; coinsEarned: number } | null>(null);

  const generateMutation = trpc.quizGenerator.generate.useMutation({
    onSuccess: (data) => {
      if (!data || !data.questions || !data.questions.length) {
        toast.error("تعذر توليد أسئلة من النص المدخل. تأكد من إدخال نص كافٍ.");
        return;
      }
      setQuizData(data);
      setCurrentQuestionIndex(0);
      setSelectedAnswers({});
      setSubmitted(false);
      setScoreResult(null);
      toast.success("تم توليد الاختبار بنجاح! بالتوفيق يا بطل.");
    },
    onError: (e) => toast.error(e.message || "حدث خطأ أثناء توليد الاختبار."),
  });

  const submitMutation = trpc.quizGenerator.submit.useMutation({
    onSuccess: (res) => {
      setScoreResult(res);
      toast.success(`أحسنت! أحرزت ${res.score}% وحصلت على ${res.coinsEarned} Coins 🎉`);
    },
  });

  const handleSelectOption = (questionId: number, optionIndex: number) => {
    if (submitted) return;
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleFinishQuiz = () => {
    if (!quizData) return;
    setSubmitted(true);
    let correctCount = 0;
    quizData.questions.forEach((q: any) => {
      if (selectedAnswers[q.id] === q.correctIndex) {
        correctCount++;
      }
    });

    submitMutation.mutate({
      title: quizData.title || `اختبار ${subject}`,
      totalQuestions: quizData.questions.length,
      correctAnswers: correctCount,
      difficulty,
    });
  };

  const handleReset = () => {
    setQuizData(null);
    setSelectedAnswers({});
    setSubmitted(false);
    setScoreResult(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="مُولّد الاختبارات السريعة (AI Quiz Generator)"
        description="ادخل أي درس أو ملخص، وسيقوم الذكاء الاصطناعي بتوليد أسئلة اختيار من متعدد فورية مع التصحيح التفاعلي والشرح."
      />

      {!quizData ? (
        /* Form Section */
        <div className="surface p-6 rounded-3xl border border-border/80 max-w-3xl mx-auto space-y-5">
          <div className="flex items-center gap-3 border-b pb-4">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
              <Brain className="size-6" />
            </div>
            <div>
              <h2 className="font-bold text-lg">إعدادات الاختبار السريع</h2>
              <p className="text-xs text-muted-foreground">صمّم اختباره بنفسك ودرّب عقلك قبل الامتحان الحقيقي.</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">المادة *</label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="مثال: الأحياء / التاريخ" />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">مستوى الصعوبة</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as any)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="easy">مباشر وسهل</option>
                <option value="medium">متوسط لقياس الفهم</option>
                <option value="hard">تحدي صعب للأوائل</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">عدد الأسئلة</label>
              <select
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
              >
                <option value={5}>5 أسئلة (اختبار سريع)</option>
                <option value={10}>10 أسئلة (اختبار شامل)</option>
                <option value={15}>15 سؤالاً (اختبار مكثف)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1 block">محتوى الدرس / ملخصك / الملاحظات *</label>
            <Textarea
              rows={7}
              value={topicText}
              onChange={(e) => setTopicText(e.target.value)}
              placeholder="انسخ ونقّص هنا نص الدرس، الشرح، أو أسباب إجاباتك السابقة وسيقوم الذكاء الاصطناعي بصياغة أسئلة دقيقة منها..."
              className="leading-6"
            />
          </div>

          <Button
            disabled={generateMutation.isPending || !subject.trim() || !topicText.trim() || topicText.trim().length < 10}
            onClick={() => generateMutation.mutate({ subject, topicText, difficulty, questionCount })}
            className="w-full h-12 rounded-2xl gap-2 font-bold text-base shadow-md shadow-primary/20"
          >
            <Sparkles className="size-5" />
            <span>{generateMutation.isPending ? "جارٍ توليد الأسئلة بالذكاء الاصطناعي…" : "توليد الاختبار فورياً"}</span>
          </Button>
        </div>
      ) : (
        /* Active Quiz View */
        <div className="surface p-6 rounded-3xl border border-border max-w-3xl mx-auto space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg">
                {quizData.title || subject}
              </span>
              <h2 className="font-bold text-lg mt-1">
                السؤال {currentQuestionIndex + 1} من {quizData.questions.length}
              </h2>
            </div>

            <Button variant="outline" size="sm" onClick={handleReset} className="gap-1 rounded-xl text-xs">
              <RotateCcw className="size-3.5" /> اختبار جديد
            </Button>
          </div>

          {scoreResult && (
            <div className="rounded-2xl border border-primary/30 bg-primary/10 p-5 text-center space-y-2">
              <Trophy className="size-8 text-amber-500 mx-auto" />
              <h3 className="text-xl font-extrabold text-primary">النتيجة النهائية: {scoreResult.score}%</h3>
              <p className="text-xs text-muted-foreground">
                كسبت <span className="font-bold text-amber-600 dark:text-amber-400">+{scoreResult.coinsEarned} Coins</span> لجهدك في المذاكرة!
              </p>
            </div>
          )}

          {/* Current Question */}
          {(() => {
            const q = quizData.questions[currentQuestionIndex];
            if (!q) return null;
            const userChoice = selectedAnswers[q.id];

            return (
              <div className="space-y-4">
                <p className="text-base font-bold leading-7 flex items-start gap-2">
                  <HelpCircle className="size-5 text-primary shrink-0 mt-1" />
                  <span>{q.question}</span>
                </p>

                <div className="space-y-2 pt-2">
                  {q.options.map((option: string, optIdx: number) => {
                    let btnStyle = "border-border/80 hover:bg-muted/50";
                    if (userChoice === optIdx) {
                      btnStyle = "border-primary bg-primary/10 font-bold text-primary";
                    }

                    if (submitted) {
                      if (optIdx === q.correctIndex) {
                        btnStyle = "border-emerald-500 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-bold";
                      } else if (userChoice === optIdx && userChoice !== q.correctIndex) {
                        btnStyle = "border-rose-500 bg-rose-500/15 text-rose-800 dark:text-rose-300 font-bold";
                      }
                    }

                    return (
                      <button
                        key={optIdx}
                        disabled={submitted}
                        onClick={() => handleSelectOption(q.id, optIdx)}
                        className={`w-full text-right p-4 rounded-2xl border transition-all flex items-center justify-between text-sm ${btnStyle}`}
                      >
                        <span>{option}</span>
                        {submitted && optIdx === q.correctIndex && <CheckCircle2 className="size-5 text-emerald-600" />}
                        {submitted && userChoice === optIdx && userChoice !== q.correctIndex && (
                          <XCircle className="size-5 text-rose-600" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {submitted && q.explanation && (
                  <div className="mt-4 p-4 rounded-2xl bg-muted/50 border text-xs leading-5">
                    <p className="font-bold text-primary mb-1">💡 التوضيح الشارح:</p>
                    <p>{q.explanation}</p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Controls */}
          <div className="flex items-center justify-between border-t pt-4">
            <Button
              variant="outline"
              disabled={currentQuestionIndex === 0}
              onClick={() => setCurrentQuestionIndex((prev) => prev - 1)}
              className="gap-1 rounded-xl text-xs font-bold"
            >
              <ArrowRight className="size-4" /> السابق
            </Button>

            {!submitted ? (
              <Button
                disabled={Object.keys(selectedAnswers).length < quizData.questions.length}
                onClick={handleFinishQuiz}
                className="gap-2 font-bold rounded-xl"
              >
                <span>إنهاء وتصحيح الاختبار</span>
              </Button>
            ) : (
              <span className="text-xs font-bold text-emerald-600">تم تصحيح الاختبار 🎉</span>
            )}

            <Button
              variant="outline"
              disabled={currentQuestionIndex === quizData.questions.length - 1}
              onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
              className="gap-1 rounded-xl text-xs font-bold"
            >
              التالي <ArrowLeft className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
