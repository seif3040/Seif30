import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PageHeader, EmptyState } from "@/components/PageHeader";
import { completionToast, errorText, formatShortDate, inputDate, parseDate } from "@/lib/study";
import { trpc } from "@/lib/trpc";
import { useRenderLogger } from "@/lib/performance";
import {
  CalendarDays,
  CheckCircle2,
  Pencil,
  Plus,
  Trash2,
  Clock,
  Sparkles,
  ClipboardList,
  Flame,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";

const priorityMap: any = {
  urgent: ["ضروري جداً 🔥", "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50", 30],
  medium: ["متوسط ⚡", "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50", 20],
  low: ["على الهادي 🍃", "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50", 10]
};

export default function Tasks() {
  useRenderLogger("TasksModule");
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.tasks.list.useQuery();
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all");

  const invalidate = () =>
    Promise.all([
      utils.tasks.list.invalidate(),
      utils.dashboard.summary.invalidate(),
      utils.analytics.overview.invalidate(),
    ]);

  const tasksList = data ?? [];

  // Categorize or filter tasks
  const filteredTasks = useMemo(() => {
    if (filter === "pending") return tasksList.filter((t) => t.status !== "completed");
    if (filter === "completed") return tasksList.filter((t) => t.status === "completed");
    return tasksList;
  }, [tasksList, filter]);

  const stats = useMemo(() => {
    const total = tasksList.length;
    const completed = tasksList.filter((t) => t.status === "completed").length;
    const pending = total - completed;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, pending, completionRate };
  }, [tasksList]);

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
        title="المهام والجدول اليومي 📝"
        description="خطّط ليومك الدراسي بذكاء، قسّم المهام الكبرى لخطوات سهلة الإنجاز، واكسب عملات ذهبية لتشجيعك مع كل مهمة تُنجزها! 💪"
        action={{ label: "مهمة جديدة +", onClick: () => document.getElementById("task-trigger")?.click() }}
      />

      <CreateTask onDone={invalidate} />

      {/* Task Performance Statistics */}
      {tasksList.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="surface p-4 flex items-center gap-4">
            <div className="size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <ClipboardList className="size-5.5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-bold">إجمالي المهام</p>
              <p className="text-xl font-black mt-0.5">{stats.total}</p>
            </div>
          </div>

          <div className="surface p-4 flex items-center gap-4">
            <div className="size-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle className="size-5.5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-bold">المهام المكتملة</p>
              <p className="text-xl font-black mt-0.5">
                {stats.completed} <span className="text-xs text-muted-foreground font-normal">منجز</span>
              </p>
            </div>
          </div>

          <div className="surface p-4 flex items-center gap-4">
            <div className="size-11 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="size-5.5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-bold">مهام قيد الانتظار</p>
              <p className="text-xl font-black mt-0.5">
                {stats.pending} <span className="text-xs text-muted-foreground font-normal">باقية</span>
              </p>
            </div>
          </div>

          <div className="surface p-4 flex items-center gap-4">
            <div className="size-11 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Flame className="size-5.5" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground font-bold">معدل الإنجاز اليومي</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-bold">{stats.completionRate}%</span>
                <span className="text-[10px] text-muted-foreground shrink-0">أحسنت!</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      {tasksList.length > 0 && (
        <div className="flex border-b border-border bg-card/40 p-1.5 rounded-2xl max-w-md">
          <button
            onClick={() => setFilter("all")}
            className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all ${
              filter === "all" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:bg-muted/30"
            }`}
          >
            الكل ({stats.total})
          </button>
          <button
            onClick={() => setFilter("pending")}
            className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all ${
              filter === "pending" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:bg-muted/30"
            }`}
          >
            المتبقية ({stats.pending})
          </button>
          <button
            onClick={() => setFilter("completed")}
            className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all ${
              filter === "completed" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:bg-muted/30"
            }`}
          >
            المكتملة ({stats.completed})
          </button>
        </div>
      )}

      {!filteredTasks.length ? (
        <EmptyState
          title={filter === "completed" ? "لم تكمل أي مهام بعد" : "يومك رايق ومفيش مهام لسه!"}
          description={
            filter === "completed"
              ? "ابدأ بإنجاز المهام البسيطة أولاً لتسجيلها هنا والبدء بجمع المكافآت."
              : "أضف مهام يومك والدروس التي تنوي دراستها الآن لتمنح نفسك دفعة إيجابية من أول اليوم."
          }
        />
      ) : (
        <div className="surface divide-y divide-border/60 overflow-hidden border-2 shadow-xs rounded-3xl">
          {filteredTasks.map((task) => (
            <TaskRow key={task.id} task={task} onDone={invalidate} />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, onDone }: { task: any; onDone: () => Promise<any> }) {
  const mutation = trpc.tasks.complete.useMutation({
    onSuccess: async (r) => {
      const reward = priorityMap[task.priority]?.[2] ?? 20;
      completionToast(r, reward);
      await onDone();
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const remove = trpc.tasks.delete.useMutation({
    onSuccess: async () => {
      toast.success("تم مسح المهمة خلاص 👍");
      await onDone();
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const edit = trpc.tasks.update.useMutation({
    onSuccess: async () => {
      toast.success("تم تعديل المهمة بنجاح ✅");
      await onDone();
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const [label, tone] = priorityMap[task.priority] ?? ["عادي", "bg-muted text-muted-foreground border-border"];

  const updateTitle = () => {
    const title = window.prompt("عنوان المهمة الجديد:", task.title);
    if (title?.trim()) {
      edit.mutate({
        taskId: task.id,
        title,
        description: task.description ?? undefined,
        scheduledFor: inputDate(task.scheduledFor) || undefined,
        deadline: parseDate(task.deadline) ?? undefined,
        priority: task.priority,
        category: task.category,
      });
    }
  };

  const isCompleted = task.status === "completed";
  const scheduledText = task.scheduledFor ? formatShortDate(task.scheduledFor) : "غير محدد التوقيت";
  const deadlineText = task.deadline ? formatShortDate(task.deadline) : "";

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 transition-colors ${
        isCompleted ? "bg-muted/10" : "bg-card/20 hover:bg-muted/5"
      }`}
    >
      <div className="flex items-start gap-4 flex-1 min-w-0">
        <div className="pt-1 select-none">
          <Checkbox
            id={`task-check-${task.id}`}
            checked={isCompleted}
            disabled={isCompleted || mutation.isPending}
            onCheckedChange={() => mutation.mutate({ taskId: task.id })}
            className="size-5 rounded-md border-border/80 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600 shadow-sm transition-all"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor={`task-check-${task.id}`}
              className={`font-black text-sm text-foreground cursor-pointer select-none transition-all ${
                isCompleted ? "text-muted-foreground line-through opacity-70" : ""
              }`}
            >
              {task.title}
            </label>
            <Badge variant="outline" className={`text-[10px] font-bold px-2 py-0 border ${tone}`}>
              {label}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            {task.description || task.category || "لا توجد تفاصيل إضافية مضافة."}
            {deadlineText && (
              <span className="inline-flex items-center gap-1 font-semibold text-rose-500/80 bg-rose-500/5 px-2 py-0.5 rounded-full mr-2">
                <AlertCircle className="size-3" />
                آخر موعد: {deadlineText}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/45 px-3 py-1.5 rounded-xl border border-border/60">
          <CalendarDays className="size-3.5 text-primary/70" />
          <span>{scheduledText}</span>
        </div>

        <div className="flex gap-1">
          <Button size="icon" variant="ghost" className="size-8.5 rounded-xl hover:bg-muted" aria-label="تعديل المهمة" onClick={updateTitle}>
            <Pencil className="size-4 text-muted-foreground hover:text-foreground" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="حذف المهمة"
            className="size-8.5 rounded-xl hover:bg-rose-500/10 hover:text-rose-600"
            disabled={remove.isPending}
            onClick={() => window.confirm("متأكد إنك عايز تمسح المهمة دي؟") && remove.mutate({ taskId: task.id })}
          >
            <Trash2 className="size-4 text-rose-500" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function CreateTask({ onDone }: { onDone: () => Promise<any> }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState(inputDate(new Date()));
  const [priority, setPriority] = useState<"urgent" | "medium" | "low">("medium");

  const mutation = trpc.tasks.create.useMutation({
    onSuccess: async () => {
      toast.success("تمت إضافة المهمة يا بطل! 🚀");
      setOpen(false);
      setTitle("");
      setDesc("");
      await onDone();
    },
    onError: (e) => toast.error(errorText(e)),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger id="task-trigger" asChild>
        <span />
      </DialogTrigger>
      <DialogContent className="text-right">
        <DialogHeader>
          <DialogTitle className="text-right text-lg font-black">إضافة مهمة جديدة 📝</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">عنوان المهمة:</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="هتنجز إيه دلوقتي؟" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">تفاصيل إضافية (اختياري):</label>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="تفاصيل المذاكرة أو الدرس..." />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 text-right">
              <label className="text-xs font-bold text-muted-foreground">التاريخ المجدول:</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5 text-right">
              <label className="text-xs font-bold text-muted-foreground">مستوى الأولوية:</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-hidden"
              >
                <option value="urgent">ضروري جداً 🔥 · +30 Coin</option>
                <option value="medium">متوسط ⚡ · +20 Coin</option>
                <option value="low">على الهادي 🍃 · +10 Coin</option>
              </select>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            disabled={!title.trim() || mutation.isPending}
            onClick={() => mutation.mutate({ title, description: desc || undefined, scheduledFor: date, priority })}
            className="rounded-xl font-bold px-6 bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
          >
            <Plus className="size-4" />
            <span>يلا ضيف المهمة</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
