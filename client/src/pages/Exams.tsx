import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { PageHeader, EmptyState } from "@/components/PageHeader";
import { errorText, shortDate } from "@/lib/study";
import { trpc } from "@/lib/trpc";
import { useRenderLogger } from "@/lib/performance";
import {
  BrainCircuit,
  CheckCircle2,
  CirclePlus,
  FileQuestion,
  GraduationCap,
  Plus,
  Sparkles,
  Target,
  Calendar,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  Trophy,
  Activity,
  ClipboardList
} from "lucide-react";
import { toast } from "sonner";

export default function Exams() {
  useRenderLogger("ExamsModule");
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.exams.list.useQuery();
  const { data: plan } = trpc.studyPlan.list.useQuery();

  const invalidate = () =>
    Promise.all([
      utils.exams.list.invalidate(),
      utils.dashboard.summary.invalidate(),
      utils.analytics.overview.invalidate(),
      utils.coins.ledger.invalidate(),
      utils.achievements.list.invalidate(),
    ]);

  const examsList = data ?? [];

  const stats = useMemo(() => {
    const total = examsList.length;
    const avgReadiness = total > 0 
      ? Math.round(examsList.reduce((acc, item) => acc + (item.readiness?.score ?? 0), 0) / total) 
      : 0;
    const completedAttempts = examsList.reduce((acc, item) => acc + (item.exam.quizReviewedAt ? 1 : 0), 0);
    return { total, avgReadiness, completedAttempts };
  }, [examsList]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-20 animate-pulse rounded-2xl bg-muted" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-24 animate-pulse rounded-2xl bg-muted" />
          <div className="h-24 animate-pulse rounded-2xl bg-muted" />
          <div className="h-24 animate-pulse rounded-2xl bg-muted" />
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="الامتحانات والاختبارات 🎓"
        description="حدّد الدروس التي يغطيها كل امتحان، وقم بمحاكاة وتدريب نفسك بانتظام لحساب استيعابك وجاهزيتك وتحديد نقاط الضعف لحلها!"
        action={{ label: "امتحان جديد +", onClick: () => document.getElementById("exam-trigger")?.click() }}
      />

      <CreateExam plan={plan} onDone={invalidate} />

      {/* Stats Summary Dashboard */}
      {examsList.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="surface p-4 flex items-center gap-4">
            <div className="size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <ClipboardList className="size-5.5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-bold">الاختبارات المجدولة</p>
              <p className="text-xl font-black mt-0.5">{stats.total}</p>
            </div>
          </div>

          <div className="surface p-4 flex items-center gap-4">
            <div className="size-11 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Activity className="size-5.5" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground font-bold">متوسط الجاهزية الحالي</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-black">{stats.avgReadiness}%</span>
                <Progress value={stats.avgReadiness} className="h-2 flex-1" />
              </div>
            </div>
          </div>

          <div className="surface p-4 flex items-center gap-4">
            <div className="size-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Trophy className="size-5.5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-bold">الاختبارات المستعرضة</p>
              <p className="text-xl font-black mt-0.5">{stats.completedAttempts} اختبارات</p>
            </div>
          </div>
        </div>
      )}

      {!examsList.length ? (
        <EmptyState
          title="لا توجد امتحانات مسجلة حتى الآن"
          description="أضف أول اختبار أو امتحان مجدول لديك، وحدد الدروس المطلوبة منه لتتمكن من حساب جاهزيتك بذكاء."
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {examsList.map((item) => (
            <ExamCard key={item.exam.id} item={item} onDone={invalidate} />
          ))}
        </div>
      )}
    </div>
  );
}

function ExamCard({ item, onDone }: { item: any; onDone: () => Promise<any> }) {
  const [open, setOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [total, setTotal] = useState(String(item.exam.quizPayload?.questions?.length ?? 10));
  const [correct, setCorrect] = useState("0");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [result, setResult] = useState<any>(null);

  const mutation = trpc.exams.completeAttempt.useMutation({
    onSuccess: async (r) => {
      setResult(r);
      toast.success(`تم تسجيل محاولتك بنجاح! النتيجة: ${r.score}% — الاستيعاب: ${r.comprehensionScore}% 🎉`);
      await onDone();
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const reviewMutation = trpc.notebooks.markQuizReviewed.useMutation({
    onSuccess: () => onDone(),
    onError: (e) => toast.error(errorText(e)),
  });

  const readiness = item.readiness;
  const weak = readiness?.weakLessons ?? [];
  const quiz = item.exam.quizPayload;
  const notebookQuiz = item.exam.origin === "notebook_ai" && quiz?.questions?.length;

  return (
    <div className="surface p-5 border-2 shadow-xs hover:shadow-md transition-all rounded-3xl flex flex-col justify-between h-full bg-card/20">
      <div className="space-y-4">
        {/* Card Header Category & Badge */}
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <GraduationCap className="size-5" />
            </span>
            <div>
              <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider block">نوع التقييم</span>
              <Badge variant="outline" className="text-[10px] font-bold px-1.5 py-0 border-primary/20 text-primary bg-primary/5">
                {notebookQuiz ? "ملفاتك المدعومة بالذكاء" : item.subject || "منهجك الدراسي"}
              </Badge>
            </div>
          </div>
          <Badge variant="secondary" className="text-[10px] font-bold px-2 py-0.5">
            {notebookQuiz ? "Notebook AI" : "امتحان مرن"}
          </Badge>
        </div>

        {/* Title & Timing info */}
        <div>
          <h3 className="font-black text-sm text-foreground truncate">{item.exam.title}</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
            <Calendar className="size-3 text-muted-foreground" />
            <span>
              {notebookQuiz
                ? `${quiz.questions.length} أسئلة محفوظة للمراجعة`
                : item.exam.scheduledAt
                ? `موعد الامتحان: ${shortDate.format(new Date(item.exam.scheduledAt))}`
                : "اختبار مرن وبلا تاريخ محدد"}
            </span>
          </p>
        </div>

        {/* Readiness Meter Card */}
        <div className="rounded-2xl bg-primary/5 border border-primary/10 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Target className="size-4 text-primary" />
              <p className="text-xs font-bold text-foreground">مدى جاهزيتك للاختبار</p>
            </div>
            <span className="font-[Manrope] text-lg font-black text-primary">{readiness?.score ?? 0}%</span>
          </div>
          <div className="mt-2.5">
            <Progress value={readiness?.score ?? 0} className="h-1.5" />
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground leading-relaxed">
            <span className="font-bold text-foreground">{readiness?.level ?? "أضف دروسًا لتبدأ"}</span> • مكتمل {readiness?.completed ?? 0}/{item.lessons?.length ?? 0} • مراجع {readiness?.reviewed ?? 0}/{item.lessons?.length ?? 0}
          </p>
        </div>

        {/* Notebook AI detail or regular syllabus lessons details */}
        {notebookQuiz ? (
          <div className="rounded-2xl border border-violet-200/50 bg-violet-500/5 p-3.5 space-y-1">
            <p className="text-xs font-bold text-violet-700 dark:text-violet-400">المصادر المستخدمة:</p>
            <p className="text-[11px] text-muted-foreground line-clamp-1">{quiz.sourceNames?.join("، ") || "ملفات مخصصة"}</p>
            <p className="text-[10px] font-bold mt-2 text-violet-600/80">
              {item.exam.quizReviewedAt ? "تم مراجعة كافة الأسئلة وإجاباتها ✅" : "لم يتم مراجعة الأسئلة بعد ⏳"}
            </p>
          </div>
        ) : item.lessons?.length ? (
          <div className="space-y-2">
            <p className="text-xs font-bold text-muted-foreground mr-1">دروس الامتحان المحددة ({item.lessons.length}):</p>
            <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
              {item.lessons.slice(0, 4).map((lesson: any) => (
                <div key={`${lesson.subjectTitle}-${lesson.title}`} className="flex items-center justify-between gap-2 text-xs bg-muted/20 border p-2 rounded-xl">
                  <span className="truncate font-medium flex-1">{lesson.title}</span>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border shrink-0 ${
                      lesson.status === "completed" && lesson.lastReviewedAt
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                        : lesson.status === "completed"
                        ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                        : "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {lesson.status === "completed" && lesson.lastReviewedAt ? "مكتمل ومراجع" : lesson.status === "completed" ? "غير مراجع" : "غير منجز"}
                  </span>
                </div>
              ))}
            </div>

            {weak.length > 0 && (
              <div className="rounded-xl bg-amber-500/5 border border-amber-500/10 p-2.5 text-[10px] text-amber-700 dark:text-amber-400 flex items-start gap-1.5 leading-relaxed">
                <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                <p>
                  <span className="font-bold">نقاط ضعفك المحتملة:</span> ركز على مراجعة دقيقة لدروس: {weak.slice(0, 2).map((lesson: any) => lesson.title).join("، ")}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/80 p-4 text-center text-xs text-muted-foreground">
            لم تقم بتحديد أي دروس لهذا الامتحان حتى الآن، لا يمكن حساب جاهزيتك بدقة بدونها.
          </div>
        )}

        {result && (
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 p-3 text-center">
            <div>
              <p className="text-[10px] text-muted-foreground font-bold">آخر نتيجة محاكاة</p>
              <p className="font-[Manrope] text-lg font-black text-emerald-600 dark:text-emerald-400">{result.score}%</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-bold">نسبة الاستيعاب</p>
              <p className="font-[Manrope] text-lg font-black text-emerald-600 dark:text-emerald-400">{result.comprehensionScore}%</p>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2 mt-5 border-t border-border/40 pt-4">
        {notebookQuiz && (
          <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full h-11 rounded-2xl text-xs gap-1.5 font-bold" onClick={() => reviewMutation.mutate({ examId: item.exam.id })}>
                <FileQuestion className="size-4" />
                <span>افتح الامتحان للمراجعة</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto text-right">
              <DialogHeader>
                <DialogTitle className="text-right font-black text-lg">{item.exam.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {quiz.questions.map((question: any, index: number) => (
                  <details key={`${item.exam.id}-${index}`} className="rounded-2xl border p-4 bg-card/10 select-none group">
                    <summary className="cursor-pointer font-extrabold text-sm flex justify-between items-center list-none">
                      <span>{index + 1}. {question.question}</span>
                      <span className="text-xs text-primary group-open:hidden">عرض الإجابة 👁️</span>
                    </summary>
                    <div className="mt-3 border-t border-border/80 pt-3 text-xs leading-relaxed text-muted-foreground text-right">
                      <b className="text-foreground block mb-1 text-sm">الإجابة النموذجية:</b>
                      <p>{question.answer}</p>
                    </div>
                  </details>
                ))}
              </div>
              <DialogFooter>
                <Button onClick={() => setReviewOpen(false)} className="rounded-xl font-bold bg-primary text-primary-foreground">
                  رجوع للامتحانات
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full h-11 rounded-2xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs gap-1.5">
              <BrainCircuit className="size-4" />
              <span>تسجيل محاولة جديدة +15 🪙</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="text-right">
            <DialogHeader>
              <DialogTitle className="text-right text-lg font-black">تسجيل محاولة اختبار: {item.exam.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">مجموع الأسئلة:</label>
                  <Input type="number" min="1" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="مثال: 10" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">الإجابات الصحيحة:</label>
                  <Input type="number" min="0" value={correct} onChange={(e) => setCorrect(e.target.value)} placeholder="مثال: 8" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">مستوى الصعوبة المتوقع:</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as any)}
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-hidden"
                >
                  <option value="easy">سهل جداً ومباشر</option>
                  <option value="medium">متوسط ومستويات ذكاء</option>
                  <option value="hard">صعب ومحتاج تركيز</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">الموضوعات التي أخطأت بها (مفصولة بفواصل):</label>
                <Input placeholder="مثال: السرعة المتجهة، حساب التفاضل" id={`topics-${item.exam.id}`} />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                disabled={mutation.isPending}
                className="rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-6 gap-1.5"
                onClick={() => {
                  const topics =
                    (document.getElementById(`topics-${item.exam.id}`) as HTMLInputElement)?.value
                      .split(",")
                      .map((x) => x.trim())
                      .filter(Boolean) ?? [];
                  mutation.mutate({
                    examId: item.exam.id,
                    totalQuestions: Number(total),
                    correctAnswers: Number(correct),
                    difficulty,
                    missedTopics: topics,
                  });
                }}
              >
                <BrainCircuit className="size-4" />
                <span>حلل الاستيعاب</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function CreateExam({ onDone, plan }: { onDone: () => Promise<any>; plan: any }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [selected, setSelected] = useState<number[]>([]);

  const lessons = useMemo(() => {
    return (plan?.rows ?? []).flatMap((row: any) =>
      row.lesson
        ? [
            {
              id: row.lesson.id,
              title: row.lesson.title,
              chapter: row.chapter?.title ?? "",
              subject: row.subject?.title ?? "",
            },
          ]
        : []
    );
  }, [plan]);

  const mutation = trpc.exams.create.useMutation({
    onSuccess: async () => {
      toast.success("تمت إضافة الامتحان وحساب الجاهزية بنجاح! 🎉");
      setOpen(false);
      setTitle("");
      setDate("");
      setSelected([]);
      await onDone();
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const toggle = (id: number) =>
    setSelected((items) => (items.includes(id) ? items.filter((item) => item !== id) : [...items, id]));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger id="exam-trigger" asChild>
        <span />
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto text-right">
        <DialogHeader>
          <DialogTitle className="text-right font-black text-lg">إضافة امتحان جديد 🎓</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">عنوان الامتحان:</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: اختبار الجبر الأسبوعي" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">تاريخ الامتحان:</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-bold text-muted-foreground">الدروس التي سيشملها الامتحان:</p>
              <Badge variant="secondary" className="text-[10px] px-2 py-0.5 font-bold">
                {selected.length} دروس محددة
              </Badge>
            </div>

            {lessons.length ? (
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-2xl border p-3 bg-muted/10">
                {lessons.map((lesson: any) => (
                  <label key={lesson.id} className="flex cursor-pointer items-start gap-3 rounded-xl p-3 hover:bg-muted select-none">
                    <input
                      className="mt-1 size-4 rounded border-border"
                      type="checkbox"
                      checked={selected.includes(lesson.id)}
                      onChange={() => toggle(lesson.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <b className="block text-xs font-bold text-foreground">{lesson.title}</b>
                      <span className="text-[10px] text-muted-foreground leading-relaxed block">
                        {lesson.subject} {lesson.chapter ? `• ${lesson.chapter}` : ""}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed p-4 text-xs text-muted-foreground text-center">
                أضف الدروس إلى خطة المذاكرة أولاً، ثم ستظهر هنا لتختار منها ما سيغطيه الامتحان.
              </p>
            )}
          </div>
        </div>
        <p className="text-[10px] leading-relaxed text-muted-foreground text-right border-t pt-3">
          💡 <span className="font-bold text-foreground">معلومة:</span> مدى جاهزيتك يتم احتسابها بنسبة 70% من إكمال الدروس المحددة و30% من مراجعتها بانتظام.
        </p>
        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button
            disabled={!title.trim() || mutation.isPending}
            onClick={() =>
              mutation.mutate({
                title,
                lessonIds: selected,
                scheduledAt: date ? new Date(`${date}T12:00:00`) : undefined,
              })
            }
            className="rounded-xl font-bold px-6 bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
          >
            <Plus className="size-4" />
            <span>إضافة الامتحان</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
