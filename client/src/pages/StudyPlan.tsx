import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PageHeader, EmptyState } from "@/components/PageHeader";
import { completionToast, errorText, money } from "@/lib/study";
import { trpc } from "@/lib/trpc";
import { useRenderLogger } from "@/lib/performance";
import {
  BookOpen,

  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CirclePlus,
  GraduationCap,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Clock,
  Layers,
  Sparkles,
  MapPin,
  Compass,
  ArrowLeft,
  Calendar,
  CheckCircle,
  HelpCircle
} from "lucide-react";
import { toast } from "sonner";

export default function StudyPlan() {
  useRenderLogger("StudyPlanModule");
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.studyPlan.list.useQuery();
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | "all">("all");
  const [expandedChapters, setExpandedChapters] = useState<Record<number, boolean>>({});

  const invalidate = () =>
    Promise.all([
      utils.studyPlan.list.invalidate(),
      utils.dashboard.summary.invalidate(),
      utils.analytics.overview.invalidate(),
      utils.achievements.list.invalidate(),
    ]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-20 animate-pulse rounded-2xl bg-muted" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-24 animate-pulse rounded-2xl bg-muted" />
          <div className="h-24 animate-pulse rounded-2xl bg-muted" />
          <div className="h-24 animate-pulse rounded-2xl bg-muted" />
        </div>
        <div className="h-96 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }

  const rows = data?.rows ?? [];
  const subjectMap = new Map<number, any>();

  // Parse list rows into structured hierarchy
  rows.forEach((row: any) => {
    if (!subjectMap.has(row.subject.id)) {
      subjectMap.set(row.subject.id, {
        ...row.subject,
        chapters: new Map(),
        totalLessons: 0,
        completedLessons: 0,
        totalMinutes: 0,
      });
    }
    const subject = subjectMap.get(row.subject.id);

    if (row.chapter) {
      if (!subject.chapters.has(row.chapter.id)) {
        subject.chapters.set(row.chapter.id, {
          ...row.chapter,
          lessons: [],
        });
      }

      if (row.lesson) {
        subject.totalLessons += 1;
        subject.totalMinutes += row.lesson.estimatedMinutes || 0;
        
        const isCompleted = row.progress?.status === "completed";
        if (isCompleted) {
          subject.completedLessons += 1;
        }

        subject.chapters.get(row.chapter.id).lessons.push({
          ...row.lesson,
          progress: row.progress,
        });
      }
    }
  });

  const subjectList = Array.from(subjectMap.values());

  // Global calculation
  const totalSubjects = subjectList.length;
  const totalLessons = subjectList.reduce((acc, s) => acc + s.totalLessons, 0);
  const totalCompletedLessons = subjectList.reduce((acc, s) => acc + s.completedLessons, 0);
  const totalMinutes = subjectList.reduce((acc, s) => acc + s.totalMinutes, 0);
  const globalProgress = totalLessons > 0 ? Math.round((totalCompletedLessons / totalLessons) * 100) : 0;

  // Toggle chapter collapse
  const toggleChapter = (chapterId: number) => {
    setExpandedChapters((prev) => ({
      ...prev,
      [chapterId]: !prev[chapterId],
    }));
  };

  // Determine active subject to render
  const activeSubject = selectedSubjectId === "all" ? null : subjectList.find((s) => s.id === selectedSubjectId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="خطة المنهج والمواد 📚"
        description="نظّم فصولك ودروسك بشكل هرمي دقيق، وتتبّع تقدمك في كل مادة على حدة لتفادي التداخل وتوزيع مجهودك بذكاء! 🚀"
        action={{ label: "مادة جديدة +", onClick: () => document.getElementById("subject-trigger")?.click() }}
      />

      {/* Creation Triggers Section */}
      <div className="flex flex-wrap gap-2.5 bg-card/40 border p-3 rounded-2xl">
        <CreateSubject onDone={invalidate} />
        <CreateChapter subjects={subjectList} onDone={invalidate} />
        <CreateLesson subjects={subjectList} onDone={invalidate} />
      </div>

      {!subjectMap.size ? (
        <EmptyState
          title="ابدأ رتب موادك ومنهجك دلوقتي!"
          description="قم بإضافة أول مادة، ثم قسّمها لفصول، وضع دروسها لتنعم بمسار مذاكرة مرتب ومنظم خالٍ من التداخل."
        />
      ) : (
        <>
          {/* Dashboard Summary Statistics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="surface p-4 flex items-center gap-4">
              <div className="size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <BookOpen className="size-5.5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-bold">مجموع المواد</p>
                <p className="text-xl font-black mt-0.5">{totalSubjects}</p>
              </div>
            </div>

            <div className="surface p-4 flex items-center gap-4">
              <div className="size-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="size-5.5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-bold font-sans">الدروس المنجزة</p>
                <p className="text-xl font-black mt-0.5">
                  {totalCompletedLessons} <span className="text-xs text-muted-foreground font-normal">من {totalLessons}</span>
                </p>
              </div>
            </div>

            <div className="surface p-4 flex items-center gap-4">
              <div className="size-11 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Clock className="size-5.5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-bold">ساعات المنهج الكلية</p>
                <p className="text-xl font-black mt-0.5">
                  {Math.round(totalMinutes / 60)} <span className="text-xs text-muted-foreground font-normal">ساعة</span>
                </p>
              </div>
            </div>

            <div className="surface p-4 flex items-center gap-4">
              <div className="size-11 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Compass className="size-5.5" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground font-bold">نسبة الإنجاز العام</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-bold">{globalProgress}%</span>
                  <Progress value={globalProgress} className="h-2 flex-1" />
                </div>
              </div>
            </div>
          </div>

          {/* Subjects Navigation Tabs / Quick Cards Grid */}
          <div className="space-y-3">
            <h3 className="text-sm font-extrabold text-muted-foreground tracking-wide mr-1">تصفية وتنظيم المنهج حسب المواد:</h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {/* "All" Tab Card */}
              <button
                onClick={() => setSelectedSubjectId("all")}
                className={`text-right p-4 rounded-2xl border transition-all relative overflow-hidden ${
                  selectedSubjectId === "all"
                    ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/10 scale-[1.02]"
                    : "bg-card hover:bg-muted/40 border-border text-foreground"
                }`}
              >
                <div className="flex justify-between items-start">
                  <Layers className={`size-5 ${selectedSubjectId === "all" ? "text-primary-foreground" : "text-muted-foreground"}`} />
                  <Badge variant={selectedSubjectId === "all" ? "secondary" : "outline"} className="text-[10px] px-1.5 py-0">
                    الكل
                  </Badge>
                </div>
                <h4 className="font-extrabold text-sm mt-3">عرض كافة المواد</h4>
                <p className={`text-[10px] mt-1 ${selectedSubjectId === "all" ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                  عرض {totalLessons} درس مجمّع
                </p>
              </button>

              {/* Individual Subject Cards */}
              {subjectList.map((subject) => {
                const isSelected = selectedSubjectId === subject.id;
                const progress = subject.totalLessons > 0 ? Math.round((subject.completedLessons / subject.totalLessons) * 100) : 0;
                
                return (
                  <button
                    key={subject.id}
                    onClick={() => setSelectedSubjectId(subject.id)}
                    className={`text-right p-4 rounded-2xl border transition-all ${
                      isSelected
                        ? "bg-card border-2 shadow-lg scale-[1.02]"
                        : "bg-card hover:bg-muted/30 border-border"
                    }`}
                    style={{ borderColor: isSelected ? subject.color : undefined }}
                  >
                    <div className="flex justify-between items-start">
                      <span className="size-3.5 rounded-full" style={{ backgroundColor: subject.color }} />
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {subject.chapters.size} فصول
                      </Badge>
                    </div>

                    <h4 className="font-extrabold text-sm mt-3 truncate">{subject.title}</h4>
                    
                    <div className="mt-3 space-y-1">
                      <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                        <span>التقدم: {progress}%</span>
                        <span>{subject.completedLessons}/{subject.totalLessons}</span>
                      </div>
                      <Progress value={progress} className="h-1.5" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Curriculum Section */}
          <div className="space-y-4">
            {selectedSubjectId === "all" ? (
              // All Subjects Mode: Rendered with distinct blocks to avoid overlapping
              <div className="space-y-6">
                {subjectList.map((subject) => (
                  <SubjectBlock
                    key={subject.id}
                    subject={subject}
                    onDone={invalidate}
                    expandedChapters={expandedChapters}
                    toggleChapter={toggleChapter}
                  />
                ))}
              </div>
            ) : (
              // Single Selected Subject Mode: Roadmap Timeline Layout
              activeSubject && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="flex items-center gap-3 bg-muted/20 border p-4 rounded-2xl">
                    <span className="size-4 rounded-full animate-pulse" style={{ backgroundColor: activeSubject.color }} />
                    <div className="flex-1">
                      <h3 className="font-black text-lg">{activeSubject.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        مسار المنهج البصري المترابط • {activeSubject.chapters.size} فصول • {activeSubject.totalLessons} دروس
                      </p>
                    </div>
                    <ResourceActions kind="subject" item={activeSubject} onDone={invalidate} />
                  </div>

                  <SubjectBlock
                    subject={activeSubject}
                    onDone={invalidate}
                    expandedChapters={expandedChapters}
                    toggleChapter={toggleChapter}
                    timelineView={true}
                  />
                </div>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Subject Component Block with Option for Traditional or Timeline View
function SubjectBlock({
  subject,
  onDone,
  expandedChapters,
  toggleChapter,
  timelineView = false,
}: {
  subject: any;
  onDone: () => Promise<any>;
  expandedChapters: Record<number, boolean>;
  toggleChapter: (id: number) => void;
  timelineView?: boolean;
}) {
  const chapters = Array.from(subject.chapters.values());

  return (
    <div className="surface overflow-hidden border-2 shadow-sm rounded-3xl" style={{ borderColor: `${subject.color}15` }}>
      {/* Subject Title Header */}
      {!timelineView && (
        <div className="flex items-center gap-3 border-b bg-card/60 px-5 py-4">
          <span className="size-3.5 rounded-full" style={{ backgroundColor: subject.color }} />
          <div className="flex-1">
            <h2 className="font-black text-base">{subject.title}</h2>
            <p className="text-xs text-muted-foreground">{subject.chapters.size} فصول • {subject.totalLessons} دروس</p>
          </div>
          <Badge variant="secondary" className="gap-1 font-semibold py-0.5">
            <BookOpen className="size-3" />
            <span>مادة</span>
          </Badge>
          <ResourceActions kind="subject" item={subject} onDone={onDone} />
        </div>
      )}

      {/* Chapters Content */}
      <div className="divide-y divide-border/60">
        {chapters.map((chapter: any, index: number) => {
          const isCollapsed = expandedChapters[chapter.id] === true;
          const completedCount = chapter.lessons.filter((l: any) => l.progress?.status === "completed").length;
          const totalCount = chapter.lessons.length;
          const chapterProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

          return (
            <div key={chapter.id} className="bg-card/25">
              {/* Chapter Bar (Collapsible with progress indicator) */}
              <div
                onClick={() => toggleChapter(chapter.id)}
                className="flex items-center gap-3 bg-muted/30 hover:bg-muted/50 px-5 py-3 text-sm font-extrabold cursor-pointer transition-all select-none"
              >
                <div
                  className={`flex size-6 items-center justify-center rounded-md transition-transform ${
                    isCollapsed ? "rotate-180" : ""
                  }`}
                >
                  <ChevronDown className="size-4 text-muted-foreground" />
                </div>
                
                {/* Milestone Badge for timeline */}
                {timelineView && (
                  <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0">
                    {index + 1}
                  </div>
                )}

                <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                  <span className="text-foreground font-black">{chapter.title}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground bg-muted-foreground/10 px-2 py-0.5 rounded-full">
                      {totalCount} دروس
                    </span>
                    {totalCount > 0 && (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        منجز {completedCount}
                      </span>
                    )}
                  </div>
                </div>

                {totalCount > 0 && (
                  <div className="hidden sm:flex items-center gap-2 w-32 ml-4">
                    <span className="text-[10px] text-muted-foreground font-bold">{chapterProgress}%</span>
                    <Progress value={chapterProgress} className="h-1.5 flex-1" />
                  </div>
                )}

                {/* Stop event propagation for actions */}
                <div onClick={(e) => e.stopPropagation()}>
                  <ResourceActions kind="chapter" item={chapter} onDone={onDone} />
                </div>
              </div>

              {/* Lessons List inside Chapter */}
              {!isCollapsed && (
                <div className={`p-4 space-y-4 ${timelineView ? "pr-8 sm:pr-12 relative" : "divide-y divide-border/40"}`}>
                  
                  {/* Vertical Timeline Line for Roadmap view */}
                  {timelineView && chapter.lessons.length > 0 && (
                    <div
                      className="absolute right-[22px] sm:right-[38px] top-6 bottom-6 w-0.5 border-r-2 border-dashed"
                      style={{ borderColor: `${subject.color}40` }}
                    />
                  )}

                  {chapter.lessons.map((lesson: any, lessonIdx: number) => (
                    <LessonRow
                      key={lesson.id}
                      lesson={lesson}
                      onDone={onDone}
                      timelineView={timelineView}
                      subjectColor={subject.color}
                      isLast={lessonIdx === chapter.lessons.length - 1}
                    />
                  ))}

                  {!chapter.lessons.length && (
                    <div className="text-center py-6 text-sm text-muted-foreground">
                      لا توجد دروس مضافة في هذا الفصل بعد. اضغط على "درس +" في الأعلى لإضافتها!
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {!chapters.length && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            لا توجد فصول مضافة في هذه المادة بعد. اضغط على "+ فصل" في الأعلى للبدء!
          </div>
        )}
      </div>
    </div>
  );
}

// Lesson Component Row with Detailed Visual Timeline connector support
function LessonRow({
  lesson,
  onDone,
  timelineView = false,
  subjectColor = "#4f46e5",
  isLast = false,
}: {
  lesson: any;
  onDone: () => Promise<any>;
  timelineView?: boolean;
  subjectColor?: string;
  isLast?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  const complete = trpc.studyPlan.complete.useMutation({
    onSuccess: async (r) => {
      completionToast(r, 75);
      await onDone();
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const review = trpc.studyPlan.review.useMutation({
    onSuccess: async (r) => {
      completionToast(r, 15);
      await onDone();
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const p = lesson.progress;
  const status = p?.status ?? "not_started";

  const isCompleted = status === "completed";
  const isInProgress = status === "in_progress";

  return (
    <div
      className={`relative transition-all duration-300 ${
        timelineView
          ? "bg-card/40 border border-border/80 hover:border-border p-4 rounded-2xl mr-4"
          : "py-4 first:pt-0 last:pb-0"
      }`}
    >
      {/* Node Bullet point on the Timeline */}
      {timelineView && (
        <div
          className={`absolute right-[-24px] sm:right-[-40px] top-[26px] size-4 rounded-full border-2 z-10 flex items-center justify-center transition-all duration-300 ${
            isCompleted
              ? "bg-emerald-500 border-emerald-500 scale-110 shadow-sm"
              : isInProgress
              ? "bg-amber-500 border-amber-500 scale-105"
              : "bg-background border-muted-foreground/30"
          }`}
          style={{ borderColor: isCompleted ? undefined : isInProgress ? undefined : `${subjectColor}50` }}
        >
          {isCompleted && <span className="size-1 bg-white rounded-full" />}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {/* Progress icon */}
        <span
          className={`flex size-10 items-center justify-center rounded-xl transition-colors ${
            isCompleted ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-muted text-foreground"
          }`}
        >
          {isCompleted ? <CheckCircle className="size-5" /> : <GraduationCap className="size-5" />}
        </span>

        {/* Lesson Title and Info */}
        <div className="min-w-48 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-black text-foreground">{lesson.title}</p>
            {p?.progress !== undefined && p.progress > 0 && !isCompleted && (
              <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-500/30 text-amber-600 bg-amber-500/5">
                مكتمل بنسبة {p.progress}%
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 font-semibold">
              <Clock className="size-3" />
              <span>{money.format(lesson.estimatedMinutes)} دقيقة</span>
            </span>
            {lesson.description && (
              <>
                <span>•</span>
                <span className="truncate max-w-sm">{lesson.description}</span>
              </>
            )}
          </p>
        </div>

        {/* Badges and Actions */}
        <div className="flex items-center gap-2.5">
          <Badge
            variant={isCompleted ? "default" : "secondary"}
            className={`font-semibold py-0.5 text-xs ${
              isCompleted
                ? "bg-emerald-500 text-white"
                : isInProgress
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 border"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {isCompleted ? "مكتمل ✅" : isInProgress ? "قيد الدراسة ⏳" : "مستعد للمذاكرة 💤"}
          </Badge>

          {isCompleted ? (
            <Button
              size="sm"
              variant="outline"
              disabled={review.isPending}
              onClick={() => review.mutate({ lessonId: lesson.id })}
              className="h-9 rounded-xl text-xs gap-1 font-bold"
            >
              <RefreshCw className="size-3.5" />
              <span>مراجعة +15 🪙</span>
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={complete.isPending || busy}
              onClick={() => {
                setBusy(true);
                complete.mutate({ lessonId: lesson.id }, { onSettled: () => setBusy(false) });
              }}
              className="h-9 rounded-xl text-xs gap-1 font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
            >
              <CheckCircle2 className="size-3.5" />
              <span>أنجزت الدرس +75 🪙</span>
            </Button>
          )}

          <ResourceActions kind="lesson" item={lesson} onDone={onDone} />
        </div>
      </div>

      {/* Progress slider bar */}
      {p?.progress !== undefined && p.progress > 0 && (
        <div className="mr-13 mt-3.5">
          <Progress value={p.progress} className="h-1.5" />
        </div>
      )}
    </div>
  );
}

// Resource Actions for editing/deleting subjects, chapters, and lessons
function ResourceActions({
  kind,
  item,
  onDone,
}: {
  kind: "subject" | "chapter" | "lesson";
  item: any;
  onDone: () => Promise<any>;
}) {
  const updateSubject = trpc.studyPlan.updateSubject.useMutation({
    onSuccess: async () => {
      toast.success("تم تحديث المادة بنجاح.");
      await onDone();
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const updateChapter = trpc.studyPlan.updateChapter.useMutation({
    onSuccess: async () => {
      toast.success("تم تحديث الفصل بنجاح.");
      await onDone();
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const updateLesson = trpc.studyPlan.updateLesson.useMutation({
    onSuccess: async () => {
      toast.success("تم تحديث الدرس بنجاح.");
      await onDone();
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const deleteSubject = trpc.studyPlan.deleteSubject.useMutation({
    onSuccess: async () => {
      toast.success("تم حذف المادة بنجاح.");
      await onDone();
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const deleteChapter = trpc.studyPlan.deleteChapter.useMutation({
    onSuccess: async () => {
      toast.success("تم حذف الفصل بنجاح.");
      await onDone();
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const deleteLesson = trpc.studyPlan.deleteLesson.useMutation({
    onSuccess: async () => {
      toast.success("تم حذف الدرس بنجاح.");
      await onDone();
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const edit = () => {
    const title = window.prompt("اكتب العنوان الجديد:", item.title);
    if (!title?.trim()) return;
    if (kind === "subject") updateSubject.mutate({ subjectId: item.id, title, color: item.color });
    if (kind === "chapter") updateChapter.mutate({ chapterId: item.id, title });
    if (kind === "lesson")
      updateLesson.mutate({
        lessonId: item.id,
        title,
        description: item.description ?? undefined,
        estimatedMinutes: item.estimatedMinutes,
        notes: item.notes ?? undefined,
      });
  };

  const remove = () => {
    if (!window.confirm("سيتم حذف هذا العنصر وكل ما يرتبط به من السحابة. هل تريد المتابعة؟")) return;
    if (kind === "subject") deleteSubject.mutate({ subjectId: item.id });
    if (kind === "chapter") deleteChapter.mutate({ chapterId: item.id });
    if (kind === "lesson") deleteLesson.mutate({ lessonId: item.id });
  };

  return (
    <span className="flex gap-1">
      <Button size="icon" variant="ghost" className="size-7 rounded-lg" aria-label="تعديل" onClick={edit}>
        <Pencil className="size-3.5 text-muted-foreground hover:text-foreground" />
      </Button>
      <Button size="icon" variant="ghost" className="size-7 rounded-lg" aria-label="حذف" onClick={remove}>
        <Trash2 className="size-3.5 text-rose-500 hover:text-rose-600" />
      </Button>
    </span>
  );
}

// Dialog for creating a new Subject
function CreateSubject({ onDone }: { onDone: () => Promise<any> }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const mutation = trpc.studyPlan.createSubject.useMutation({
    onSuccess: async () => {
      toast.success("تمت إضافة المادة.");
      setOpen(false);
      setTitle("");
      await onDone();
    },
    onError: (e) => toast.error(errorText(e)),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger id="subject-trigger" asChild>
        <Button className="h-10 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
          <Plus className="size-4" />
          <span>مادة جديدة</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="text-right">
        <DialogHeader>
          <DialogTitle className="text-right text-lg font-black">إضافة مادة دراسية جديدة</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-3">
          <p className="text-xs text-muted-foreground">أدخل اسم المادة لإضافتها إلى منهجك الدراسي:</p>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: الرياضيات، الفيزياء، اللغة العربية" />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            disabled={!title.trim() || mutation.isPending}
            onClick={() => mutation.mutate({ title })}
            className="rounded-xl font-bold px-6 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            حفظ المادة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Dialog for creating a new Chapter
function CreateChapter({ subjects, onDone }: { subjects: any[]; onDone: () => Promise<any> }) {
  const [open, setOpen] = useState(false);
  const [subjectId, setSubjectId] = useState("");
  const [title, setTitle] = useState("");

  const mutation = trpc.studyPlan.createChapter.useMutation({
    onSuccess: async () => {
      toast.success("تمت إضافة الفصل بنجاح.");
      setOpen(false);
      setTitle("");
      await onDone();
    },
    onError: (e) => toast.error(errorText(e)),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={!subjects.length} className="h-10 rounded-xl font-bold gap-2">
          <CirclePlus className="size-4" />
          <span>فصل دراسي</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="text-right">
        <DialogHeader>
          <DialogTitle className="text-right text-lg font-black">إضافة فصل دراسي جديد</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">المادة التابع لها الفصل:</label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-hidden"
            >
              <option value="">اختر المادة</option>
              {subjects.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.title}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">اسم الفصل:</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: الباب الأول، الفصل الأول" />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            disabled={!subjectId || !title.trim() || mutation.isPending}
            onClick={() => mutation.mutate({ subjectId: Number(subjectId), title })}
            className="rounded-xl font-bold px-6 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            حفظ الفصل
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Dialog for creating a new Lesson
function CreateLesson({ subjects, onDone }: { subjects: any[]; onDone: () => Promise<any> }) {
  const chapters = subjects.flatMap((s) =>
    Array.from(s.chapters.values()).map((c: any) => ({ ...c, subject: s.title }))
  );
  const [open, setOpen] = useState(false);
  const [chapterId, setChapterId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [minutes, setMinutes] = useState("30");

  const mutation = trpc.studyPlan.createLesson.useMutation({
    onSuccess: async () => {
      toast.success("تمت إضافة الدرس بنجاح.");
      setOpen(false);
      setTitle("");
      setDescription("");
      await onDone();
    },
    onError: (e) => toast.error(errorText(e)),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={!chapters.length} className="h-10 rounded-xl font-bold gap-2">
          <CirclePlus className="size-4" />
          <span>درس جديد</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="text-right">
        <DialogHeader>
          <DialogTitle className="text-right text-lg font-black">إضافة درس جديد</DialogTitle>
        </DialogHeader>
        <div className="space-y-3.5 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">الفصل التابع له الدرس:</label>
            <select
              value={chapterId}
              onChange={(e) => setChapterId(e.target.value)}
              className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-hidden"
            >
              <option value="">اختر الفصل</option>
              {chapters.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.subject} — {x.title}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">عنوان الدرس:</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان الدرس الدراسي" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">وصف قصير أو أهداف الدرس:</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="وصف مقتضب للدرس (اختياري)" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">المدة المقدرة للمذاكرة (بالدقائق):</label>
            <Input type="number" min="5" value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="مثال: 30، 45، 60" />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            disabled={!chapterId || !title.trim() || mutation.isPending}
            onClick={() =>
              mutation.mutate({
                chapterId: Number(chapterId),
                title,
                description: description || undefined,
                estimatedMinutes: Number(minutes) || 30,
              })
            }
            className="rounded-xl font-bold px-6 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            حفظ الدرس
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
