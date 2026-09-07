import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import {
  Upload,
  FileText,
  Sparkles,
  Brain,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  RotateCw,
  FolderPlus,
  Copy,
  Layers,
  Zap,
  HelpCircle,
  FileUp,
  Download,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Flashcard {
  prompt: string;
  answer: string;
  category?: string;
  importance?: string;
}

interface GeneratedResult {
  deckTitle: string;
  subject: string;
  summary: string;
  flashcards: Flashcard[];
}

export function PdfFlashcardDropzone({ onDeckSaved }: { onDeckSaved?: () => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [rawText, setRawText] = useState<string | null>(null);
  const [subject, setSubject] = useState("عام");
  const [customPrompt, setCustomPrompt] = useState("");

  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const utils = trpc.useContext();

  const generateMutation = trpc.flashcards.generatePdfFlashcards.useMutation({
    onSuccess: (data: any) => {
      setResult(data);
      setCurrentIndex(0);
      setIsFlipped(false);
      toast.success(`تم استخراج ${data.flashcards?.length || 0} بطاقة استذكار ذكية بنجاح! 🎴`);
    },
    onError: (err) => {
      toast.error(err.message || "حدث خطأ أثناء قراءة الـ PDF وتوليد الفلاش كاردز.");
    },
  });

  const saveMutation = trpc.flashcards.savePdfFlashcards.useMutation({
    onSuccess: (data) => {
      utils.flashcards.list.invalidate();
      toast.success(`تم حفظ المجموعة في حسابك بنجاح! كسبت +30 Coins 🏆`);
      if (onDeckSaved) onDeckSaved();
    },
    onError: (err) => {
      toast.error(err.message || "تعذر حفظ الفلاش كاردز.");
    },
  });

  const handleFileProcess = useCallback((selectedFile: File) => {
    setFile(selectedFile);
    setResult(null);

    const reader = new FileReader();
    if (selectedFile.type === "application/pdf" || selectedFile.name.toLowerCase().endsWith(".pdf")) {
      reader.readAsDataURL(selectedFile);
      reader.onload = () => {
        const res = reader.result as string;
        const b64 = res.split(",")[1];
        setFileBase64(b64);
        setRawText(null);
        toast.info(`تم تحميل "${selectedFile.name}" وجاهز للاستخراج بالذكاء الاصطناعي.`);
      };
    } else {
      reader.readAsText(selectedFile);
      reader.onload = () => {
        setRawText(reader.result as string);
        setFileBase64(null);
        toast.info(`تم تحميل نص "${selectedFile.name}".`);
      };
    }
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileProcess(files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileProcess(e.target.files[0]);
    }
  };

  const handleGenerate = () => {
    if (!file && !rawText && !fileBase64) {
      toast.error("يرجى سحب وإسقاط ملف PDF أولاً.");
      return;
    }

    generateMutation.mutate({
      fileName: file?.name || "مستند دراسي",
      fileBase64: fileBase64 || undefined,
      rawText: rawText || undefined,
      subject,
      customPrompt: customPrompt.trim() || undefined,
    });
  };

  const filteredCards = result?.flashcards
    ? activeCategory === "all"
      ? result.flashcards
      : result.flashcards.filter((c) => c.category === activeCategory)
    : [];

  const currentCard = filteredCards[currentIndex % Math.max(filteredCards.length, 1)];

  const handleSaveDeck = () => {
    if (!result || !result.flashcards.length) return;
    saveMutation.mutate({
      deckTitle: result.deckTitle || `فلاش كاردز - ${file?.name || "PDF"}`,
      description: result.summary,
      cards: result.flashcards.map((c) => ({ prompt: c.prompt, answer: c.answer })),
    });
  };

  const handleCopyCards = () => {
    if (!result) return;
    const text = result.flashcards
      .map((c, i) => `[${i + 1}] س: ${c.prompt}\n ج: ${c.answer}\n---`)
      .join("\n\n");
    navigator.clipboard.writeText(text);
    toast.success("تم نسخ جميع الفلاش كاردز إلى الحافظة!");
  };

  return (
    <div className="space-y-6">
      {/* DROPZONE AREA */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative overflow-hidden rounded-3xl border-2 border-dashed p-8 text-center transition-all duration-300 ${
          isDragging
            ? "border-primary bg-primary/10 scale-[1.01] shadow-xl"
            : file
            ? "border-emerald-500/50 bg-emerald-500/5 dark:bg-emerald-950/20"
            : "border-primary/30 bg-gradient-to-br from-card via-card to-primary/5 hover:border-primary/60 hover:bg-primary/5"
        }`}
      >
        <input
          type="file"
          accept=".pdf,.txt,.md"
          onChange={handleFileInput}
          className="absolute inset-0 z-10 cursor-pointer opacity-0"
          id="pdf-drop-input"
        />

        <div className="flex flex-col items-center justify-center space-y-4">
          <div
            className={`flex size-16 items-center justify-center rounded-3xl text-white shadow-lg transition-transform ${
              file
                ? "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30"
                : "bg-gradient-to-br from-primary to-violet-600 shadow-primary/30"
            }`}
          >
            {file ? <FileText className="size-8 animate-bounce" /> : <FileUp className="size-8" />}
          </div>

          <div>
            <h3 className="text-lg font-black text-foreground">
              {file ? `الملف المختار: ${file.name}` : "سحب وإسقاط ملف الـ PDF الدراسي هنا"}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              يقوم الذكاء الاصطناعي باستخراج المفاهيم والقوانين والأسئلة وتحويلها فوراً إلى بطاقات استذكار تكرار متباعد.
            </p>
          </div>

          {!file ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-2xl gap-2 text-xs font-bold pointer-events-none"
            >
              <Upload className="size-4" />
              <span>أو اختر ملفاً من جهازك (.pdf, .txt, .md)</span>
            </Button>
          ) : (
            <div className="flex items-center gap-2 pt-1 z-20">
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs font-bold">
                {(file.size / (1024 * 1024)).toFixed(2)} MB • جاهز للاستخراج
              </Badge>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                  setFileBase64(null);
                  setRawText(null);
                  setResult(null);
                }}
                className="text-xs text-destructive hover:underline font-bold"
              >
                تغيير الملف
              </button>
            </div>
          )}
        </div>
      </div>

      {/* OPTIONS & GENERATE TRIGGER */}
      {file && !result && (
        <div className="surface p-5 rounded-3xl border bg-card space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1.5">المادة الدراسية</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-2xl border bg-background px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-primary"
              >
                <option value="عام">عام / مادة متنوعة</option>
                <option value="أحياء">أحياء / علوم حيوية</option>
                <option value="فيزياء">فيزياء</option>
                <option value="كيمياء">كيمياء</option>
                <option value="لغة عربية">لغة عربية</option>
                <option value="لغة إنجليزية">لغة إنجليزية</option>
                <option value="تاريخ">تاريخ / جغرافيا</option>
                <option value="برمجة">برمجة وذكاء اصطناعي</option>
                <option value="رياضيات">رياضيات</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1.5">توجيه خاص للمساعد (اختياري)</label>
              <Input
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="مثال: ركز على أسئلة الامتحانات والتعاريف الشائعة"
                className="rounded-2xl text-xs"
              />
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
            className="w-full rounded-2xl gap-2 font-black text-sm bg-gradient-to-r from-primary via-teal-600 to-emerald-600 hover:opacity-95 shadow-lg shadow-primary/25 h-12"
          >
            <Sparkles className={`size-5 ${generateMutation.isPending ? "animate-spin" : ""}`} />
            <span>
              {generateMutation.isPending
                ? "جارٍ استخراج النصوص وتوليد بطاقات الاستذكار بالذكاء الاصطناعي..."
                : "توليد بطاقات الاستذكار الذكية (Flashcards) من الـ PDF 🚀"}
            </span>
          </Button>
        </div>
      )}

      {/* GENERATED FLASHCARDS VIEWER */}
      {result && result.flashcards && result.flashcards.length > 0 && (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
          {/* HEADER & ACTIONS */}
          <div className="surface p-5 rounded-3xl border bg-gradient-to-br from-card via-card to-primary/5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-primary px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
                  {result.subject} • {result.flashcards.length} بطاقة استذكار
                </span>
                <h3 className="text-lg font-black text-foreground mt-2">{result.deckTitle}</h3>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">{result.summary}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={handleSaveDeck}
                  disabled={saveMutation.isPending}
                  size="sm"
                  className="rounded-2xl gap-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20"
                >
                  <FolderPlus className="size-4" />
                  <span>{saveMutation.isPending ? "جارٍ الحفظ..." : "حفظ في مجموعاتي (+30 Coins)"}</span>
                </Button>

                <Button onClick={handleCopyCards} size="sm" variant="outline" className="rounded-2xl gap-1.5 text-xs font-bold">
                  <Copy className="size-3.5" />
                  <span>نسخ الكروت</span>
                </Button>
              </div>
            </div>

            {/* CATEGORY FILTER CHIPS */}
            <div className="flex items-center gap-2 pt-2 overflow-x-auto no-scrollbar">
              <Filter className="size-3.5 text-muted-foreground shrink-0" />
              <button
                onClick={() => {
                  setActiveCategory("all");
                  setCurrentIndex(0);
                  setIsFlipped(false);
                }}
                className={`text-xs px-3 py-1 rounded-full font-bold transition-colors ${
                  activeCategory === "all"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                الكل ({result.flashcards.length})
              </button>
              {Array.from(new Set(result.flashcards.map((c) => c.category).filter(Boolean))).map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setActiveCategory(cat!);
                    setCurrentIndex(0);
                    setIsFlipped(false);
                  }}
                  className={`text-xs px-3 py-1 rounded-full font-bold transition-colors ${
                    activeCategory === cat
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {cat} ({result.flashcards.filter((c) => c.category === cat).length})
                </button>
              ))}
            </div>
          </div>

          {/* 3D FLIP CARD VIEWER */}
          {currentCard ? (
            <div className="space-y-4">
              <div
                onClick={() => setIsFlipped(!isFlipped)}
                className="group relative cursor-pointer min-h-[280px] w-full rounded-3xl border-2 border-primary/20 bg-gradient-to-br from-card via-card to-primary/10 p-8 shadow-lg transition-all duration-300 hover:border-primary/50 hover:shadow-xl flex flex-col justify-between"
              >
                {/* CARD TOP INFO */}
                <div className="flex items-center justify-between text-xs font-bold">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                      {currentCard.category || "مفهوم"}
                    </Badge>
                    {currentCard.importance && (
                      <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600 dark:text-amber-400">
                        أهمية {currentCard.importance}
                      </Badge>
                    )}
                  </div>
                  <span className="text-muted-foreground">
                    بطاقة {(currentIndex % filteredCards.length) + 1} من {filteredCards.length}
                  </span>
                </div>

                {/* CARD CONTENT */}
                <div className="my-6 text-center space-y-3">
                  <span className="text-xs font-black tracking-widest uppercase text-primary/70">
                    {isFlipped ? "الإجابة والشرح النموذجية (الوجه الثاني)" : "السؤال / المفهوم (انقر للقلب)"}
                  </span>
                  <p className="text-lg md:text-xl font-bold text-foreground leading-relaxed max-w-2xl mx-auto">
                    {isFlipped ? currentCard.answer : currentCard.prompt}
                  </p>
                </div>

                {/* CARD BOTTOM TIP */}
                <div className="flex items-center justify-center gap-2 text-xs text-primary font-bold">
                  <RotateCw className="size-3.5 animate-spin-slow" />
                  <span>انقر في أي مكان لقلب البطاقة</span>
                </div>
              </div>

              {/* CARD CONTROLS */}
              <div className="flex items-center justify-between gap-3">
                <Button
                  disabled={currentIndex === 0}
                  onClick={() => {
                    setCurrentIndex((i) => Math.max(0, i - 1));
                    setIsFlipped(false);
                  }}
                  variant="outline"
                  className="rounded-2xl gap-1 text-xs font-bold"
                >
                  <ChevronRight className="size-4" />
                  <span>السابق</span>
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => {
                      const rand = Math.floor(Math.random() * filteredCards.length);
                      setCurrentIndex(rand);
                      setIsFlipped(false);
                    }}
                    variant="secondary"
                    size="sm"
                    className="rounded-2xl gap-1.5 text-xs font-bold"
                  >
                    <Zap className="size-3.5 text-amber-500" />
                    <span>بطاقة عشوائية</span>
                  </Button>
                </div>

                <Button
                  disabled={currentIndex >= filteredCards.length - 1}
                  onClick={() => {
                    setCurrentIndex((i) => Math.min(filteredCards.length - 1, i + 1));
                    setIsFlipped(false);
                  }}
                  className="rounded-2xl gap-1 text-xs font-bold"
                >
                  <span>التالي</span>
                  <ChevronLeft className="size-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 border border-dashed rounded-3xl text-muted-foreground">
              لا توجد بطاقات تحت التصنيف المختار.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
