import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Sparkles,
  ExternalLink,
  Copy,
  CheckCircle2,
  FileText,
  UploadCloud,
  Layers,
  BookOpen,
  Video,
  AlertTriangle,
  Bookmark,
  Share2,
  Check,
  RefreshCw,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "@/lib/firebase";

export function GoogleKeepExporter() {
  const { data, isLoading, refetch } = trpc.notebooks.exportAllNotes.useQuery();
  const [selectedIndices, setSelectedIndices] = useState<Record<number, boolean>>({});
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "notebook" | "video" | "mistake">("all");

  const notesList = data?.notes || [];

  const filteredNotes = notesList.filter((note) => {
    if (activeTab === "all") return true;
    return note.type === activeTab;
  });

  const toggleSelectNote = (idx: number) => {
    setSelectedIndices((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const selectAll = () => {
    const next: Record<number, boolean> = {};
    filteredNotes.forEach((_, idx) => {
      next[idx] = true;
    });
    setSelectedIndices(next);
  };

  const deselectAll = () => {
    setSelectedIndices({});
  };

  // Get Google Access Token via Firebase Google Auth
  const getGoogleAccessToken = async (): Promise<string | null> => {
    if (googleToken) return googleToken;

    try {
      const provider = new GoogleAuthProvider();
      provider.addScope("https://www.googleapis.com/auth/tasks");
      provider.addScope("https://www.googleapis.com/auth/documents");

      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;

      if (token) {
        setGoogleToken(token);
        return token;
      } else {
        toast.error("تعذر الحصول على مفتاح الوصول لحساب Google.");
        return null;
      }
    } catch (err: any) {
      console.error("Google Auth error:", err);
      toast.error("حدث خطأ أثناء الاتصال بحساب Google. يرجى إعادة المحاولة.");
      return null;
    }
  };

  // 1-Click Copy formatted note for Google Keep
  const copyNoteForKeep = (title: string, content: string, index: number) => {
    const keepFormattedText = `📌 [Seif Study OS] ${title}\n\n${content}\n\n--- 🤖 تم التصدير تلقائياً لـ Google Keep`;
    navigator.clipboard.writeText(keepFormattedText);
    setCopiedIndex(index);
    toast.success("تم نسخ الملاحظة بتنسيق جاهز للطلب واللصق المباشر في Google Keep! 📋");
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Copy ALL selected notes formatted for Google Keep
  const copyAllForKeep = () => {
    const selected = filteredNotes.filter((_, idx) => selectedIndices[idx]);
    const targetNotes = selected.length > 0 ? selected : filteredNotes;

    if (targetNotes.length === 0) {
      toast.error("لا توجد ملاحظات متاحة للنسخ.");
      return;
    }

    const fullFormattedText = targetNotes
      .map(
        (n, i) =>
          `📌 [${i + 1}] ${n.title} (${n.category || "ملاحظة"})\n${n.content}\n`
      )
      .join("\n==============================\n\n");

    navigator.clipboard.writeText(fullFormattedText);
    toast.success(`تم نسخ ${targetNotes.length} ملاحظات جاهزة للضغط واللصق في Google Keep! 📝`);
  };

  // Open Google Keep in new window
  const openGoogleKeep = () => {
    window.open("https://keep.google.com/", "_blank", "noopener,noreferrer");
  };

  // Sync Selected Notes directly to Google Tasks / Workspace
  const syncToGoogleWorkspace = async () => {
    const selected = filteredNotes.filter((_, idx) => selectedIndices[idx]);
    const targetNotes = selected.length > 0 ? selected : filteredNotes;

    if (targetNotes.length === 0) {
      toast.error("يرجى تحديد ملاحظة واحدة على الأقل للتصدير.");
      return;
    }

    setIsExporting(true);
    toast.info("جاري الاتصال بحساب Google ومزامنة الملاحظات... ⏳");

    try {
      const token = await getGoogleAccessToken();
      if (!token) {
        setIsExporting(false);
        return;
      }

      let successCount = 0;

      // Sync as Google Tasks items (Which show up inside Gmail / Google Keep side panel)
      for (const note of targetNotes.slice(0, 20)) {
        try {
          const res = await fetch("https://tasks.googleapis.com/v1/lists/@default/tasks", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: `📌 ${note.title} (${note.category || "دراسة"})`,
              notes: `${note.content}\n\n--- 🚀 تصدير تلقائي من منصة Seif Study OS`,
            }),
          });

          if (res.ok) {
            successCount++;
          }
        } catch (e) {
          console.error("Task sync error:", e);
        }
      }

      toast.success(
        `عاش يا بطل! تم تصدير ومزامنة ${successCount} ملاحظات بنجاح إلى حسابك في Google! 🎉`
      );

      // Prompt to open Keep or Tasks
      setTimeout(() => {
        openGoogleKeep();
      }, 1000);
    } catch (err) {
      console.error("Export error:", err);
      toast.error("حدث خطأ أثناء التصدير لمساحة Google.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="surface rounded-3xl border bg-gradient-to-br from-card via-card to-amber-500/5 p-6 shadow-md space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            <Bookmark className="size-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-black text-lg text-foreground">تصدير الملاحظات إلى Google Keep & Workspace 🟡</h3>
              <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 text-xs font-bold">
                {data?.count || 0} ملاحظة متوفرة
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              تجميع وتصدير كافة دفاتر الملاحظات، ملخصات الفيديوهات، وسجل الأخطاء مباشرة بحساب Google الخاص بك.
            </p>
          </div>
        </div>

        {/* TOP ACTION BUTTONS */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={openGoogleKeep}
            variant="outline"
            size="sm"
            className="rounded-2xl gap-1.5 text-xs font-bold border-amber-500/30 hover:bg-amber-500/10"
          >
            <ExternalLink className="size-3.5 text-amber-500" />
            <span>فتح Google Keep</span>
          </Button>

          <Button
            onClick={copyAllForKeep}
            variant="secondary"
            size="sm"
            className="rounded-2xl gap-1.5 text-xs font-bold"
          >
            <Copy className="size-3.5" />
            <span>نسخ التحديد لـ Keep 📋</span>
          </Button>

          <Button
            onClick={syncToGoogleWorkspace}
            disabled={isExporting}
            size="sm"
            className="rounded-2xl gap-1.5 text-xs font-extrabold bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-black hover:opacity-95 shadow-md shadow-amber-500/20"
          >
            {isExporting ? <RefreshCw className="size-3.5 animate-spin" /> : <UploadCloud className="size-3.5" />}
            <span>{isExporting ? "جاري المزامنة..." : "حفظ وحساب Google 🚀"}</span>
          </Button>
        </div>
      </div>

      {/* CATEGORY TABS & SELECTION COUNTER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-2xl text-xs font-bold transition-all border ${
              activeTab === "all"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/40 hover:bg-muted text-muted-foreground"
            }`}
          >
            الكل ({data?.count || 0})
          </button>
          <button
            onClick={() => setActiveTab("notebook")}
            className={`px-3 py-1.5 rounded-2xl text-xs font-bold transition-all border ${
              activeTab === "notebook"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/40 hover:bg-muted text-muted-foreground"
            }`}
          >
            دفاتر الملاحظات ({data?.notebookNotesCount || 0})
          </button>
          <button
            onClick={() => setActiveTab("video")}
            className={`px-3 py-1.5 rounded-2xl text-xs font-bold transition-all border ${
              activeTab === "video"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/40 hover:bg-muted text-muted-foreground"
            }`}
          >
            ملاحظات الفيديوهات ({data?.videoNotesCount || 0})
          </button>
          <button
            onClick={() => setActiveTab("mistake")}
            className={`px-3 py-1.5 rounded-2xl text-xs font-bold transition-all border ${
              activeTab === "mistake"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/40 hover:bg-muted text-muted-foreground"
            }`}
          >
            كشكول الأخطاء ({data?.mistakesCount || 0})
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold">
          <button onClick={selectAll} className="text-primary hover:underline">
            تحديد الكل
          </button>
          <span className="text-muted-foreground">•</span>
          <button onClick={deselectAll} className="text-muted-foreground hover:underline">
            إلغاء التحديد
          </button>
        </div>
      </div>

      {/* NOTES CARDS GRID */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="p-8 text-center rounded-2xl border border-dashed text-muted-foreground space-y-2">
          <FileText className="size-8 mx-auto opacity-40" />
          <p className="text-sm font-bold">لا توجد ملاحظات مسجلة في هذه الفئة حالياً.</p>
          <p className="text-xs">اكتب ملاحظاتك في الفيديوهات أو الدفاتر لتظهر هنا وتُصدَّر تلقائياً.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredNotes.map((note, idx) => {
            const isSelected = !!selectedIndices[idx];
            return (
              <div
                key={idx}
                onClick={() => toggleSelectNote(idx)}
                className={`group relative flex flex-col justify-between p-4 rounded-2xl border transition-all cursor-pointer ${
                  isSelected
                    ? "bg-amber-500/10 border-amber-500/50 ring-2 ring-amber-500/20"
                    : "bg-card hover:border-primary/40 hover:shadow-sm"
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`size-2 rounded-full shrink-0 ${
                          note.type === "notebook"
                            ? "bg-blue-500"
                            : note.type === "video"
                            ? "bg-purple-500"
                            : note.type === "mistake"
                            ? "bg-rose-500"
                            : "bg-emerald-500"
                        }`}
                      />
                      <Badge variant="outline" className="text-[10px] font-bold py-0 h-5">
                        {note.category || "عام"}
                      </Badge>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyNoteForKeep(note.title, note.content, idx);
                      }}
                      className="p-1 rounded-lg border bg-background hover:bg-muted text-muted-foreground transition-all"
                      title="نسخ جاهز لـ Google Keep"
                    >
                      {copiedIndex === idx ? (
                        <Check className="size-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </button>
                  </div>

                  <h4 className="font-extrabold text-sm text-foreground line-clamp-1 pr-1">
                    {note.title}
                  </h4>

                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                    {note.content}
                  </p>
                </div>

                <div className="pt-3 mt-2 border-t flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="font-mono">
                    {note.updatedAt ? new Date(note.updatedAt).toLocaleDateString("ar-EG") : ""}
                  </span>
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 group-hover:underline">
                    {isSelected ? "محددة للتصدير ✅" : "تحديد"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
