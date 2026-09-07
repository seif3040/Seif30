import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  FileText,
  Upload,
  Search,
  Sparkles,
  BookOpen,
  Trash2,
  ExternalLink,
  Plus,
  HelpCircle,
  FileSearch,
  CheckCircle2,
  X,
  FileCheck,
  Brain,
  Zap,
  ListFilter,
  Eye,
  Coins,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface PdfResourceManagerProps {
  resourceId?: number;
  resourceTitle?: string;
  defaultSubject?: string;
}

export function PdfResourceManager({ resourceId, resourceTitle, defaultSubject }: PdfResourceManagerProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedPdf, setSelectedPdf] = useState<any>(null);

  // Upload Form State
  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [subject, setSubject] = useState(defaultSubject || "عام");
  const [rawText, setRawText] = useState("");
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");

  const utils = trpc.useContext();

  const { data: pdfs, isLoading } = trpc.resourceBridge.listPdfs.useQuery({ resourceId });
  const { data: searchResults, isFetching: isSearching } = trpc.resourceBridge.searchPdfs.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.trim().length >= 2 }
  );

  const uploadPdfMutation = trpc.resourceBridge.uploadPdf.useMutation({
    onSuccess: (data) => {
      utils.resourceBridge.listPdfs.invalidate();
      setIsUploading(false);
      resetForm();
      toast.success(`تم تحويل وفهرسة ملف PDF بنجاح! كسبت +25 Coins! 🎓`);
      if (data) {
        setSelectedPdf({
          id: data.pdfId,
          fileName: data.fileName,
          extractedText: data.extractedText,
          summaryJson: data.summaryJson,
        });
      }
    },
    onError: (err) => {
      setIsProcessing(false);
      toast.error(err.message || "حدث خطأ أثناء معالجة وقراءة ملف الـ PDF.");
    },
  });

  const summarizePdfMutation = trpc.resourceBridge.summarizePdf.useMutation({
    onSuccess: (updatedSummary) => {
      utils.resourceBridge.listPdfs.invalidate();
      if (selectedPdf) {
        setSelectedPdf((prev: any) => ({ ...prev, summaryJson: updatedSummary }));
      }
      toast.success("تم توليد تلخيص جديد بالذكاء الاصطناعي بنجاح! ✨");
    },
    onError: () => {
      toast.error("تعذر توليد التلخيص بالذكاء الاصطناعي.");
    },
  });

  const deletePdfMutation = trpc.resourceBridge.deletePdf.useMutation({
    onSuccess: () => {
      utils.resourceBridge.listPdfs.invalidate();
      if (selectedPdf) setSelectedPdf(null);
      toast.success("تم حذف ملف الـ PDF بنجاح.");
    },
  });

  const resetForm = () => {
    setFileName("");
    setFileUrl("");
    setSubject(defaultSubject || "عام");
    setRawText("");
    setFileBase64(null);
    setIsProcessing(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!fileName) {
      setFileName(file.name.replace(/\.[^/.]+$/, ""));
    }

    const reader = new FileReader();
    if (file.type === "application/pdf" || file.type.includes("pdf")) {
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64Data = result.split(",")[1];
        setFileBase64(base64Data);
        toast.success(`تم تحميل ملف "${file.name}" وجاهز للمعالجة بالذكاء الاصطناعي.`);
      };
    } else {
      // Plain text or markdown
      reader.readAsText(file);
      reader.onload = () => {
        setRawText(reader.result as string);
        toast.success(`تم استخراج نص الملف بنجاح.`);
      };
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileName.trim()) {
      toast.error("يرجى إدخال اسم لملف الـ PDF.");
      return;
    }
    if (!fileBase64 && !fileUrl.trim() && !rawText.trim()) {
      toast.error("يرجى اختيار ملف PDF أو وضع رابط أو لصق نص أولاً.");
      return;
    }

    setIsProcessing(true);
    uploadPdfMutation.mutate({
      resourceId,
      fileName: fileName.trim(),
      fileUrl: fileUrl.trim() || undefined,
      subject,
      fileBase64: fileBase64 || undefined,
      rawText: rawText.trim() || undefined,
    });
  };

  return (
    <div className="surface p-6 rounded-3xl border space-y-6 bg-card">
      {/* HEADER BAR */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
            <FileText className="size-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-base flex items-center gap-2">
              <span>تفريغات وملفات PDF الدراسية</span>
              {resourceTitle && <span className="text-xs text-muted-foreground">({resourceTitle})</span>}
            </h3>
            <p className="text-xs text-muted-foreground">رفع، تحويل لنصوص قابلة للبحث، والتلخيص بالذكاء الاصطناعي</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className="rounded-2xl gap-2 text-xs font-bold"
          >
            <Search className="size-4 text-primary" />
            <span>البحث الفوري بالنصوص ({pdfs?.length || 0})</span>
          </Button>

          <Button
            onClick={() => setIsUploading(!isUploading)}
            size="sm"
            className="rounded-2xl gap-2 text-xs font-bold shadow-md shadow-primary/20"
          >
            <Plus className="size-4" />
            <span>رفع PDF جديد</span>
          </Button>
        </div>
      </div>

      {/* SEARCH INPUT BAR */}
      {isSearchOpen && (
        <div className="p-4 rounded-2xl border bg-muted/40 space-y-3 animate-in fade-in">
          <div className="relative">
            <Search className="absolute right-3.5 top-3 size-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن كلمة، مصطلح، أو قانون عبر كافة ملفات الـ PDF المرفوعة..."
              className="pr-10 h-10 rounded-xl bg-card text-xs font-bold"
            />
          </div>

          {searchQuery.trim().length >= 2 && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-muted-foreground">
                نتائج البحث عن "{searchQuery}": {isSearching ? "جارٍ البحث..." : `${searchResults?.length || 0} نتائج`}
              </p>
              {searchResults && searchResults.length > 0 ? (
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {searchResults.map((res) => (
                    <div
                      key={res.id}
                      onClick={() => {
                        const target = pdfs?.find((p) => p.id === res.id);
                        if (target) setSelectedPdf(target);
                      }}
                      className="p-3 rounded-xl border bg-card hover:bg-muted cursor-pointer text-xs space-y-1 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-primary flex items-center gap-1.5">
                          <FileText className="size-3.5" /> {res.fileName}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{res.subject}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono leading-relaxed bg-muted/50 p-2 rounded-lg border">
                        {res.snippet}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                !isSearching && (
                  <p className="text-xs text-muted-foreground py-2 text-center">لم يتم العثور على مطابقات لهذا النص.</p>
                )
              )}
            </div>
          )}
        </div>
      )}

      {/* UPLOAD FORM MODAL / PANEL */}
      {isUploading && (
        <form onSubmit={handleSubmit} className="p-5 rounded-3xl border bg-card space-y-4 shadow-lg animate-in fade-in">
          <div className="flex items-center justify-between border-b pb-3">
            <h4 className="font-bold text-sm flex items-center gap-2">
              <Upload className="size-4 text-primary" />
              <span>رفع أو ربط ملف PDF جديد</span>
            </h4>
            <button type="button" onClick={() => setIsUploading(false)} className="text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">اسم المستند/الملف الدراسية *</label>
              <Input
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="مثال: مذكرة الفيزياء - الفصل الأول"
                required
                className="h-10 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">المادة الدراسية</label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="مثال: فيزياء، أحياء، رياضيات"
                className="h-10 rounded-xl text-xs"
              />
            </div>
          </div>

          {/* DRAG & DROP / FILE INPUT */}
          <div className="border-2 border-dashed border-border/80 hover:border-primary/50 p-6 rounded-2xl text-center space-y-2 bg-muted/20 transition-all">
            <Upload className="size-8 mx-auto text-primary opacity-80" />
            <p className="text-xs font-bold text-foreground">اختر ملف PDF من جهازك أو اسحبه هنا</p>
            <p className="text-[11px] text-muted-foreground">يدعم ملفات الكتب، المذكرات، وتفريغات المحاضرات</p>
            <input
              type="file"
              accept=".pdf,.txt,.md"
              onChange={handleFileUpload}
              className="hidden"
              id="pdf-file-input"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => document.getElementById("pdf-file-input")?.click()}
              className="rounded-xl text-xs font-bold"
            >
              {fileBase64 ? "تم إرفاق الملف ✅ (تغيير)" : "تصفح الملفات"}
            </Button>
          </div>

          {/* OPTIONAL URL OR RAW TEXT */}
          <div className="space-y-2 pt-2 border-t">
            <label className="text-xs font-bold text-muted-foreground">أو وضع رابط مباشر / Google Drive / لصق نص:</label>
            <Input
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              placeholder="https://drive.google.com/file/d/..."
              className="h-9 rounded-xl text-xs font-mono"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsUploading(false)} className="rounded-xl text-xs font-bold">
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={isProcessing}
              className="rounded-xl text-xs font-bold gap-2 shadow-lg shadow-primary/20"
            >
              <Sparkles className="size-4" />
              <span>{isProcessing ? "جارٍ تحويل وقراءة الـ PDF بالذكاء الاصطناعي..." : "تحويل وفهرسة الملف (+25 Coins)"}</span>
            </Button>
          </div>
        </form>
      )}

      {/* PDF LIST & VIEWER GRID */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* PDF CARDS LIST (5 Cols) */}
        <div className="lg:col-span-5 space-y-3">
          <h4 className="font-extrabold text-xs text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span>الملفات المرفوعة ({pdfs?.length || 0})</span>
            <span className="text-primary text-[10px]">انقر للعرض والتلخيص</span>
          </h4>

          {isLoading ? (
            <div className="py-8 text-center text-xs text-muted-foreground">جارٍ تحميل قائمة الملفات...</div>
          ) : pdfs && pdfs.length > 0 ? (
            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
              {pdfs.map((pdf) => {
                const isSelected = selectedPdf?.id === pdf.id;
                return (
                  <div
                    key={pdf.id}
                    onClick={() => setSelectedPdf(pdf)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                      isSelected
                        ? "bg-primary/10 border-primary/50 shadow-md"
                        : "bg-card hover:bg-muted/40 border-border"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex size-8 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:text-red-400">
                          <FileText className="size-4" />
                        </div>
                        <div>
                          <h5 className="font-bold text-xs text-foreground leading-snug">{pdf.fileName}</h5>
                          <span className="text-[10px] text-muted-foreground">{pdf.subject}</span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePdfMutation.mutate({ pdfId: pdf.id });
                        }}
                        className="text-muted-foreground hover:text-red-500 p-1 rounded-lg hover:bg-muted"
                        title="حذف الملف"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                      <span>حجم النص: {(pdf.characterCount / 1000).toFixed(1)}k حرف</span>
                      <span className="text-primary font-bold flex items-center gap-1">
                        <Eye className="size-3" /> عرض واستخراج
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 border-2 border-dashed rounded-3xl text-center space-y-3 bg-muted/10">
              <FileSearch className="size-10 mx-auto text-muted-foreground opacity-60" />
              <p className="text-xs font-bold text-foreground">لا توجد ملفات PDF مرفوعة بعد</p>
              <p className="text-[11px] text-muted-foreground">قم برفع كتابك أو مذكرتك الدراسية لاستخراج نصوصها وتلخيصها فوراً.</p>
              <Button onClick={() => setIsUploading(true)} size="sm" className="rounded-2xl text-xs font-bold">
                رفع أول ملف PDF
              </Button>
            </div>
          )}
        </div>

        {/* SELECTED PDF CONTENT & AI SUMMARIZER (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {selectedPdf ? (
            <div className="p-5 rounded-3xl border bg-card space-y-5 animate-in fade-in">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h4 className="font-extrabold text-sm flex items-center gap-2 text-foreground">
                    <FileText className="size-4 text-primary" />
                    <span>{selectedPdf.fileName}</span>
                  </h4>
                  <p className="text-[11px] text-muted-foreground">المادة: {selectedPdf.subject || "عام"}</p>
                </div>

                <Button
                  onClick={() => summarizePdfMutation.mutate({ pdfId: selectedPdf.id, customPrompt })}
                  disabled={summarizePdfMutation.isPending}
                  size="sm"
                  className="rounded-2xl text-xs font-bold gap-1.5 shadow-md shadow-primary/20 bg-gradient-to-r from-primary to-indigo-600"
                >
                  <Sparkles className="size-3.5" />
                  <span>{summarizePdfMutation.isPending ? "جارٍ التلخيص..." : "إعادة التلخيص بالـ AI"}</span>
                </Button>
              </div>

              {/* SUMMARY RESULT TABS / DISPLAY */}
              {selectedPdf.summaryJson && (
                <div className="space-y-4 p-4 rounded-2xl border bg-gradient-to-br from-primary/5 via-card to-card">
                  <h5 className="font-black text-xs text-primary flex items-center gap-1.5 border-b pb-2">
                    <Brain className="size-4" /> الخلاصة الدراسية الذكية (AI Study Summary)
                  </h5>

                  <p className="text-xs font-medium leading-relaxed text-foreground bg-card/80 p-3 rounded-xl border">
                    {selectedPdf.summaryJson.summary}
                  </p>

                  {/* KEY CONCEPTS */}
                  {selectedPdf.summaryJson.keyConcepts?.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-bold text-muted-foreground">المفاهيم والقوانين المفتاحية:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedPdf.summaryJson.keyConcepts.map((concept: string, idx: number) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 rounded-xl bg-card border text-[11px] font-bold text-primary"
                          >
                            💡 {concept}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* EXAM TAKEAWAYS */}
                  {selectedPdf.summaryJson.takeaways?.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400">نقاط تركيز الامتحانات (Takeaways):</p>
                      <ul className="space-y-1 text-xs list-disc list-inside text-foreground">
                        {selectedPdf.summaryJson.takeaways.map((take: string, idx: number) => (
                          <li key={idx} className="leading-snug">
                            {take}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* QUICK QUIZ */}
                  {selectedPdf.summaryJson.quickQuiz?.length > 0 && (
                    <div className="space-y-2 pt-2 border-t">
                      <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">سؤال مراجعة سريع من المستند:</p>
                      {selectedPdf.summaryJson.quickQuiz.map((q: any, idx: number) => (
                        <div key={idx} className="p-2.5 rounded-xl border bg-card text-xs space-y-1">
                          <p className="font-extrabold text-foreground">س: {q.q}</p>
                          <p className="text-[11px] text-muted-foreground">ج: {q.a}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* CUSTOM AI PROMPT */}
              <div className="flex items-center gap-2">
                <Input
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="طلب تلخيص خاص (مثال: استخرج القوانين فقط، أو لخص في نقاط)..."
                  className="h-9 text-xs rounded-xl"
                />
                <Button
                  onClick={() => summarizePdfMutation.mutate({ pdfId: selectedPdf.id, customPrompt })}
                  disabled={summarizePdfMutation.isPending}
                  size="sm"
                  variant="outline"
                  className="rounded-xl text-xs font-bold shrink-0"
                >
                  تنفيذ
                </Button>
              </div>

              {/* EXTRACTED FULL TEXT VIEW */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-xs text-muted-foreground">النص المستخرج الكامل (Searchable Text):</h5>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedPdf.extractedText || "");
                      toast.success("تم نسخ النص المستخرج إلى الحافظة!");
                    }}
                    className="text-[11px] text-primary flex items-center gap-1 hover:underline font-bold"
                  >
                    <Copy className="size-3" /> نسخ النص
                  </button>
                </div>

                <div className="p-4 rounded-2xl border bg-muted/20 text-xs leading-relaxed text-foreground max-h-72 overflow-y-auto whitespace-pre-wrap font-sans">
                  {selectedPdf.extractedText}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-24 border-2 border-dashed rounded-3xl text-center space-y-3 bg-muted/10">
              <BookOpen className="size-12 mx-auto text-primary opacity-50" />
              <p className="text-sm font-bold text-foreground">اختر ملف PDF من القائمة الجانبية</p>
              <p className="text-xs text-muted-foreground">سيظهر هنا النص المستخرج كاملاً مع التلخيص الذكي والأسئلة الامتحانية.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
