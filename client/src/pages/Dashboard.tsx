import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageHeader, EmptyState } from "@/components/PageHeader";
import { DashboardCustomizer } from "@/components/DashboardCustomizer";
import { AIStudyCoach } from "@/components/AIStudyCoach";
import { arabicDate, money, minutesLabel } from "@/lib/study";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, BookOpen, CalendarRange, CheckCircle2, CircleDollarSign, Clock3, Flame, GraduationCap, ListChecks, Play, Sparkles, Target, Timer, Trophy, Video } from "lucide-react";
import { useLocation } from "wouter";

const stats = [
  { key: "studyMinutes", title: "ساعات المذاكرة", icon: Clock3, tone: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300" },
  { key: "lessonsCompleted", title: "الدروس المكتملة", icon: BookOpen, tone: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" },
  { key: "tasksCompleted", title: "المهام المكتملة", icon: CheckCircle2, tone: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300" },
  { key: "pomodoros", title: "Pomodoros", icon: Timer, tone: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300" },
] as const;

export default function Dashboard() {
  const { data, isLoading } = trpc.dashboard.summary.useQuery();
  const { data: challenge } = trpc.dailyChallenge.get.useQuery();
  const [, navigate] = useLocation();

  if (isLoading)
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    );
  if (!data) return <EmptyState title="مش عارفين نحمّل بيانات المذاكرة دلوقتي" description="جرّب تاني كمان لحظة." />;
  const { metrics, coins } = data;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="يومك الدراسي" title="صباح الفل يا سيف! 🚀" description={arabicDate.format(new Date())} />

      {/* Daily Challenge Banner */}
      {challenge && (
        <div className="surface p-5 rounded-3xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-card to-amber-500/5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-md shadow-amber-500/20">
                <Trophy className="size-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">تحدي النهاردة السريع 🔥</span>
                  <span className="text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 font-extrabold px-2 py-0.5 rounded-full">
                    +{challenge.bonusCoins} Coins مكافأة
                  </span>
                </div>
                <h3 className="font-bold text-base mt-0.5">{challenge.title}: {challenge.task}</h3>
              </div>
            </div>

            <Button onClick={() => navigate("/pomodoro")} size="sm" className="gap-1.5 rounded-xl font-bold bg-amber-500 text-white hover:bg-amber-600">
              <Sparkles className="size-4" /> ابدأ التحدي دلوقتي
            </Button>
          </div>
        </div>
      )}

      {/* AI STUDY COACH MODULE */}
      <AIStudyCoach />

      {/* DRAG AND DROP DASHBOARD PINNED TOOLS */}
      <DashboardCustomizer />

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="surface col-span-1 flex items-center gap-3 bg-primary p-5 text-primary-foreground sm:col-span-2">
          <div className="rounded-xl bg-white/15 p-3">
            <CircleDollarSign className="size-6" />
          </div>
          <div>
            <p className="text-sm text-primary-foreground/75">رصيد عملاتك الحالي</p>
            <p className="font-[Manrope] text-3xl font-extrabold">
              {money.format(coins.balance)} <span className="text-base font-semibold">Coins</span>
            </p>
          </div>
          <Button
            variant="secondary"
            className="mr-auto bg-white/15 text-white hover:bg-white/25"
            onClick={() => navigate("/coins")}
          >
            شوف السجل
            <ArrowLeft className="size-4" />
          </Button>
        </div>
        <div className="surface flex items-center gap-3 p-5">
          <div className="metric-icon bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300">
            <Flame />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">أيام المذاكرة ورا بعض (Streak)</p>
            <p className="text-2xl font-bold">
              {money.format(metrics.currentStreak)} <span className="text-sm font-medium">يوم</span>
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ key, title, icon: Icon, tone }) => (
          <Card key={key} className="border-border/70 shadow-none">
            <CardContent className="flex items-center gap-3 p-4">
              <span className={`metric-icon ${tone}`}>
                <Icon className="size-5" />
              </span>
              <div>
                <p className="text-xs text-muted-foreground">{title}</p>
                <p className="mt-0.5 text-xl font-bold">
                  {key === "studyMinutes" ? minutesLabel(metrics[key]) : money.format(metrics[key])}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <div className="surface overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <p className="font-bold">تركيز النهاردة 🎯</p>
              <p className="text-xs text-muted-foreground">خطوات صغيرة هتوصلك للي بتحلم بيه</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/tasks")}>
              كل المهام
              <ArrowLeft className="size-4" />
            </Button>
          </div>
          <div className="divide-y">
            {data.todaysTasks.length ? (
              data.todaysTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-3 px-5 py-4">
                  <span
                    className={`size-2 rounded-full ${
                      task.priority === "urgent"
                        ? "bg-rose-500"
                        : task.priority === "medium"
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {task.category} · {task.priority === "urgent" ? "ضروري جداً" : task.priority === "medium" ? "متوسط" : "عادي"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-xs ${
                      task.status === "completed"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {task.status === "completed" ? "خلصت ✅" : "لسه شغال ⏳"}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-9 text-center text-sm text-muted-foreground">مفيش مهام مجدولة النهاردة.. ضيف مهمة جديدة وابدأ بخطوة جامدة! 💪</div>
            )}
          </div>
        </div>

        <div className="surface p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="font-bold">تقدم أهدافك 🏆</p>
              <p className="text-xs text-muted-foreground">المسار والأهداف اللي شغال عليها</p>
            </div>
            <Target className="size-5 text-primary" />
          </div>
          {data.activeGoals.length ? (
            <div className="space-y-4">
              {data.activeGoals.map((goal) => (
                <div key={goal.id}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium">{goal.title}</span>
                    <span className="font-[Manrope] text-xs text-primary">{money.format(goal.progress)}%</span>
                  </div>
                  <Progress value={goal.progress} className="h-2" />
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-muted/70 p-4 text-sm text-muted-foreground">
              حدد هدف بتحلم بيه في المنهج ده، وقسّمه لخطوات صغيرة وسهلة!
            </p>
          )}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <QuickAction icon={CalendarRange} title="جدول الأسبوع" description="شوف خطتك وجلساتك" onClick={() => navigate("/weekly-schedule")} />
        <QuickAction icon={Play} title="يلا نذاكر" description="ضيف درس جديد أو كمل المذاكرة" onClick={() => navigate("/study-plan")} />
        <QuickAction icon={Timer} title="تايمر البومودورو 🍅" description="جلسة تركيز ورقان" onClick={() => navigate("/pomodoro")} />
        <QuickAction icon={Video} title="فيديو مذاكرة" description="شغّل الدرس والتايمر مع بعض" onClick={() => navigate("/study-video")} />
        <QuickAction icon={GraduationCap} title="سجّل امتحانك" description="واحسب مستواك وفهمك" onClick={() => navigate("/exams")} />
      </section>
    </div>
  );
}
function QuickAction({ icon: Icon, title, description, onClick }: { icon: any; title: string; description: string; onClick: () => void }) { return <button onClick={onClick} className="surface group flex items-center gap-3 p-4 text-right transition hover:-translate-y-0.5 hover:border-primary/40"><span className="metric-icon bg-secondary text-primary"><Icon className="size-5" /></span><span><span className="block text-sm font-bold">{title}</span><span className="text-xs text-muted-foreground">{description}</span></span><ArrowLeft className="mr-auto size-4 text-muted-foreground transition group-hover:-translate-x-1 group-hover:text-primary" /></button>; }
