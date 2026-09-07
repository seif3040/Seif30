import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Laptop,
  Building2,
  Combine,
  Plus,
  ExternalLink,
  Key,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileCheck2,
  Trash2,
  Copy,
  Sparkles,
  Search,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";

export default function HybridHub() {
  const [filterMode, setFilterMode] = useState<string>("all");
  const [isAdding, setIsAdding] = useState(false);

  // Form states
  const [subject, setSubject] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [mode, setMode] = useState<"online" | "center" | "hybrid">("online");
  const [platformOrCenter, setPlatformOrCenter] = useState("");
  const [lectureTitle, setLectureTitle] = useState("");
  const [onlineUrl, setOnlineUrl] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [centerTime, setCenterTime] = useState("");
  const [notes, setNotes] = useState("");

  const utils = trpc.useContext();
  const { data: lessons, isLoading } = trpc.hybridHub.list.useQuery();

  const createMutation = trpc.hybridHub.create.useMutation({
    onSuccess: () => {
      utils.hybridHub.list.invalidate();
      setIsAdding(false);
      resetForm();
      toast.success("تم تسجيل الحصة/المحاضرة بنجاح! (+15 Coins)");
    },
    onError: (e) => toast.error(e.message || "حدث خطأ أثناء التسجيل."),
  });

  const updateStatusMutation = trpc.hybridHub.updateStatus.useMutation({
    onSuccess: () => {
      utils.hybridHub.list.invalidate();
      toast.success("تم تحديث حالة الحصة.");
    },
  });

  const deleteMutation = trpc.hybridHub.delete.useMutation({
    onSuccess: () => {
      utils.hybridHub.list.invalidate();
      toast.success("تم حذف الحصة.");
    },
  });

  const resetForm = () => {
    setSubject("");
    setTeacherName("");
    setMode("online");
    setPlatformOrCenter("");
    setLectureTitle("");
    setOnlineUrl("");
    setAccessCode("");
    setExpiryDate("");
    setCenterTime("");
    setNotes("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !teacherName.trim() || !lectureTitle.trim() || !platformOrCenter.trim()) {
      toast.error("يرجى ملء كافة البيانات الأساسية.");
      return;
    }
    createMutation.mutate({
      subject,
      teacherName,
      mode,
      platformOrCenter,
      lectureTitle,
      onlineUrl,
      accessCode,
      expiryDate,
      centerTime,
      notes,
    });
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("تم نسخ كود المنصة لسهولة اللصق!");
  };

  const filteredLessons = lessons?.filter((item: any) => {
    if (filterMode === "all") return true;
    return item.mode === filterMode;
  });

  const pendingOnlineCount = lessons?.filter((i: any) => i.mode !== "center" && i.status === "pending").length || 0;
  const pendingSheetsCount = lessons?.filter((i: any) => i.sheetStatus === "pending").length || 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="مركز إدارة الدروس والسناتر (Hybrid Hub)"
        description="نظامك المتكامل لمتابعة محاضرات الأونلاين والأكواد، حجز السناتر والمواصلات، ومنع تراكم الفيديوهات."
      />

      {/* Top Stats Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="surface p-4 rounded-3xl border flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
            <Laptop className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">دروس الأونلاين والمعلقة</p>
            <p className="text-xl font-bold">{pendingOnlineCount} محاضرة متبقية</p>
          </div>
        </div>

        <div className="surface p-4 rounded-3xl border flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Building2 className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">حصص السنتر والميكس</p>
            <p className="text-xl font-bold">{lessons?.filter((i: any) => i.mode !== "online").length || 0} مادة</p>
          </div>
        </div>

        <div className="surface p-4 rounded-3xl border flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <FileCheck2 className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">شيتات تحتاج تسليم/تصحيح</p>
            <p className="text-xl font-bold">{pendingSheetsCount} شيت واجب</p>
          </div>
        </div>

        <div className="surface p-4 rounded-3xl border flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">إجمالي الحصص الموثقة</p>
            <p className="text-xl font-bold">{lessons?.length || 0} حصة</p>
          </div>
        </div>
      </div>

      {/* Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 surface p-4 rounded-3xl border">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={filterMode === "all" ? "default" : "outline"}
            onClick={() => setFilterMode("all")}
            className="rounded-xl font-bold text-xs"
          >
            الكل
          </Button>
          <Button
            size="sm"
            variant={filterMode === "online" ? "default" : "outline"}
            onClick={() => setFilterMode("online")}
            className="rounded-xl font-bold text-xs gap-1"
          >
            <Laptop className="size-3.5" /> أونلاين
          </Button>
          <Button
            size="sm"
            variant={filterMode === "center" ? "default" : "outline"}
            onClick={() => setFilterMode("center")}
            className="rounded-xl font-bold text-xs gap-1"
          >
            <Building2 className="size-3.5" /> سنتر
          </Button>
          <Button
            size="sm"
            variant={filterMode === "hybrid" ? "default" : "outline"}
            onClick={() => setFilterMode("hybrid")}
            className="rounded-xl font-bold text-xs gap-1"
          >
            <Combine className="size-3.5" /> ميكس
          </Button>
        </div>

        <Button onClick={() => setIsAdding(!isAdding)} className="gap-2 rounded-2xl font-bold shadow-md shadow-primary/20">
          <Plus className="size-4" />
          <span>{isAdding ? "إلغاء الإضافة" : "تسجيل حصة / محاضرة جديدة"}</span>
        </Button>
      </div>

      {/* Add New Lesson Form */}
      {isAdding && (
        <form onSubmit={handleSubmit} className="surface p-6 rounded-3xl border border-primary/30 space-y-4 animate-in fade-in">
          <h3 className="font-bold text-base flex items-center gap-2 text-primary border-b pb-3">
            <Plus className="size-5" /> تسجيل حصة أونلاين أو سنتر جديدة
          </h3>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">اسم المادة *</label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="مثال: فيزياء، لغة عربية" />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">اسم المدرس *</label>
              <Input value={teacherName} onChange={(e) => setTeacherName(e.target.value)} placeholder="مثال: أ/ محمود رجب" />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">نوع النمط الدراسي *</label>
              <select
                value={mode}
                onChange={(e: any) => setMode(e.target.value)}
                className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm font-bold"
              >
                <option value="online">💻 أونلاين فقط (منصة/يوتيوب)</option>
                <option value="center">🏫 سنتر حضوري فقط</option>
                <option value="hybrid">🔀 ميكس (سنتر + متابعة أونلاين)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">اسم المنصة أو السنتر *</label>
              <Input
                value={platformOrCenter}
                onChange={(e) => setPlatformOrCenter(e.target.value)}
                placeholder="مثال: منصة أبواب / سنتر الأهرام"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">عنوان المحاضرة / الدرس *</label>
              <Input
                value={lectureTitle}
                onChange={(e) => setLectureTitle(e.target.value)}
                placeholder="مثال: الحث الكهرومغناطيسي - الدرس الأول"
              />
            </div>

            {(mode === "online" || mode === "hybrid") && (
              <>
                <div>
                  <label className="text-xs font-bold text-muted-foreground mb-1 block">رابط المحاضرة / المنصة</label>
                  <Input value={onlineUrl} onChange={(e) => setOnlineUrl(e.target.value)} placeholder="https://..." />
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground mb-1 block">كود الاشتراك / الكوبون</label>
                  <Input value={accessCode} onChange={(e) => setAccessCode(e.target.value)} placeholder="CODE-9812" />
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground mb-1 block">تاريخ قفل الفيديو / انتهاء الصلاحية</label>
                  <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
                </div>
              </>
            )}

            {(mode === "center" || mode === "hybrid") && (
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1 block">ميعاد السنتر واليوم</label>
                <Input value={centerTime} onChange={(e) => setCenterTime(e.target.value)} placeholder="الأحد 4:00 عصراً" />
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1 block">ملاحظات أو واجبات</label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: حل شيت ص 45 وتسليمه الأسبوع القادم..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsAdding(false)}>
              إلغاء
            </Button>

            <Button type="submit" disabled={createMutation.isPending} className="font-bold">
              حفظ الحصة (+15 Coins)
            </Button>
          </div>
        </form>
      )}

      {/* Lesson List Display */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-3xl bg-muted" />
          ))}
        </div>
      ) : filteredLessons && filteredLessons.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredLessons.map((lesson: any) => {
            const isOnline = lesson.mode === "online";
            const isCenter = lesson.mode === "center";
            const isCompleted = lesson.status === "completed" || lesson.status === "watched" || lesson.status === "attended";

            return (
              <div
                key={lesson.id}
                className={`surface p-5 rounded-3xl border space-y-4 transition-all hover:border-primary/40 ${
                  isCompleted ? "opacity-85 border-emerald-500/30" : ""
                }`}
              >
                {/* Card Header */}
                <div className="flex items-start justify-between gap-2 border-b pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-primary">{lesson.subject}</span>
                      <span className="text-[10px] font-extrabold bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                        {lesson.teacherName}
                      </span>
                    </div>
                    <h3 className="font-bold text-base">{lesson.lectureTitle}</h3>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                      isOnline
                        ? "bg-sky-500/10 text-sky-600 border-sky-500/20"
                        : isCenter
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                        : "bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/20"
                    }`}
                  >
                    {isOnline ? <Laptop className="size-3" /> : isCenter ? <Building2 className="size-3" /> : <Combine className="size-3" />}
                    {lesson.platformOrCenter}
                  </span>
                </div>

                {/* Details */}
                <div className="space-y-2 text-xs">
                  {lesson.accessCode && (
                    <div className="flex items-center justify-between bg-muted/50 p-2 rounded-xl border">
                      <span className="flex items-center gap-1 font-bold text-muted-foreground">
                        <Key className="size-3.5 text-amber-500" /> كود المنصة: <code className="text-foreground">{lesson.accessCode}</code>
                      </span>
                      <Button size="icon" variant="ghost" className="size-6" onClick={() => copyCode(lesson.accessCode)}>
                        <Copy className="size-3" />
                      </Button>
                    </div>
                  )}

                  {lesson.expiryDate && (
                    <p className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-bold">
                      <AlertTriangle className="size-3.5" /> ينتهي فتح الفيديو بتاريخ: {lesson.expiryDate}
                    </p>
                  )}

                  {lesson.centerTime && (
                    <p className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                      <Clock className="size-3.5" /> ميعاد السنتر: {lesson.centerTime}
                    </p>
                  )}

                  {lesson.notes && <p className="text-muted-foreground leading-5 bg-card p-2 rounded-xl border">{lesson.notes}</p>}
                </div>

                {/* Status Toggles & Actions */}
                <div className="pt-2 border-t flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={isCompleted ? "default" : "outline"}
                      onClick={() =>
                        updateStatusMutation.mutate({
                          lessonId: lesson.id,
                          status: isCompleted ? "pending" : isOnline ? "watched" : "attended",
                        })
                      }
                      className="rounded-xl text-xs h-8 font-bold gap-1"
                    >
                      <CheckCircle2 className="size-3.5" />
                      {isCompleted ? "تمت المتابعة" : "مارك كمكتمل"}
                    </Button>

                    {lesson.onlineUrl && (
                      <a href={lesson.onlineUrl} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="secondary" className="rounded-xl text-xs h-8 font-bold gap-1">
                          <ExternalLink className="size-3.5" /> المنصة
                        </Button>
                      </a>
                    )}
                  </div>

                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate({ lessonId: lesson.id })}
                    className="size-8 text-destructive hover:bg-destructive/10 rounded-xl"
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
            <BookOpen className="size-7" />
          </div>
          <h3 className="font-bold text-base">لا توجد حصص مسجلة في هذا القسم</h3>
          <p className="text-xs text-muted-foreground leading-5 max-w-md mx-auto">
            انقر على زر "تسجيل حصة / محاضرة جديدة" بالأعلى لإضافة حصصك الأونلاين أو السنتر وحفظ الأكواد والتواريخ!
          </p>
        </div>
      )}
    </div>
  );
}
