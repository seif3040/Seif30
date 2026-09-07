import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Calendar as CalendarIcon,
  Sparkles,
  Clock,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  ExternalLink,
  BookOpen,
  Laptop,
  CheckSquare,
  Timer,
  BarChart3,
  ChevronRight,
  ChevronLeft,
  CalendarDays,
  ListOrdered,
  Zap,
  Sliders,
  AlertCircle,
  Video,
  GraduationCap,
  Coins,
  ArrowUpRight,
  Check,
  Bell,
  BellRing,
  Flame,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { GoogleCalendarSyncCard } from "@/components/GoogleCalendarSyncCard";
import { toast } from "sonner";

export default function SmartLearningCalendar() {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });

  const [viewMode, setViewMode] = useState<"roadmap" | "calendar">("roadmap");
  const [availableMinutes, setAvailableMinutes] = useState<number>(270); // 4.5 hours default
  const [aiPreferences, setAiPreferences] = useState("");
  const [isAddingEvent, setIsAddingEvent] = useState(false);

  // Manual event form state
  const [eventTitle, setEventTitle] = useState("");
  const [eventCategory, setEventCategory] = useState<"lesson" | "task" | "focus_session" | "review">("lesson");
  const [eventStartTime, setEventStartTime] = useState("09:00");
  const [eventDuration, setEventDuration] = useState(45);
  const [eventSubject, setEventSubject] = useState("عام");
  const [eventPlatform, setEventPlatform] = useState("");
  const [eventLink, setEventLink] = useState("");

  const utils = trpc.useContext();
  const { data, isLoading } = trpc.smartCalendar.getData.useQuery({ dateStr: selectedDate });
  const { data: activeNotifications } = trpc.notifications.list.useQuery();

  const toggleEventMutation = trpc.smartCalendar.toggleEvent.useMutation({
    onSuccess: (res) => {
      utils.smartCalendar.getData.invalidate();
      if (res.isCompleted) {
        toast.success("أحسنت! تم إكمال الفقرة المحددة بآداء مميز! 🎉");
      }
    },
  });

  const deleteEventMutation = trpc.smartCalendar.deleteEvent.useMutation({
    onSuccess: () => {
      utils.smartCalendar.getData.invalidate();
      toast.success("تم حذف الفقرة من جدول اليوم.");
    },
  });

  const addEventMutation = trpc.smartCalendar.addEvent.useMutation({
    onSuccess: () => {
      utils.smartCalendar.getData.invalidate();
      setIsAddingEvent(false);
      resetEventForm();
      toast.success("تمت إضافة الفقرة بنجاح إلى جدول اليوم!");
    },
  });

  const generateAiRoadmapMutation = trpc.smartCalendar.generateAIRoadmap.useMutation({
    onSuccess: (data) => {
      utils.smartCalendar.getData.invalidate();
      toast.success(`تم توليد خارطة الطريق الذكية بنجاح! تم جدولة ${data.count} فقرات دراسية. ✨`);
    },
    onError: (err) => {
      toast.error(err.message || "حدث خطأ أثناء توليد الخطة بالذكاء الاصطناعي.");
    },
  });

  const resetEventForm = () => {
    setEventTitle("");
    setEventCategory("lesson");
    setEventStartTime("09:00");
    setEventDuration(45);
    setEventSubject("عام");
    setEventPlatform("");
    setEventLink("");
  };

  const handleAddManualEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim()) {
      toast.error("يرجى كتابة عنوان الفقرة الدراسية.");
      return;
    }
    addEventMutation.mutate({
      title: eventTitle,
      category: eventCategory,
      eventDate: selectedDate,
      startTime: eventStartTime,
      durationMinutes: Number(eventDuration) || 45,
      subject: eventSubject,
      platform: eventPlatform,
      linkUrl: eventLink,
    });
  };

  const handleQuickAddSource = (sourceItem: {
    title: string;
    subject: string;
    category: string;
    platform?: string;
    linkUrl?: string;
    sourceType: string;
    sourceId: number;
  }) => {
    addEventMutation.mutate({
      title: sourceItem.title,
      category: sourceItem.category,
      sourceType: sourceItem.sourceType,
      sourceId: sourceItem.sourceId,
      eventDate: selectedDate,
      startTime: "12:00",
      durationMinutes: 45,
      subject: sourceItem.subject || "عام",
      platform: sourceItem.platform || "",
      linkUrl: sourceItem.linkUrl || "",
    });
  };

  // Date navigation helpers
  const handleDateChange = (daysDelta: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + daysDelta);
    setSelectedDate(current.toISOString().split("T")[0]);
  };

  const isToday = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return selectedDate === today;
  }, [selectedDate]);

  // Aggregated capacity math
  const capacityStats = useMemo(() => {
    if (!data?.events) return { totalMinutes: 0, percent: 0, completedCount: 0, totalCount: 0 };
    const totalMinutes = data.events.reduce((sum: number, ev: any) => sum + (ev.durationMinutes || 0), 0);
    const completedCount = data.events.filter((ev: any) => ev.isCompleted === 1).length;
    const totalCount = data.events.length;
    const percent = Math.min(100, Math.round((totalMinutes / availableMinutes) * 100));

    return { totalMinutes, percent, completedCount, totalCount };
  }, [data?.events, availableMinutes]);

  const getCategoryMeta = (cat: string) => {
    switch (cat) {
      case "lesson":
        return { label: "درس كورس", bg: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30", icon: Laptop };
      case "task":
        return { label: "مهمة وواجب", bg: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30", icon: CheckSquare };
      case "focus_session":
        return { label: "جلسة بومودورو", bg: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30", icon: Timer };
      case "review":
        return { label: "مراجعة شاملة", bg: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30", icon: Sparkles };
      case "exam":
        return { label: "اختبار وتقييم", bg: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30", icon: GraduationCap };
      default:
        return { label: "نشاط دراسي", bg: "bg-primary/10 text-primary border-primary/20", icon: BookOpen };
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="التقويم التعليمي الذكي (Smart Learning Calendar)"
        description="خارطة طريق زمانية يومية تربط كورسات Resource Bridge، مهام المنهج، وجلسات السناتر بناءً على طاقتك ووقتك المتاح."
      />

      {/* GOOGLE CALENDAR BI-DIRECTIONAL SYNC CARD */}
      <GoogleCalendarSyncCard />

      {/* TOP CONTROLS & DATE NAVIGATOR */}
      <div className="surface p-5 rounded-3xl border flex flex-wrap items-center justify-between gap-4 bg-card">
        {/* Date Selector */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => handleDateChange(-1)} className="rounded-xl">
            <ChevronRight className="size-4" />
          </Button>

          <div className="flex items-center gap-2 bg-muted/60 px-3 py-1.5 rounded-2xl border">
            <CalendarIcon className="size-4 text-primary" />
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-7 border-none bg-transparent p-0 text-xs font-bold w-32 focus-visible:ring-0"
            />
            {isToday && <span className="bg-primary/15 text-primary text-[10px] font-extrabold px-2 py-0.5 rounded-md">اليوم</span>}
          </div>

          <Button variant="outline" size="icon" onClick={() => handleDateChange(1)} className="rounded-xl">
            <ChevronLeft className="size-4" />
          </Button>

          <div className="flex items-center gap-1.5 mr-2">
            <Button
              size="sm"
              variant={isToday ? "default" : "ghost"}
              onClick={() => setSelectedDate(new Date().toISOString().split("T")[0])}
              className="text-xs font-bold rounded-xl h-8"
            >
              اليوم
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const tom = new Date();
                tom.setDate(tom.getDate() + 1);
                setSelectedDate(tom.toISOString().split("T")[0]);
              }}
              className="text-xs font-bold rounded-xl h-8"
            >
              غداً
            </Button>
          </div>
        </div>

        {/* View Switcher & AI Trigger */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-2xl border text-xs font-bold">
            <button
              onClick={() => setViewMode("roadmap")}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                viewMode === "roadmap" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              <ListOrdered className="size-3.5" /> خارطة الطريق (Roadmap)
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                viewMode === "calendar" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              <CalendarDays className="size-3.5" /> المصادر والمهام المربوطة
            </button>
          </div>

          <Button
            onClick={() =>
              generateAiRoadmapMutation.mutate({
                eventDate: selectedDate,
                availableMinutes,
                preferences: aiPreferences,
              })
            }
            disabled={generateAiRoadmapMutation.isPending}
            className="gap-2 rounded-2xl font-extrabold shadow-lg shadow-primary/20 bg-gradient-to-r from-primary via-indigo-600 to-purple-600 hover:opacity-90"
          >
            <Sparkles className="size-4 animate-spin-slow" />
            <span>{generateAiRoadmapMutation.isPending ? "جارٍ توليد الخطة الذكية..." : "توليد الخطة بالذكاء الاصطناعي"}</span>
          </Button>
        </div>
      </div>

      {/* PERSONAL AVAILABILITY & DAILY CAPACITY METER */}
      <div className="surface p-6 rounded-3xl border space-y-4 bg-gradient-to-br from-card via-card to-primary/5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Zap className="size-4" />
              </span>
              <h3 className="font-extrabold text-base">طاقتك وساعات دراستك المتاحة لليوم</h3>
            </div>
            <p className="text-xs text-muted-foreground">حدد إجمالي الساعات المتاحة لديك ليقوم الذكاء الاصطناعي بموازنة الجدول دون إرهاق.</p>
          </div>

          <div className="flex items-center gap-3 border p-2 rounded-2xl bg-card">
            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1">
              <Clock className="size-3.5 text-primary" /> الوقت المتاح:
            </span>
            <Input
              type="number"
              step={30}
              min={30}
              max={720}
              value={availableMinutes}
              onChange={(e) => setAvailableMinutes(Number(e.target.value) || 240)}
              className="w-20 h-8 text-xs font-bold text-center rounded-xl"
            />
            <span className="text-xs font-bold text-primary">دقيقة ({(availableMinutes / 60).toFixed(1)} ساعة)</span>
          </div>
        </div>

        {/* Capacity Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-1">
              📊 إجمالي وقت الفقرات المجدولة: <strong className="text-foreground">{capacityStats.totalMinutes} دقيقة</strong>
            </span>
            <span
              className={`font-extrabold ${
                capacityStats.percent > 100 ? "text-destructive" : capacityStats.percent > 80 ? "text-amber-500" : "text-emerald-500"
              }`}
            >
              {capacityStats.percent}% من السعة المتاحة {capacityStats.percent > 100 && "(تجاوز الموعد المحدد!)"}
            </span>
          </div>

          <div className="w-full bg-muted h-3.5 rounded-full overflow-hidden border p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                capacityStats.percent > 100
                  ? "bg-destructive"
                  : capacityStats.percent > 80
                  ? "bg-amber-500"
                  : "bg-gradient-to-r from-primary to-emerald-500"
              }`}
              style={{ width: `${Math.min(100, capacityStats.percent)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              الفقرات المكتملة: <strong className="text-primary">{capacityStats.completedCount}</strong> من أصل {capacityStats.totalCount}
            </span>
            <span>💡 نصيحة: يفضل ترك 20% من وقتك اليومي للطوارئ والاستراحة.</span>
          </div>
        </div>
      </div>

      {/* ANTI-PROCRASTINATION & PERSONALIZED REMINDERS BANNER */}
      {activeNotifications && activeNotifications.length > 0 && (
        <div className="surface p-5 rounded-3xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-card to-primary/10 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <BellRing className="size-4 animate-bounce" />
              </div>
              <div>
                <h4 className="font-black text-sm flex items-center gap-2">
                  <span>تنبيهات المواعيد والوقاية من التسويف</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-mono border border-amber-500/30">
                    {activeNotifications.length} تنبيهات نشطة
                  </span>
                </h4>
                <p className="text-[11px] text-muted-foreground">تنبيهات مخصصة مبنية على جدولك اليومي لتفادي تراكم الدروس</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="size-3.5 text-primary" /> نظام التنبيه الذكي يعمل
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activeNotifications.slice(0, 3).map((notif) => (
              <div
                key={notif.id}
                className={`p-3 rounded-2xl border text-xs space-y-1.5 transition-all ${
                  notif.urgency === "urgent"
                    ? "bg-red-500/10 border-red-500/30"
                    : notif.urgency === "warning"
                    ? "bg-amber-500/10 border-amber-500/30"
                    : "bg-card border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-1">
                  <span className="font-extrabold flex items-center gap-1 text-foreground leading-snug">
                    {notif.urgency === "urgent" && <AlertTriangle className="size-3.5 text-red-500 shrink-0" />}
                    {notif.urgency === "warning" && <Clock className="size-3.5 text-amber-500 shrink-0" />}
                    {notif.urgency === "info" && <BookOpen className="size-3.5 text-primary shrink-0" />}
                    <span>{notif.title}</span>
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">{notif.message}</p>
                {notif.timeRemainingText && (
                  <div className="text-[10px] font-mono font-bold text-primary pt-1">
                    ⏱️ {notif.timeRemainingText}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MAIN CONTENT GRID */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* LEFT COLUMN: DAILY ROADMAP TIMELINE (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              <ListOrdered className="size-5 text-primary" />
              <h3 className="font-extrabold text-base">خارطة الطريق الزمانية لليوم ({data?.events?.length || 0})</h3>
            </div>

            <Button onClick={() => setIsAddingEvent(!isAddingEvent)} size="sm" variant="outline" className="rounded-xl text-xs font-bold gap-1">
              <Plus className="size-3.5" /> إضافة فقرة يدوياً
            </Button>
          </div>

          {/* Manual Add Form */}
          {isAddingEvent && (
            <form onSubmit={handleAddManualEvent} className="surface p-5 rounded-3xl border border-primary/30 space-y-4 animate-in fade-in bg-card">
              <h4 className="font-bold text-sm text-primary flex items-center gap-1.5">
                <Plus className="size-4" /> إضافة فقرة دراسية جديدة للجدول
              </h4>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-muted-foreground block mb-1">عنوان الفقرة الدراسية *</label>
                  <Input value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} placeholder="مثال: مشاهدة الدرس الثالث كورس Udemy" />
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">النوع / التصنيف</label>
                  <select
                    value={eventCategory}
                    onChange={(e: any) => setEventCategory(e.target.value)}
                    className="w-full h-9 rounded-xl border bg-card px-3 text-xs font-bold"
                  >
                    <option value="lesson">درس كورس (Lesson)</option>
                    <option value="task">مهمة وواجب (Task)</option>
                    <option value="focus_session">جلسة بومودورو (Focus)</option>
                    <option value="review">مراجعة شاملة (Review)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">المادة الدراسية</label>
                  <Input value={eventSubject} onChange={(e) => setEventSubject(e.target.value)} placeholder="مثال: رياضيات، برمجة" />
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">وقت البدء (ساعة:دقيقة)</label>
                  <Input type="time" value={eventStartTime} onChange={(e) => setEventStartTime(e.target.value)} className="text-xs font-bold" />
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">المدة بالدقائق</label>
                  <Input
                    type="number"
                    value={eventDuration}
                    onChange={(e) => setEventDuration(Number(e.target.value) || 45)}
                    placeholder="45"
                    className="text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">اسم المنصة (اختياري)</label>
                  <Input value={eventPlatform} onChange={(e) => setEventPlatform(e.target.value)} placeholder="Udemy, Coursera..." />
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">رابط مباشر (اختياري)</label>
                  <Input value={eventLink} onChange={(e) => setEventLink(e.target.value)} placeholder="https://..." />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddingEvent(false)}>
                  إلغاء
                </Button>
                <Button type="submit" size="sm" disabled={addEventMutation.isPending} className="font-bold gap-1">
                  <Check className="size-3.5" /> حفظ الفقرة
                </Button>
              </div>
            </form>
          )}

          {/* Timeline Items List */}
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : data?.events && data.events.length > 0 ? (
            <div className="space-y-3 relative before:absolute before:right-6 before:top-4 before:bottom-4 before:w-0.5 before:bg-border/60">
              {data.events.map((ev: any) => {
                const isCompleted = ev.isCompleted === 1;
                const catMeta = getCategoryMeta(ev.category);
                const CatIcon = catMeta.icon;

                return (
                  <div
                    key={ev.id}
                    className={`surface p-4 rounded-2xl border transition-all relative pr-12 flex flex-wrap items-center justify-between gap-4 ${
                      isCompleted ? "border-emerald-500/30 opacity-75 bg-muted/20" : "bg-card hover:border-primary/40"
                    }`}
                  >
                    {/* Circle Node on Timeline */}
                    <button
                      onClick={() => toggleEventMutation.mutate({ id: ev.id })}
                      className={`absolute right-3.5 top-5 flex size-6 items-center justify-center rounded-full border transition-all ${
                        isCompleted
                          ? "bg-emerald-500 text-white border-emerald-500 shadow-md"
                          : "border-muted-foreground/40 hover:border-primary bg-card"
                      }`}
                    >
                      {isCompleted && <Check className="size-3.5 stroke-[3]" />}
                    </button>

                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                        <span className="font-mono text-primary font-extrabold bg-primary/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Clock className="size-3" /> {ev.startTime}
                        </span>

                        <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-extrabold flex items-center gap-1 ${catMeta.bg}`}>
                          <CatIcon className="size-3" /> {catMeta.label}
                        </span>

                        <span className="text-muted-foreground">{ev.subject}</span>

                        {ev.platform && <span className="text-[11px] bg-muted px-2 py-0.5 rounded-md">📺 {ev.platform}</span>}
                      </div>

                      <h4 className={`font-extrabold text-sm ${isCompleted ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {ev.title}
                      </h4>

                      {ev.notes && <p className="text-xs text-muted-foreground bg-muted/40 p-2 rounded-xl">{ev.notes}</p>}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-bold text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-xl">
                        ⏱️ {ev.durationMinutes} دقيقة
                      </span>

                      {ev.linkUrl && (
                        <a href={ev.linkUrl} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="secondary" className="h-8 rounded-xl text-xs font-bold gap-1">
                            <ExternalLink className="size-3" /> فتح
                          </Button>
                        </a>
                      )}

                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteEventMutation.mutate({ id: ev.id })}
                        className="size-8 text-destructive rounded-xl"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="surface p-10 rounded-3xl border border-dashed border-border text-center space-y-3">
              <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="size-6" />
              </div>
              <h4 className="font-bold text-sm">لا توجد فقرات دراسية مجدولة ليوم {selectedDate}</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                اضغط على زر "توليد الخطة بالذكاء الاصطناعي" بالأعلى أو اختر كورسات ومهام من القائمة الجانبية لإضافتها لجدول اليوم!
              </p>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: SYNCED SOURCES DRAWER (4 Cols) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Resource Bridge Synced Lessons */}
          <div className="surface p-5 rounded-3xl border space-y-3 bg-card">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <Laptop className="size-4 text-purple-500" />
                <h4 className="font-bold text-sm">كورسات Resource Bridge</h4>
              </div>
              <span className="text-[10px] font-bold bg-purple-500/10 text-purple-600 px-2 py-0.5 rounded-full">
                {data?.resources?.length || 0} دورة
              </span>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {data?.resources && data.resources.length > 0 ? (
                data.resources.slice(0, 5).map((res: any) => (
                  <div key={res.id} className="p-3 rounded-2xl border bg-card/60 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-primary truncate max-w-[150px]">{res.title}</span>
                      <span className="text-[10px] bg-muted px-2 py-0.5 rounded-md">{res.platform}</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>التقدم: {res.progressPercent}%</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          handleQuickAddSource({
                            title: `متابعة كورس: ${res.title}`,
                            subject: res.subject,
                            category: "lesson",
                            platform: res.platform,
                            linkUrl: res.url,
                            sourceType: "resource",
                            sourceId: res.id,
                          })
                        }
                        className="h-6 text-[10px] font-bold text-primary hover:bg-primary/10 rounded-lg p-1"
                      >
                        + أضف للجدول
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">لا توجد كورسات مربطوة بعد.</p>
              )}
            </div>
          </div>

          {/* Synced Tasks */}
          <div className="surface p-5 rounded-3xl border space-y-3 bg-card">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <CheckSquare className="size-4 text-amber-500" />
                <h4 className="font-bold text-sm">التكليفات والمهام المعلقة</h4>
              </div>
              <span className="text-[10px] font-bold bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full">
                {data?.tasks?.filter((t: any) => !t.completed).length || 0} مهمة
              </span>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {data?.tasks && data.tasks.filter((t: any) => !t.completed).length > 0 ? (
                data.tasks
                  .filter((t: any) => !t.completed)
                  .slice(0, 5)
                  .map((t: any) => (
                    <div key={t.id} className="p-3 rounded-2xl border bg-card/60 flex items-center justify-between text-xs gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-foreground truncate">{t.title}</div>
                        <div className="text-[10px] text-muted-foreground">{t.subject || "عام"}</div>
                      </div>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          handleQuickAddSource({
                            title: `حل واجب: ${t.title}`,
                            subject: t.subject,
                            category: "task",
                            sourceType: "task",
                            sourceId: t.id,
                          })
                        }
                        className="h-6 text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 rounded-lg shrink-0 p-1"
                      >
                        + أضف للجدول
                      </Button>
                    </div>
                  ))
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">لا توجد مهام معلقة ممتازة!</p>
              )}
            </div>
          </div>

          {/* Synced Hybrid Center Lessons */}
          <div className="surface p-5 rounded-3xl border space-y-3 bg-card">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <GraduationCap className="size-4 text-blue-500" />
                <h4 className="font-bold text-sm">محاضرات السناتر والأونلاين</h4>
              </div>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {data?.hybridLessons && data.hybridLessons.length > 0 ? (
                data.hybridLessons.slice(0, 4).map((h: any) => (
                  <div key={h.id} className="p-3 rounded-2xl border bg-card/60 flex items-center justify-between text-xs gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-foreground truncate">{h.lectureTitle}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {h.subject} • {h.platformOrCenter}
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        handleQuickAddSource({
                          title: `محاضرة: ${h.lectureTitle}`,
                          subject: h.subject,
                          category: "lesson",
                          platform: h.platformOrCenter,
                          linkUrl: h.onlineUrl || "",
                          sourceType: "hybrid",
                          sourceId: h.id,
                        })
                      }
                      className="h-6 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 rounded-lg shrink-0 p-1"
                    >
                      + أضف للجدول
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">لا توجد دروس سناتر مسجلة.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
