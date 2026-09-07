import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, FileText, Upload, CheckCircle2, Lightbulb, HelpCircle, BookOpen, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

export default function PageSummarizer() {
  const [title, setTitle] = useState("");
  const [contentText, setContentText] = useState("");
  const [imageBase64, setImageBase64] = useState<string | undefined>(undefined);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [result, setResult] = useState<any>(null);

  const summarizeMutation = trpc.summarizer.summarizeAI.useMutation({
    onSuccess: (data) => {
      setResult(data);
      toast.success("تم تلخيص واستخراج النقاط الهامة بنجاح! (+20 Coins)");
    },
    onError: (e) => toast.error(e.message || "حدث خطأ أثناء التلخيص."),
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("حجم الصورة كبير جداً. اختر صورة أقل من 5 ميجابايت.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(",")[1];
      setImageBase64(base64String);
      setImagePreview(reader.result as string);
      toast.success("تم رفع صورة كتابك/ملاحظتك بنجاح.");
    };
    reader.readAsDataURL(file);
  };

  const handleSummarize = () => {
    if (!title.trim()) {
      toast.error("يرجى كتابة عنوان المادة أو الدرس.");
      return;
    }
    if (!contentText.trim() && !imageBase64) {
      toast.error("يرجى إما كتابة النص أو رفع صورة لصفحة الكتاب.");
      return;
    }
    summarizeMutation.mutate({ title, contentText, imageBase64 });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="المستخرج والملخص الذكي (AI Page & Note Summarizer)"
        description="ارفع صورة صفحة كتابك أو انسخ النص، وسيقوم الذكاء الاصطناعي بتلخيص الأفكار الرئيسية، القوانين، وأسئلة المراجعة فوراً."
      />

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Input Form */}
        <div className="lg:col-span-5 space-y-5">
          <div className="surface p-6 rounded-3xl border border-border/80 space-y-4">
            <div className="flex items-center gap-3 border-b pb-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileText className="size-5" />
              </div>
              <div>
                <h2 className="font-bold">إدخال محتوى الصفحة / الملاحظة</h2>
                <p className="text-xs text-muted-foreground">صورة أو نص، والذكاء الاصطناعي يتكفل بالباقي.</p>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">عنوان المادة / الفصل *</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: كيمياء العناصر الانتقالية - صفحة 45"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">رفع صورة صفحة من الكتاب / المذكرة</label>
              <div className="flex items-center gap-3">
                <label className="flex-1 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-4 cursor-pointer hover:bg-primary/10 transition-all text-xs font-bold text-primary">
                  <Upload className="size-4" />
                  <span>{imagePreview ? "تغيير صورة الكتاب" : "اختر صورة الكتاب / الملاحظة"}</span>
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
              </div>
              {imagePreview && (
                <div className="mt-2 relative rounded-xl overflow-hidden border border-border h-32">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">أو انسخ النص هنا</label>
              <Textarea
                rows={5}
                value={contentText}
                onChange={(e) => setContentText(e.target.value)}
                placeholder="ضع النص الذي تريد تلخيصه..."
                className="leading-6"
              />
            </div>

            <Button
              disabled={summarizeMutation.isPending || !title.trim() || (!contentText.trim() && !imageBase64)}
              onClick={handleSummarize}
              className="w-full h-12 rounded-2xl gap-2 font-bold text-base shadow-md shadow-primary/20"
            >
              <Sparkles className="size-5" />
              <span>{summarizeMutation.isPending ? "جارٍ التلخيص والاستخراج…" : "استخراج وتلخيص الصفحة (+20 Coins)"}</span>
            </Button>
          </div>
        </div>

        {/* AI Output Display */}
        <div className="lg:col-span-7 space-y-5">
          {result ? (
            <div className="surface p-6 rounded-3xl border border-primary/30 space-y-5 shadow-md">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-bold text-lg flex items-center gap-2 text-primary">
                  <BookOpen className="size-5" /> التلخيص والأفكار المستخرجة: {title}
                </h3>
              </div>

              {/* Summary */}
              {result.summary && (
                <div className="space-y-1">
                  <p className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="size-4 text-primary" /> الملخص الشامل:
                  </p>
                  <p className="text-sm leading-7 text-foreground bg-muted/40 p-4 rounded-2xl border">{result.summary}</p>
                </div>
              )}

              {/* Key Concepts */}
              {result.keyConcepts && result.keyConcepts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-primary flex items-center gap-1.5">
                    <CheckCircle2 className="size-4" /> المفاهيم الرئيسية المستخرجة:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {result.keyConcepts.map((concept: string, idx: number) => (
                      <span key={idx} className="rounded-xl bg-primary/10 border border-primary/20 px-3 py-1.5 text-xs font-bold text-primary">
                        {concept}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Takeaways / Laws */}
              {result.takeaways && result.takeaways.length > 0 && (
                <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 space-y-1.5">
                  <p className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                    <Lightbulb className="size-4" /> قوانين ونقاط موضع امتحانات:
                  </p>
                  <ul className="list-disc list-inside text-xs leading-6 text-foreground space-y-1 mr-2">
                    {result.takeaways.map((item: string, idx: number) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Quick Review Quiz */}
              {result.quickQuiz && result.quickQuiz.length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <HelpCircle className="size-4" /> أسئلة مراجعة سريعة للحفظ:
                  </p>
                  <div className="space-y-2">
                    {result.quickQuiz.map((item: any, idx: number) => (
                      <div key={idx} className="p-3 rounded-xl bg-card border text-xs leading-5">
                        <p className="font-bold text-foreground mb-0.5">س{idx + 1}: {item.q}</p>
                        <p className="text-emerald-700 dark:text-emerald-300 font-medium">جـ: {item.a}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="surface p-8 rounded-3xl border border-dashed border-border text-center space-y-3">
              <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <ImageIcon className="size-6" />
              </div>
              <h3 className="font-bold">جاهز لاستخراج وتلخيص مذكراتك؟</h3>
              <p className="text-xs text-muted-foreground leading-5">
                ارفع صورة أو ضع النص على اليسار وسيقوم الذكاء الاصطناعي بتنظيفه، تلخيصه، واستخراج أهم نقاط الامتحانات.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
