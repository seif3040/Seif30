import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { PageHeader, EmptyState } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertCircle, CheckCircle2, Plus, Sparkles, Trash2, BookX, HelpCircle, BrainCircuit } from "lucide-react";
import { toast } from "sonner";
import { GoogleKeepExporter } from "@/components/GoogleKeepExporter";

const ERROR_TYPES = [
  { id: "misunderstanding", label: "عدم استيعاب الفكرة", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  { id: "hasty_reading", label: "تسرع وقراءة خاطئة", color: "bg-rose-500/10 text-rose-600 border-rose-500/20" },
  { id: "time_pressure", label: "ضيق الوقت", color: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
  { id: "unit_or_sign", label: "إشارة / تحويل / صياغة", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  { id: "forgetting", label: "نسيان القانون أو القاعدة", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
];

export default function MistakeNotebook() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.mistakes.list.useQuery();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("اللغة العربية");
  const [topic, setTopic] = useState("");
  const [errorType, setErrorType] = useState("misunderstanding");
  const [question, setQuestion] = useState("");
  const [wrongAnswer, setWrongAnswer] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [explanation, setExplanation] = useState("");
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

  const createMutation = trpc.mistakes.create.useMutation({
    onSuccess: () => {
      toast.success("تم تسجيل الخطأ في الكشكول! (+15 Coins)");
      setOpen(false);
      resetForm();
      utils.mistakes.list.invalidate();
    },
    onError: (e) => toast.error(e.message || "تعذر حفظ الخطأ"),
  });

  const updateStatus = trpc.mistakes.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث حالة الخطأ.");
      utils.mistakes.list.invalidate();
    },
  });

  const deleteMutation = trpc.mistakes.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف الخطأ.");
      utils.mistakes.list.invalidate();
    },
  });

  const analyzeAI = trpc.mistakes.analyzeAI.useMutation({
    onSuccess: (res) => setAiAnalysis(res),
    onError: () => toast.error("تعذر إجراء التحليل الذكي الآن."),
  });

  const resetForm = () => {
    setQuestion("");
    setWrongAnswer("");
    setCorrectAnswer("");
    setExplanation("");
    setTopic("");
  };

  const handleCreate = () => {
    if (!question.trim() || !correctAnswer.trim()) {
      toast.error("يرجى كتابة نص السؤال والإجابة الصحيحة على الأقل.");
      return;
    }
    createMutation.mutate({ subject, topic, errorType, question, wrongAnswer, correctAnswer, explanation });
  };

  if (isLoading) return <div className="h-64 animate-pulse rounded-2xl bg-muted" />;

  const mistakes = data || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="كشكول الأخطاء الذكي"
        description="سجّل أخطاءك في التدريبات والامتحانات لتحولها لقاطرة للتميز وتمنع تكرارها."
        action={{ label: "إضافة خطأ جديد", onClick: () => setOpen(true) }}
      />

      {/* AI Analysis Bar */}
      <div className="surface p-6 rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
              <BrainCircuit className="size-6" />
            </div>
            <div>
              <h2 className="font-bold text-lg">تحليل كشكول الأخطاء بالذكاء الاصطناعي</h2>
              <p className="text-xs text-muted-foreground">اكشف النمط المتكرر لأخطائك واحصل على خطة علاجية مخصصة.</p>
            </div>
          </div>
          <Button
            disabled={analyzeAI.isPending || !mistakes.length}
            onClick={() => analyzeAI.mutate()}
            className="rounded-xl gap-2 font-bold shadow-sm"
          >
            <Sparkles className="size-4" />
            <span>{analyzeAI.isPending ? "جارٍ التحليل…" : "تحليل أخطائي بالذكاء الاصطناعي"}</span>
          </Button>
        </div>

        {aiAnalysis && (
          <div className="mt-5 rounded-2xl border border-primary/20 bg-card p-5 text-sm leading-7 shadow-xs whitespace-pre-line">
            <h3 className="font-bold text-primary mb-2 flex items-center gap-2">
              <Sparkles className="size-4" /> التقرير التحليلي والخطة العلاجية:
            </h3>
            {aiAnalysis}
          </div>
        )}
      </div>

      {/* Mistakes List */}
      {!mistakes.length ? (
        <EmptyState
          title="كشكول الأخطاء فارغ تمامًا!"
          description="أي سؤال تغلط فيه، حطه هنا فورًا مع السبب عشان تضمن إنك مش هتكرر نفس الغلطة في الامتحان."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {mistakes.map((item: any) => {
            const errTypeObj = ERROR_TYPES.find((t) => t.id === item.errorType) || ERROR_TYPES[0];
            return (
              <div
                key={item.id}
                className={`surface p-5 rounded-2xl border space-y-4 transition-all ${
                  item.status === "mastered" ? "border-emerald-500/30 bg-emerald-500/5 opacity-80" : "border-border/80"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                      {item.subject}
                    </span>
                    {item.topic && <span className="text-xs font-medium text-muted-foreground">({item.topic})</span>}
                    <span className={`rounded-lg border px-2.5 py-0.5 text-xs font-medium ${errTypeObj.color}`}>
                      {errTypeObj.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        updateStatus.mutate({
                          mistakeId: item.id,
                          status: item.status === "mastered" ? "needs_review" : "mastered",
                        })
                      }
                      title={item.status === "mastered" ? "إعادة للمراجعة" : "تحديد كمتقن"}
                      className="size-8"
                    >
                      <CheckCircle2 className={`size-4 ${item.status === "mastered" ? "text-emerald-600" : "text-muted-foreground"}`} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => window.confirm("حذف هذا الخطأ؟") && deleteMutation.mutate({ mistakeId: item.id })}
                      className="size-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="rounded-xl bg-muted/50 p-3 font-semibold">
                    <p className="text-xs font-bold text-muted-foreground mb-1 flex items-center gap-1">
                      <HelpCircle className="size-3.5 text-primary" /> السؤال:
                    </p>
                    {item.question}
                  </div>

                  {item.wrongAnswer && (
                    <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-rose-700 dark:text-rose-300">
                      <p className="text-xs font-bold mb-0.5 flex items-center gap-1">
                        <AlertCircle className="size-3.5" /> إجابتي الخاطئة:
                      </p>
                      {item.wrongAnswer}
                    </div>
                  )}

                  <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-emerald-800 dark:text-emerald-300">
                    <p className="text-xs font-bold mb-0.5 flex items-center gap-1">
                      <CheckCircle2 className="size-3.5" /> الإجابة الصحيحة والقاعدة:
                    </p>
                    {item.correctAnswer}
                  </div>

                  {item.explanation && (
                    <p className="text-xs text-muted-foreground italic bg-muted/30 p-2.5 rounded-lg">
                      💡 ملاحظتي: {item.explanation}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Google Keep & Workspace Notes Exporter */}
      <GoogleKeepExporter />

      {/* Create Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-right">تسجيل خطأ جديد في كشكول الأخطاء</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-right">
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">المادة الدراسية</label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="مثال: الفيزياء / التاريخ" />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">الدرس / الفصل (اختياري)</label>
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="مثال: الفصل الثالث - التيار المتردد" />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">سبب / نوع الخطأ</label>
              <select
                value={errorType}
                onChange={(e) => setErrorType(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
              >
                {ERROR_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">السؤال / المسألة *</label>
              <Textarea
                rows={2}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="اكتب نص السؤال الذي أخطأت فيه..."
              />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">إجابتي الخاطئة (اختياري)</label>
              <Input value={wrongAnswer} onChange={(e) => setWrongAnswer(e.target.value)} placeholder="ما الذي اخترته أو كتبته غلط؟" />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">الإجابة الصحيحة *</label>
              <Textarea
                rows={2}
                value={correctAnswer}
                onChange={(e) => setCorrectAnswer(e.target.value)}
                placeholder="اكتب الإجابة النموذجية والشرح الخفيف..."
              />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">نصيحة لنفسك لتجنبها مستقبلاً</label>
              <Input value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="مثال: ركّز في قراءة المطلوب أولاً..." />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
            <Button disabled={createMutation.isPending} onClick={handleCreate} className="gap-2 font-bold">
              <Plus className="size-4" />
              <span>{createMutation.isPending ? "جارٍ الحفظ…" : "حفظ الخطأ (+15 Coins)"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
