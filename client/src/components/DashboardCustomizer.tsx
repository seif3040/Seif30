import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  GripVertical,
  Pin,
  PinOff,
  Plus,
  Settings2,
  Sparkles,
  Timer,
  Brain,
  Calendar,
  FolderGit2,
  Users,
  AlertTriangle,
  GitFork,
  HelpCircle,
  Mic,
  Video,
  ListChecks,
  BookOpen,
  RotateCcw,
  Check,
  ArrowUp,
  ArrowDown,
  Layers3,
  Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export interface ToolItem {
  id: string;
  title: string;
  description: string;
  icon: any;
  route: string;
  badge: string;
  gradient: string;
}

export const ALL_TOOLS: ToolItem[] = [
  {
    id: "pomodoro",
    title: "مؤقت Pomodoro الذكي",
    description: "جلسات تركيز عميقة مع فواصل استراحة وموسيقى بيئة",
    icon: Timer,
    route: "/pomodoro",
    badge: "الأكثر استخداماً",
    gradient: "from-orange-500 to-amber-600",
  },
  {
    id: "flashcards",
    title: "بطاقات الاستذكار (Flashcards)",
    description: "مراجعة تكرار متباعد واستخراج تلقائي من الـ PDF",
    icon: Layers3,
    route: "/flashcards",
    badge: "AI الذكي",
    gradient: "from-teal-500 to-emerald-600",
  },
  {
    id: "smart-calendar",
    title: "التقويم التعليمي الذكي",
    description: "مزامنة ثنائية مع Google Calendar وخارطة الطريق اليومية",
    icon: Calendar,
    route: "/smart-learning-calendar",
    badge: "Google Sync",
    gradient: "from-blue-500 to-indigo-600",
  },
  {
    id: "resource-bridge",
    title: "جسر المصادر Resource Bridge",
    description: "تجميع القنوات والملفات والتحليل الذكي بالـ AI",
    icon: FolderGit2,
    route: "/resource-bridge",
    badge: "مكتبة المصادر",
    gradient: "from-violet-500 to-purple-600",
  },
  {
    id: "focus-lounge",
    title: "صالون التركيز المشترك",
    description: "غرف دراسة جماعية تفاعلية مع طلاب آخرين وموسيقى هادئة",
    icon: Users,
    route: "/focus-lounge",
    badge: "لايف تفاعلي",
    gradient: "from-pink-500 to-rose-600",
  },
  {
    id: "mistake-lab",
    title: "معمل الأخطاء والامتحانات",
    description: "تسجيل الثغرات والأسئلة الصعبة وإعادة مراجعتها بكفاءة",
    icon: AlertTriangle,
    route: "/mistake-lab",
    badge: "تحليل الثغرات",
    gradient: "from-red-500 to-orange-600",
  },
  {
    id: "mind-map",
    title: "خرائط المفاهيم الذكية",
    description: "توليد شجري بصري مفصل للمناهج بالذكاء الاصطناعي",
    icon: GitFork,
    route: "/mind-map",
    badge: "ربط مفاهيم",
    gradient: "from-cyan-500 to-blue-600",
  },
  {
    id: "quiz-generator",
    title: "مولد الاختبارات الأكاديمية",
    description: "توليد أسئلة اختيار من متعدد مقترنة بدروسك",
    icon: HelpCircle,
    route: "/quiz-generator",
    badge: "تمارين AI",
    gradient: "from-emerald-500 to-green-600",
  },
  {
    id: "feynman-studio",
    title: "استوديو تقنية فاينمان",
    description: "اشرح المفاهيم بأسلوبك واحصل على تقييم فوري للفهم",
    icon: Mic,
    route: "/feynman-studio",
    badge: "فهم عميق",
    gradient: "from-amber-500 to-yellow-600",
  },
  {
    id: "study-video",
    title: "فيديو المذاكرة الموجه",
    description: "مشاهدة الشروحات بنظام 45/15 لمنع التشتت والملل",
    icon: Video,
    route: "/study-video",
    badge: "45/15 Focus",
    gradient: "from-sky-500 to-blue-600",
  },
  {
    id: "tasks",
    title: "جدول المهام والأولويات",
    description: "تتبع خطة اليوم والمهام العاجلة والمتوسطة",
    icon: ListChecks,
    route: "/tasks",
    badge: "إنتاجية",
    gradient: "from-indigo-500 to-violet-600",
  },
  {
    id: "notebooks",
    title: "دفاتر المذاكرة الذكية",
    description: "تدوين الملاحظات وتلخيص المحاضرات والكتب",
    icon: BookOpen,
    route: "/notebooks",
    badge: "ملاحظات",
    gradient: "from-teal-600 to-emerald-700",
  },
];

const DEFAULT_PINNED_IDS = ["pomodoro", "flashcards", "smart-calendar", "resource-bridge"];
const LOCAL_STORAGE_KEY = "seif_dashboard_pinned_tools";

export function DashboardCustomizer() {
  const [, navigate] = useLocation();
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return DEFAULT_PINNED_IDS;
  });

  const [isCustomizing, setIsCustomizing] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Sync to local storage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(pinnedIds));
    } catch {
      // storage unavailable
    }
  }, [pinnedIds]);

  const pinnedTools = pinnedIds
    .map((id) => ALL_TOOLS.find((t) => t.id === id))
    .filter(Boolean) as ToolItem[];

  const unpinnedTools = ALL_TOOLS.filter((t) => !pinnedIds.includes(t.id));

  const togglePin = useCallback((id: string) => {
    setPinnedIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) {
          toast.warning("يجب الإبقاء على أداة واحدة مثبتة على الأقل.");
          return prev;
        }
        toast.info("تم إلغاء تثبيت الأداة من الواجهة.");
        return prev.filter((item) => item !== id);
      } else {
        toast.success("تم تثبيت الأداة في أعلى اللوحة الرئيسية! 📌");
        return [...prev, id];
      }
    });
  }, []);

  const movePinnedItem = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setPinnedIds((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
  }, []);

  const handleReset = () => {
    setPinnedIds(DEFAULT_PINNED_IDS);
    toast.success("تمت إعادة ضبط ترتيب الأدوات المثبتة إلى الوضع الافتراضي.");
  };

  // Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      movePinnedItem(draggedIndex, dropIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="space-y-4">
      {/* SECTION HEADER WITH TOGGLE BUTTON */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Pin className="size-5" />
          </div>
          <div>
            <h3 className="font-black text-base text-foreground flex items-center gap-2">
              <span>أدواتك المثبتة (Pinned Tools)</span>
              {isCustomizing && (
                <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] animate-pulse">
                  وضع السحب والإفلات والتخصيص مفعل ✋
                </Badge>
              )}
            </h3>
            <p className="text-xs text-muted-foreground">
              {isCustomizing
                ? "اسحب الكروت لإعادة ترتيبها، أو اضغط زر الدبوس للثبيت وإلغاء التثبيت."
                : "وصول سريع ومباشر لأهم أدوات الدراسة والتركيز التي تستخدمها يومياً."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isCustomizing && (
            <Button
              onClick={handleReset}
              size="sm"
              variant="outline"
              className="rounded-2xl text-xs font-bold gap-1 text-muted-foreground"
            >
              <RotateCcw className="size-3.5" />
              <span>إعادة ضبط</span>
            </Button>
          )}

          <Button
            onClick={() => setIsCustomizing(!isCustomizing)}
            size="sm"
            variant={isCustomizing ? "default" : "outline"}
            className={`rounded-2xl text-xs font-bold gap-1.5 transition-all ${
              isCustomizing
                ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:opacity-90 shadow-md shadow-amber-500/20"
                : "border-primary/30 text-primary hover:bg-primary/5"
            }`}
          >
            {isCustomizing ? (
              <>
                <Check className="size-4" />
                <span>حفظ الترتيب والتخصيص</span>
              </>
            ) : (
              <>
                <Settings2 className="size-4" />
                <span>تخصيص وسحب الأدوات</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* PINNED TOOLS GRID */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {pinnedTools.map((tool, index) => {
          const Icon = tool.icon;
          const isBeingDragged = draggedIndex === index;
          const isDragTarget = dragOverIndex === index;

          return (
            <div
              key={tool.id}
              draggable={isCustomizing}
              onDragStart={(e) => isCustomizing && handleDragStart(e, index)}
              onDragOver={(e) => isCustomizing && handleDragOver(e, index)}
              onDrop={(e) => isCustomizing && handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`group relative overflow-hidden rounded-3xl border transition-all duration-300 ${
                isCustomizing
                  ? "cursor-grab active:cursor-grabbing border-amber-500/40 bg-card hover:border-amber-500 hover:shadow-lg scale-[1.01]"
                  : "cursor-pointer bg-gradient-to-br from-card via-card to-primary/5 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5"
              } ${isBeingDragged ? "opacity-30 border-dashed border-amber-500" : ""} ${
                isDragTarget ? "scale-105 border-primary ring-2 ring-primary/30" : ""
              }`}
            >
              <div
                onClick={() => {
                  if (!isCustomizing) {
                    navigate(tool.route);
                  }
                }}
                className="p-5 flex flex-col justify-between min-h-[140px]"
              >
                {/* CARD TOP BAR */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    {isCustomizing && (
                      <span className="text-amber-500 hover:text-amber-600 transition-colors cursor-grab">
                        <GripVertical className="size-5" />
                      </span>
                    )}

                    <div
                      className={`flex size-11 items-center justify-center rounded-2xl text-white shadow-md bg-gradient-to-br ${tool.gradient}`}
                    >
                      <Icon className="size-5" />
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Badge
                      variant="secondary"
                      className="text-[10px] font-extrabold bg-primary/10 text-primary border border-primary/20"
                    >
                      {tool.badge}
                    </Badge>

                    {isCustomizing ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePin(tool.id);
                        }}
                        className="p-1.5 rounded-xl text-amber-600 hover:bg-amber-500/10 transition-colors"
                        title="إلغاء التثبيت"
                      >
                        <PinOff className="size-4" />
                      </button>
                    ) : (
                      <span className="p-1 text-muted-foreground group-hover:text-primary transition-colors">
                        <Pin className="size-3.5 fill-primary/20 text-primary" />
                      </span>
                    )}
                  </div>
                </div>

                {/* CARD CONTENT */}
                <div className="mt-3">
                  <h4 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                    {tool.title}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{tool.description}</p>
                </div>

                {/* ACCESSIBLE REORDER BUTTONS FOR MOBILE IN CUSTOMIZING MODE */}
                {isCustomizing && (
                  <div className="flex items-center justify-between pt-2 mt-2 border-t text-[11px] font-bold text-amber-600">
                    <span>اسحب للنقل</span>
                    <div className="flex items-center gap-1">
                      <button
                        disabled={index === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          movePinnedItem(index, index - 1);
                        }}
                        className="p-1 rounded-lg hover:bg-muted disabled:opacity-30"
                        title="تحريك لليمين"
                      >
                        <ArrowUp className="size-3.5 rotate-90" />
                      </button>
                      <button
                        disabled={index === pinnedTools.length - 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          movePinnedItem(index, index + 1);
                        }}
                        className="p-1 rounded-lg hover:bg-muted disabled:opacity-30"
                        title="تحريك لليسار"
                      >
                        <ArrowDown className="size-3.5 rotate-90" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* MORE TOOLS LIBRARY (SHOWN IN CUSTOMIZING MODE) */}
      {isCustomizing && unpinnedTools.length > 0 && (
        <div className="surface p-5 rounded-3xl border border-dashed bg-card space-y-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="size-4 text-primary" />
              <span>أدوات إضافية متاحة للتثبيت في الأعلى ({unpinnedTools.length})</span>
            </h4>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {unpinnedTools.map((tool) => {
              const Icon = tool.icon;
              return (
                <div
                  key={tool.id}
                  onClick={() => togglePin(tool.id)}
                  className="group flex items-center justify-between p-3.5 rounded-2xl border bg-background hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex size-9 items-center justify-center rounded-xl text-white bg-gradient-to-br ${tool.gradient}`}>
                      <Icon className="size-4" />
                    </div>
                    <div>
                      <h5 className="font-bold text-xs text-foreground group-hover:text-primary transition-colors">
                        {tool.title}
                      </h5>
                      <span className="text-[10px] text-muted-foreground">{tool.badge}</span>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-xl size-8 p-0 text-primary hover:bg-primary/10"
                    title="تثبيت"
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
