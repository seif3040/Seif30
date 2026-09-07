import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Split, CheckSquare, Clock, Lightbulb, ArrowRight, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export default function TaskDecomposer() {
  const [bigTaskTitle, setBigTaskTitle] = useState("");
  const [detailsText, setDetailsText] = useState("");
  const [decomposedData, setDecomposedData] = useState<any>(null);
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});

  const decomposeMutation = trpc.decomposer.decomposeAI.useMutation({
    onSuccess: (data) => {
      setDecomposedData(data);
      setCompletedSteps({});
      toast.success("تم تفتيك المهمة الكبرى إلى خطوات صغيرة قابلة للتنفيذ! (+20 Coins)");
    },
    onError: (e) => toast.error(e.message || "حدث خطأ أثناء تفتيت المهمة."),
  });

  const handleDecompose = () => {
    if (!bigTaskTitle.trim()) {
      toast.error("يرجى إدخال عنوان المهمة أو الباب الكبيرة.");
      return;
    }
    decomposeMutation.mutate({ bigTaskTitle, detailsText });
  };

  const toggleStep = (stepNum: number) => {
    setCompletedSteps((prev) => ({ ...prev, [stepNum]: !prev[stepNum] }));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="مفكك المهام والدروس الصعبة (AI Task Decomposer)"
        description="حين تفتت المهمة أو الفصل الصعب إلى خطوات 15 دقيقة، يختفي التسويف وتسهل البداية."
      />

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Form Panel */}
        <div className="lg:col-span-5 space-y-4">
          <div className="surface p-6 rounded-3xl border border-border/80 space-y-4">
            <div className="flex items-center gap-3 border-b pb-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Split className="size-5" />
              </div>
              <div>
                <h2 className="font-bold">تفتيت مهمة كبرى</h2>
                <p className="text-xs text-muted-foreground">اكتب عنوان الباب أو الهدف الثقيل.</p>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">المهمة الكبرى / الفصل الصعب *</label>
              <Input
                value={bigTaskTitle}
                onChange={(e) => setBigTaskTitle(e.target.value)}
                placeholder="مثال: مذاكرة الباب الثالث كيمياء عضوية كامل ومراجعة حلوله"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">تفاصيل أو ملاحظات إضافية</label>
              <Textarea
                rows={4}
                value={detailsText}
                onChange={(e) => setDetailsText(e.target.value)}
                placeholder="تفاصيل المحتوى، الملازم، أو نقاط ضعفك فيه..."
                className="leading-6"
              />
            </div>

            <Button
              disabled={decomposeMutation.isPending || !bigTaskTitle.trim()}
              onClick={handleDecompose}
              className="w-full h-12 rounded-2xl gap-2 font-bold shadow-md shadow-primary/20"
            >
              <Sparkles className="size-5" />
              <span>{decomposeMutation.isPending ? "جارٍ التفتيت والتقسيم..." : "تفتيت المهمة فوراً (+20 Coins)"}</span>
            </Button>
          </div>
        </div>

        {/* Output Panel */}
        <div className="lg:col-span-7 space-y-4">
          {decomposedData?.steps ? (
            <div className="surface p-6 rounded-3xl border border-primary/30 space-y-5">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="font-bold text-lg text-primary">{decomposedData.title}</h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock className="size-3.5" /> الوقت المقدر الإجمالي: {decomposedData.estimatedTotalMinutes} دقيقة
                  </p>
                </div>

                <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold px-3 py-1 rounded-full text-xs">
                  <ShieldCheck className="size-4" /> {decomposedData.steps.length} خطوات مصغرة
                </span>
              </div>

              <div className="space-y-3">
                {decomposedData.steps.map((step: any) => {
                  const isDone = Boolean(completedSteps[step.stepNumber]);

                  return (
                    <div
                      key={step.stepNumber}
                      onClick={() => toggleStep(step.stepNumber)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        isDone
                          ? "bg-emerald-500/10 border-emerald-500/30 opacity-75"
                          : "bg-card hover:border-primary/40 shadow-xs"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg border ${
                            isDone ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted-foreground/40"
                          }`}
                        >
                          {isDone && <CheckSquare className="size-4" />}
                        </div>

                        <div className="space-y-1 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className={`font-bold text-sm ${isDone ? "line-through text-muted-foreground" : ""}`}>
                              الخطوة {step.stepNumber}: {step.title}
                            </h4>
                            <span className="text-[10px] font-extrabold bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                              {step.estimatedMinutes} دقيقة
                            </span>
                          </div>

                          {step.advice && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 leading-5 pt-1">
                              <Lightbulb className="size-3.5 text-amber-500 shrink-0" />
                              <span>{step.advice}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="surface p-12 rounded-3xl border border-dashed border-border text-center space-y-3">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Split className="size-7" />
              </div>
              <h3 className="font-bold text-base">لا تدع المهام الثقيلة تجعلك تسوّف</h3>
              <p className="text-xs text-muted-foreground leading-5 max-w-md mx-auto">
                أدخل اسم الباب أو الدرس الطويل وسيقوم الذكاء الاصطناعي بتحويله إلى خطوات مدة كل منها 15 دقيقة فقط لتنتهي منها بسهولة وسرعة.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
