import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SmartFocusTimer } from "@/components/SmartFocusTimer";
import {
  Link2,
  Sparkles,
  ExternalLink,
  Clock,
  Bookmark,
  CheckCircle2,
  Plus,
  Trash2,
  GraduationCap,
  PlayCircle,
  Award,
  Layers,
  BookOpen,
  Laptop,
  Video,
  Brain,
  Globe,
  BarChart3,
  Filter,
  CheckCircle,
  Play,
  TrendingUp,
  History,
  Timer,
  Coins,
  Calendar,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { SharedStudyRoomsSection } from "@/components/SharedStudyRoomsSection";
import { PdfResourceManager } from "@/components/PdfResourceManager";
import { FileText } from "lucide-react";

const PLATFORMS = [
  {
    id: "Udemy",
    name: "Udemy",
    icon: Laptop,
    color: "border-purple-500/40 bg-purple-500/10 text-purple-600 dark:text-purple-300",
    badgeBg: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
    domainKeyword: "udemy",
  },
  {
    id: "Coursera",
    name: "Coursera",
    icon: GraduationCap,
    color: "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-300",
    badgeBg: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
    domainKeyword: "coursera",
  },
  {
    id: "YouTube",
    name: "YouTube",
    icon: Video,
    color: "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-300",
    badgeBg: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
    domainKeyword: "youtube",
  },
  {
    id: "Abwab",
    name: "منصة أبواب",
    icon: BookOpen,
    color: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300",
    badgeBg: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    domainKeyword: "abwab",
  },
  {
    id: "Edvanya",
    name: "إد فانيا",
    icon: Sparkles,
    color: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    badgeBg: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    domainKeyword: "edvanya",
  },
  {
    id: "Khan Academy",
    name: "Khan Academy",
    icon: Brain,
    color: "border-teal-500/40 bg-teal-500/10 text-teal-600 dark:text-teal-300",
    badgeBg: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
    domainKeyword: "khanacademy",
  },
  {
    id: "منصة خاصة",
    name: "منصة مدرس خاصة",
    icon: Globe,
    color: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-300",
    badgeBg: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
    domainKeyword: "",
  },
];

export default function ResourceBridge() {
  const [activeMainTab, setActiveMainTab] = useState<"personal" | "rooms" | "pdfs">("personal");
  const [showSmartTimer, setShowSmartTimer] = useState<boolean>(false);
  const [timerResourceId, setTimerResourceId] = useState<number | undefined>(undefined);
  const [url, setUrl] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [totalMinutes, setTotalMinutes] = useState<number | "">(60);
  const [platform, setPlatform] = useState("Udemy");
  const [isAdding, setIsAdding] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "in_progress" | "completed">("all");

  // Bookmark form states per resource
  const [activeBookmarkResId, setActiveBookmarkResId] = useState<number | null>(null);
  const [bmTimestamp, setBmTimestamp] = useState("");
  const [bmTitle, setBmTitle] = useState("");
  const [bmNote, setBmNote] = useState("");

  // Focus Session log form state
  const [activeLogResId, setActiveLogResId] = useState<number | null>(null);
  const [logMins, setLogMins] = useState<number | "">(30);
  const [logNotes, setLogNotes] = useState("");

  const utils = trpc.useContext();
  const { data: resources, isLoading } = trpc.resourceBridge.list.useQuery();
  const { data: focusSessions } = trpc.resourceBridge.listFocusSessions.useQuery();

  const addMutation = trpc.resourceBridge.addAI.useMutation({
    onSuccess: (data) => {
      utils.resourceBridge.list.invalidate();
      setIsAdding(false);
      resetForm();
      toast.success(`تم ربط المصدر بنجاح! المنصة: ${data.platform} (+20 Coins)`);
    },
    onError: (e) => toast.error(e.message || "حدث خطأ أثناء تحليل وربط الرابط."),
  });

  const updateProgressMutation = trpc.resourceBridge.updateProgress.useMutation({
    onSuccess: () => {
      utils.resourceBridge.list.invalidate();
      toast.success("تم تحديث نسبة الإنجاز والوقت المنقضي!");
    },
  });

  const deleteMutation = trpc.resourceBridge.delete.useMutation({
    onSuccess: () => {
      utils.resourceBridge.list.invalidate();
      toast.success("تم حذف المصدر.");
    },
  });

  const addBookmarkMutation = trpc.resourceBridge.addBookmark.useMutation({
    onSuccess: () => {
      utils.resourceBridge.list.invalidate();
      setActiveBookmarkResId(null);
      setBmTimestamp("");
      setBmTitle("");
      setBmNote("");
      toast.success("تم حفظ العلامة المرجعية للنقطة الهامة!");
    },
  });

  const deleteBookmarkMutation = trpc.resourceBridge.deleteBookmark.useMutation({
    onSuccess: () => {
      utils.resourceBridge.list.invalidate();
      toast.success("تم حذف العلامة المرجعية.");
    },
  });

  const logFocusSessionMutation = trpc.resourceBridge.logFocusSession.useMutation({
    onSuccess: (data) => {
      utils.resourceBridge.list.invalidate();
      utils.resourceBridge.listFocusSessions.invalidate();
      setActiveLogResId(null);
      setLogMins(30);
      setLogNotes("");
      toast.success(`تم تسجيل جلسة المذاكرة بنجاح! +${data.earnedCoins} Coins`);
    },
  });

  const resetForm = () => {
    setUrl("");
    setCustomTitle("");
    setSubject("");
    setTotalMinutes(60);
    setPlatform("Udemy");
  };

  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl);
    const lower = newUrl.toLowerCase();
    const matched = PLATFORMS.find((p) => p.domainKeyword && lower.includes(p.domainKeyword));
    if (matched) {
      setPlatform(matched.id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      toast.error("يرجى إدخال رابط الكورس أو الفيديو أولاً.");
      return;
    }
    addMutation.mutate({
      url,
      customTitle,
      subject,
      totalMinutes: Number(totalMinutes) || 60,
      platform,
    });
  };

  const handleBookmarkSubmit = (e: React.FormEvent, resId: number) => {
    e.preventDefault();
    if (!bmTimestamp.trim() || !bmTitle.trim()) {
      toast.error("يرجى كتابة التوقيت والعنوان الفرعي.");
      return;
    }
    addBookmarkMutation.mutate({
      resourceId: resId,
      timestampStr: bmTimestamp,
      title: bmTitle,
      note: bmNote,
    });
  };

  const handleLogFocusSubmit = (e: React.FormEvent, resId: number) => {
    e.preventDefault();
    const mins = Number(logMins);
    if (!mins || mins <= 0) {
      toast.error("يرجى إدخال مدة جلسة المذاكرة بالدقائق.");
      return;
    }
    logFocusSessionMutation.mutate({
      resourceId: resId,
      durationMinutes: mins,
      sessionNotes: logNotes,
    });
  };

  const getPlatformMeta = (platName: string) => {
    const found = PLATFORMS.find((p) => p.id.toLowerCase() === platName?.toLowerCase() || p.name.toLowerCase() === platName?.toLowerCase());
    return (
      found || {
        id: platName,
        name: platName || "منصة تعليمية",
        icon: Globe,
        color: "border-border bg-muted text-foreground",
        badgeBg: "bg-primary/10 text-primary border-primary/20",
      }
    );
  };

  // Dashboard Aggregated Metrics
  const dashboardStats = useMemo(() => {
    if (!resources || resources.length === 0) {
      return {
        totalCourses: 0,
        completedCourses: 0,
        inProgressCourses: 0,
        totalCompletedMinutes: 0,
        totalTotalMinutes: 0,
        overallPercent: 0,
        completedHours: "0",
        totalHours: "0",
        platformBreakdown: [],
      };
    }

    const totalCourses = resources.length;
    const completedCourses = resources.filter((r: any) => r.status === "completed").length;
    const inProgressCourses = resources.filter((r: any) => r.status === "in_progress").length;

    const totalCompletedMinutes = resources.reduce((acc: number, r: any) => acc + (r.completedMinutes || 0), 0);
    const totalTotalMinutes = resources.reduce((acc: number, r: any) => acc + (r.totalMinutes || 60), 0);

    const overallPercent = totalTotalMinutes > 0 ? Math.min(100, Math.round((totalCompletedMinutes / totalTotalMinutes) * 100)) : 0;

    const platformMap: Record<string, number> = {};
    resources.forEach((r: any) => {
      const pName = r.platform || "منصة أخرى";
      platformMap[pName] = (platformMap[pName] || 0) + 1;
    });

    const platformBreakdown = Object.entries(platformMap).map(([plat, count]) => ({
      platform: plat,
      count,
    }));

    return {
      totalCourses,
      completedCourses,
      inProgressCourses,
      totalCompletedMinutes,
      totalTotalMinutes,
      overallPercent,
      completedHours: (totalCompletedMinutes / 60).toFixed(1),
      totalHours: (totalTotalMinutes / 60).toFixed(1),
      platformBreakdown,
    };
  }, [resources]);

  // Total Focus Study Time per Platform
  const platformStudyTimeMap = useMemo(() => {
    if (!focusSessions || focusSessions.length === 0) return {};
    const map: Record<string, number> = {};
    focusSessions.forEach((s: any) => {
      const plat = s.platform || "منصة خاصة";
      map[plat] = (map[plat] || 0) + (s.durationMinutes || 0);
    });
    return map;
  }, [focusSessions]);

  // Filtered resources based on tab
  const filteredResources = useMemo(() => {
    if (!resources) return [];
    if (statusFilter === "completed") return resources.filter((r: any) => r.status === "completed");
    if (statusFilter === "in_progress") return resources.filter((r: any) => r.status === "in_progress");
    return resources;
  }, [resources, statusFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="جسر المصادر التعليمية الخارجية (Resource Bridge)"
        description="لوحة تتبع ودراسة الكورسات الخارجية (Udemy, Coursera, Abwab, YouTube, Khan Academy) مع نظام غرف المذاكرة الجماعية ومتابعة تقدم الأصدقاء."
      />

      {/* MAIN TOP TABS SWITCHER */}
      <div className="flex flex-wrap items-center gap-2 border-b pb-3">
        <button
          onClick={() => setActiveMainTab("personal")}
          className={`px-5 py-2.5 rounded-2xl font-extrabold text-xs transition-all flex items-center gap-2 ${
            activeMainTab === "personal"
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
              : "bg-muted/60 text-muted-foreground hover:bg-muted"
          }`}
        >
          <BookOpen className="size-4" />
          <span>مصادري ودوراتي الشخصية</span>
        </button>

        <button
          onClick={() => setActiveMainTab("rooms")}
          className={`px-5 py-2.5 rounded-2xl font-extrabold text-xs transition-all flex items-center gap-2 ${
            activeMainTab === "rooms"
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
              : "bg-muted/60 text-muted-foreground hover:bg-muted"
          }`}
        >
          <Users className="size-4" />
          <span>غرف المذاكرة الجماعية مع الأصدقاء (Shared Study Rooms)</span>
        </button>

        <button
          onClick={() => setActiveMainTab("pdfs")}
          className={`px-5 py-2.5 rounded-2xl font-extrabold text-xs transition-all flex items-center gap-2 ${
            activeMainTab === "pdfs"
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
              : "bg-muted/60 text-muted-foreground hover:bg-muted"
          }`}
        >
          <FileText className="size-4 text-emerald-500 dark:text-emerald-400" />
          <span>تفريغات وملفات PDF الدراسية (PDF Text & AI Summarizer)</span>
        </button>
      </div>

      {activeMainTab === "rooms" ? (
        <SharedStudyRoomsSection />
      ) : activeMainTab === "pdfs" ? (
        <PdfResourceManager />
      ) : (
        <>
          {/* RESOURCE DASHBOARD OVERVIEW CARD */}
      <div className="surface p-6 rounded-3xl border space-y-5 bg-gradient-to-br from-card via-card to-primary/5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <BarChart3 className="size-6" />
            </div>
            <div>
              <h2 className="font-extrabold text-lg">لوحة تتبع المصادر الكلية (Resource Dashboard)</h2>
              <p className="text-xs text-muted-foreground">ملخص نسبة الإنجاز والساعات الدراسية المكتملة عبر جميع المنصات الخارجية</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                setShowSmartTimer(!showSmartTimer);
              }}
              variant={showSmartTimer ? "default" : "outline"}
              className={`gap-2 rounded-2xl font-extrabold text-xs shadow-sm ${
                showSmartTimer ? "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20" : "border-primary/40 text-primary"
              }`}
            >
              <Timer className="size-4 animate-pulse" />
              <span>{showSmartTimer ? "إخفاء المؤقت" : "⚡ مؤقت التركيز الذكي (Focus Timer)"}</span>
            </Button>

            <Button onClick={() => setIsAdding(!isAdding)} className="gap-2 rounded-2xl font-bold shadow-md shadow-primary/20 text-xs">
              <Plus className="size-4" />
              <span>{isAdding ? "إلغاء النافذة" : "ربط مصدر جديد (+20 Coins)"}</span>
            </Button>
          </div>
        </div>

        {/* Global Macro Progress Bar */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-sm font-bold">
            <span className="flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" /> نسبة إنجاز المصادر الكلية:
            </span>
            <span className="text-primary font-extrabold text-base">{dashboardStats.overallPercent}%</span>
          </div>

          <div className="w-full bg-muted/80 h-4 rounded-full overflow-hidden p-0.5 border">
            <div
              className="h-full bg-gradient-to-r from-primary via-indigo-500 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${dashboardStats.overallPercent}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground font-semibold pt-1">
            <span>⏱️ الساعات الدراسية المكتملة: <strong className="text-foreground">{dashboardStats.completedHours}</strong> من أصل <strong className="text-foreground">{dashboardStats.totalHours} ساعة</strong></span>
            <span>📚 الدقائق المنجزة: <strong className="text-primary">{dashboardStats.totalCompletedMinutes}</strong> / {dashboardStats.totalTotalMinutes} دقيقة</span>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="p-3.5 rounded-2xl border bg-card/60 space-y-1">
            <span className="text-xs text-muted-foreground font-bold">إجمالي الكورسات</span>
            <div className="text-xl font-extrabold text-foreground">{dashboardStats.totalCourses} دورة</div>
          </div>

          <div className="p-3.5 rounded-2xl border bg-card/60 space-y-1">
            <span className="text-xs text-muted-foreground font-bold text-emerald-600 dark:text-emerald-400">دورات مكتملة</span>
            <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{dashboardStats.completedCourses} مكتملة</div>
          </div>

          <div className="p-3.5 rounded-2xl border bg-card/60 space-y-1">
            <span className="text-xs text-muted-foreground font-bold text-amber-600 dark:text-amber-400">قيد المتابعة</span>
            <div className="text-xl font-extrabold text-amber-600 dark:text-amber-400">{dashboardStats.inProgressCourses} جارية</div>
          </div>

          <div className="p-3.5 rounded-2xl border bg-card/60 space-y-1">
            <span className="text-xs text-muted-foreground font-bold">توزيع المنصات</span>
            <div className="flex flex-wrap gap-1 pt-0.5">
              {dashboardStats.platformBreakdown.length > 0 ? (
                dashboardStats.platformBreakdown.slice(0, 3).map((p) => (
                  <span key={p.platform} className="text-[10px] font-extrabold bg-primary/10 text-primary px-1.5 py-0.5 rounded-md">
                    {p.platform}: {p.count}
                  </span>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">لا توجد مصادر بعد</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* FOCUS HISTORY & TIME PER PLATFORM SECTION */}
      <div className="surface p-6 rounded-3xl border space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <History className="size-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base">سجل جلسات المذاكرة والوقت الكلي حسب المنصة (Focus History)</h3>
              <p className="text-xs text-muted-foreground">تتبع وسجل جلسات مشاهدة ومذاكرة الكورسات الخارجية للحصول على عملات ذهبية تلقائية</p>
            </div>
          </div>
        </div>

        {/* Study Time per Platform Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {PLATFORMS.map((p) => {
            const mins = platformStudyTimeMap[p.id] || 0;
            const hrs = (mins / 60).toFixed(1);
            const Icon = p.icon;

            return (
              <div key={p.id} className="p-3 rounded-2xl border bg-card/70 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                  <Icon className="size-3.5 text-primary" />
                  <span className="truncate">{p.name}</span>
                </div>
                <div className="text-base font-extrabold text-foreground">{hrs} س</div>
                <div className="text-[10px] text-muted-foreground">{mins} دقيقة</div>
              </div>
            );
          })}
        </div>

        {/* Recent Focus Log List */}
        {focusSessions && focusSessions.length > 0 ? (
          <div className="space-y-2 pt-2 border-t">
            <h4 className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <Timer className="size-3.5 text-primary" /> أحدث الجلسات المسجلة ({focusSessions.length}):
            </h4>
            <div className="grid gap-2 max-h-48 overflow-y-auto pr-1">
              {focusSessions.slice(0, 6).map((s: any) => {
                const platMeta = getPlatformMeta(s.platform);
                const PlatIcon = platMeta.icon;

                return (
                  <div key={s.id} className="p-3 rounded-2xl border bg-card/60 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`p-1.5 rounded-xl border ${platMeta.badgeBg}`}>
                        <PlatIcon className="size-3.5" />
                      </div>
                      <div className="truncate space-y-0.5">
                        <div className="font-bold text-foreground truncate">{s.resourceTitle}</div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                          <span>{s.platform}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="size-3" /> {new Date(s.createdAt).toLocaleDateString("ar-EG")}
                          </span>
                          {s.sessionNotes && <span className="truncate max-w-[200px]">({s.sessionNotes})</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 font-extrabold">
                      <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-xl">⏱️ {s.durationMinutes} دقيقة</span>
                      <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-1 rounded-xl flex items-center gap-1">
                        <Coins className="size-3" /> +{Math.max(10, Math.round(s.durationMinutes * 1.5))}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2">لم تقم بتسجيل أي جلسة تركيز بعد. اضغط "+ تسجيل جلسة" على أي بطاقة كورس بالأسفل!</p>
        )}
      </div>

      {/* SMART FOCUS TIMER COMPONENT */}
      {showSmartTimer && (
        <SmartFocusTimer
          initialResourceId={timerResourceId}
          isOpen={showSmartTimer}
          onClose={() => setShowSmartTimer(false)}
        />
      )}

      {/* Add Resource Form */}
      {isAdding && (
        <form onSubmit={handleSubmit} className="surface p-6 rounded-3xl border border-primary/30 space-y-5 animate-in fade-in">
          <h3 className="font-bold text-base flex items-center gap-2 text-primary border-b pb-3">
            <Sparkles className="size-5" /> تحليل وربط مصدر جديد بالذكاء الاصطناعي
          </h3>

          {/* VISUAL PLATFORM SELECTOR GRID */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground block">
              1. اختر المنصة المستضيفة للكورس / الدورة (Platform Selector):
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
              {PLATFORMS.map((p) => {
                const isSelected = platform === p.id;
                const Icon = p.icon;

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlatform(p.id)}
                    className={`p-3 rounded-2xl border text-center flex flex-col items-center justify-center gap-2 transition-all ${
                      isSelected
                        ? `${p.color} ring-2 ring-primary border-transparent shadow-md font-bold scale-[1.02]`
                        : "border-border/80 bg-card hover:bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    <Icon className="size-5" />
                    <span className="text-xs leading-none">{p.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">2. رابط الكورس أو المحاضرة الخارجية *</label>
              <Input
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder={`رابط كورس ${platform}... (سيحدد AI المنصة تلقائياً عند للصق)`}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1 block">عنوان الكورس (اختياري)</label>
                <Input
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="سيستخرجه AI تلقائياً إن تركته فارغاً"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1 block">المادة الدراسية</label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="مثال: برمجيات، فيزياء، كيمياء" />
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1 block">إجمالي وقت الكورس (بالدقائق)</label>
                <Input
                  type="number"
                  value={totalMinutes}
                  onChange={(e) => setTotalMinutes(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="60"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => setIsAdding(false)}>
              إلغاء
            </Button>

            <Button type="submit" disabled={addMutation.isPending} className="font-bold gap-2">
              <Sparkles className="size-4" />
              <span>{addMutation.isPending ? "جارٍ التحليل والربط..." : "حفظ المصدر وبدء التتبع"}</span>
            </Button>
          </div>
        </form>
      )}

      {/* Filter Tabs Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <h3 className="font-extrabold text-base flex items-center gap-2">
          <Layers className="size-5 text-primary" /> قائمة الكورسات والمصادر المربوطة ({filteredResources.length})
        </h3>

        <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-2xl border text-xs font-bold">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-xl transition-all ${statusFilter === "all" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            الكل ({resources?.length || 0})
          </button>
          <button
            onClick={() => setStatusFilter("in_progress")}
            className={`px-3 py-1.5 rounded-xl transition-all ${statusFilter === "in_progress" ? "bg-card text-amber-600 dark:text-amber-400 shadow-sm" : "text-muted-foreground"}`}
          >
            قيد المتابعة ({dashboardStats.inProgressCourses})
          </button>
          <button
            onClick={() => setStatusFilter("completed")}
            className={`px-3 py-1.5 rounded-xl transition-all ${statusFilter === "completed" ? "bg-card text-emerald-600 dark:text-emerald-400 shadow-sm" : "text-muted-foreground"}`}
          >
            مكتملة ({dashboardStats.completedCourses})
          </button>
        </div>
      </div>

      {/* Resources List */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-3xl bg-muted" />
          ))}
        </div>
      ) : filteredResources && filteredResources.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          {filteredResources.map((res: any) => {
            const isCompleted = res.status === "completed";
            const platMeta = getPlatformMeta(res.platform);
            const PlatIcon = platMeta.icon;

            return (
              <div
                key={res.id}
                className={`surface p-6 rounded-3xl border space-y-4 transition-all hover:border-primary/40 ${
                  isCompleted ? "border-emerald-500/30 opacity-90" : ""
                }`}
              >
                {/* Header info */}
                <div className="flex items-start justify-between gap-3 border-b pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${platMeta.badgeBg}`}>
                        <PlatIcon className="size-3" /> {res.platform}
                      </span>
                      <span className="text-xs font-bold text-muted-foreground">{res.subject}</span>
                    </div>
                    <h3 className="font-bold text-base leading-6">{res.title}</h3>
                  </div>

                  <a href={res.url} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="secondary" className="rounded-xl font-bold gap-1 text-xs shrink-0">
                      <ExternalLink className="size-3.5" /> فتح المنصة
                    </Button>
                  </a>
                </div>

                {/* Progress bar and time slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3.5 text-primary" /> التقدم: {res.completedMinutes} / {res.totalMinutes} دقيقة
                    </span>
                    <span className="text-primary font-extrabold">{res.progressPercent}%</span>
                  </div>

                  <div className="w-full bg-muted h-2.5 rounded-full overflow-hidden border p-0.5">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        isCompleted ? "bg-emerald-500" : "bg-primary"
                      }`}
                      style={{ width: `${res.progressPercent}%` }}
                    />
                  </div>

                  {/* Progress Quick Update */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={res.totalMinutes}
                        defaultValue={res.completedMinutes}
                        onBlur={(e) => {
                          const val = Number(e.target.value);
                          if (val !== res.completedMinutes) {
                            updateProgressMutation.mutate({ resourceId: res.id, completedMinutes: val });
                          }
                        }}
                        className="h-8 text-xs font-bold w-24 rounded-xl"
                      />
                      <span className="text-xs text-muted-foreground">دقيقة مكتملة</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        onClick={() => {
                          setTimerResourceId(res.id);
                          setShowSmartTimer(true);
                          window.scrollTo({ top: 300, behavior: "smooth" });
                        }}
                        className="h-8 text-xs font-bold gap-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
                      >
                        <Timer className="size-3.5" /> ⚡ بدء مؤقت التركيز
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setActiveLogResId(activeLogResId === res.id ? null : res.id)}
                        className="h-8 text-xs font-bold gap-1 rounded-xl text-primary border-primary/30"
                      >
                        <Plus className="size-3.5" /> تسجيل عادي
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setActiveMainTab("pdfs");
                          window.scrollTo({ top: 100, behavior: "smooth" });
                        }}
                        className="h-8 text-xs font-bold gap-1 rounded-xl text-emerald-600 border-emerald-500/30 dark:text-emerald-400"
                      >
                        <FileText className="size-3.5" /> تفريغات PDF
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Log Focus Session Form Modal/Card */}
                {activeLogResId === res.id && (
                  <form onSubmit={(e) => handleLogFocusSubmit(e, res.id)} className="p-3.5 rounded-2xl border bg-card space-y-2.5 animate-in fade-in">
                    <div className="flex items-center justify-between text-xs font-bold text-primary">
                      <span>تسجيل جلسة مذاكرة ومتابعة لـ {res.platform}</span>
                      <span>كسب +{Math.max(10, Math.round((Number(logMins) || 30) * 1.5))} Coins</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-0.5">المدة (دقائق)</label>
                        <Input
                          type="number"
                          value={logMins}
                          onChange={(e) => setLogMins(e.target.value === "" ? "" : Number(e.target.value))}
                          placeholder="30"
                          className="h-8 text-xs font-bold"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] text-muted-foreground block mb-0.5">ملاحظات الجلسة (اختياري)</label>
                        <Input
                          value={logNotes}
                          onChange={(e) => setLogNotes(e.target.value)}
                          placeholder="مثال: أنهيت الشابتر الثاني وحللت الشيت"
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setActiveLogResId(null)} className="h-7 text-xs">
                        إلغاء
                      </Button>
                      <Button type="submit" size="sm" disabled={logFocusSessionMutation.isPending} className="h-7 text-xs font-bold gap-1">
                        <Timer className="size-3" /> حفظ ودراسة
                      </Button>
                    </div>
                  </form>
                )}

                {res.notes && <p className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-xl leading-5">{res.notes}</p>}

                {/* Timestamps / Bookmarks Section */}
                <div className="space-y-2 border-t pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold flex items-center gap-1">
                      <Bookmark className="size-3.5 text-amber-500" /> العلامات المرجعية والتوقيتات المهمة ({res.bookmarks?.length || 0})
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setActiveBookmarkResId(activeBookmarkResId === res.id ? null : res.id)}
                      className="text-xs h-7 rounded-lg text-primary font-bold"
                    >
                      + إضافة توقيت
                    </Button>
                  </div>

                  {activeBookmarkResId === res.id && (
                    <form onSubmit={(e) => handleBookmarkSubmit(e, res.id)} className="p-3 rounded-xl border bg-card space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        <Input
                          value={bmTimestamp}
                          onChange={(e) => setBmTimestamp(e.target.value)}
                          placeholder="مثال 12:45"
                          className="h-8 text-xs font-mono font-bold"
                        />
                        <Input
                          value={bmTitle}
                          onChange={(e) => setBmTitle(e.target.value)}
                          placeholder="عنوان النقطة"
                          className="h-8 text-xs col-span-2"
                        />
                      </div>
                      <Input
                        value={bmNote}
                        onChange={(e) => setBmNote(e.target.value)}
                        placeholder="ملاحظات توضيحية (اختياري)"
                        className="h-8 text-xs"
                      />
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" size="sm" onClick={() => setActiveBookmarkResId(null)} className="h-7 text-xs">
                          إلغاء
                        </Button>
                        <Button type="submit" size="sm" className="h-7 text-xs font-bold">
                          حفظ التوقيت
                        </Button>
                      </div>
                    </form>
                  )}

                  {/* Bookmarks List */}
                  {res.bookmarks && res.bookmarks.length > 0 ? (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {res.bookmarks.map((bm: any) => (
                        <div key={bm.id} className="p-2 rounded-xl bg-muted/50 border text-xs flex items-start justify-between gap-2">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-extrabold text-primary bg-primary/10 px-1.5 py-0.5 rounded-md text-[11px]">
                                ⏱️ {bm.timestampStr}
                              </span>
                              <strong className="text-foreground">{bm.title}</strong>
                            </div>
                            {bm.note && <p className="text-muted-foreground text-[11px] leading-4">{bm.note}</p>}
                          </div>

                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteBookmarkMutation.mutate({ bookmarkId: bm.id })}
                            className="size-6 text-destructive"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">لا توجد توقيتات محفوظة بعد لهذا المصدر.</p>
                  )}
                </div>

                {/* Footer Action */}
                <div className="flex justify-end border-t pt-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate({ resourceId: res.id })}
                    className="size-8 text-destructive rounded-xl"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="surface p-12 rounded-3xl border border-dashed border-border text-center space-y-3">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <GraduationCap className="size-7" />
          </div>
          <h3 className="font-bold text-base">لا توجد مصادر تعليمية مطابقة في هذه الفئة</h3>
          <p className="text-xs text-muted-foreground leading-5 max-w-md mx-auto">
            انقر فوق "ربط مصدر جديد" بالأعلى لإضافة كورسات جديدة من المنصات الخارجية وتتبع تقدمها بالكامل!
          </p>
        </div>
      )}
        </>
      )}
    </div>
  );
}
