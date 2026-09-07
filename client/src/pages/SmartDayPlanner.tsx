import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CalendarDays,
  Sparkles,
  Clock,
  Building2,
  Laptop,
  Bus,
  BookOpen,
  Coffee,
  CheckCircle2,
  Lightbulb,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

export default function SmartDayPlanner() {
  const [wakeTime, setWakeTime] = useState("07:00");
  const [centerDetails, setCenterDetails] = useState("");
  const [travelMinutes, setTravelMinutes] = useState(30);
  const [onlinePlatformsList, setOnlinePlatformsList] = useState("");
  const [targetSubjects, setTargetSubjects] = useState("");
  const [planData, setPlanData] = useState<any>(null);

  const generateMutation = trpc.smartDayPlanner.generateAI.useMutation({
    onSuccess: (data) => {
      setPlanData(data);
      toast.success("تم تخطيط يومك الهجين بنجاح! جاهز للتنفيذ. (+25 Coins)");
    },
    onError: (e) => toast.error(e.message || "حدث خطأ أثناء تخطيط اليوم."),
  });

  const handleGenerate = () => {
    generateMutation.mutate({
      wakeTime,
      centerDetails,
      travelMinutes,
      onlinePlatformsList,
      targetSubjects,
    });
  };

  const getSlotBadge = (type: string) => {
    switch (type) {
      case "center":
        return {
          label: "سنتر حضوري",
          icon: Building2,
          color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
        };
      case "online":
        return {
          label: "منصة أونلاين خارجية",
          icon: Laptop,
          color: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30",
        };
      case "travel":
        return {
          label: "مواصلات ونزول",
          icon: Bus,
          color: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
        };
      case "break":
        return {
          label: "استراحة / وجبة",
          icon: Coffee,
          color: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30",
        };
      default:
        return {
          label: "مذاكرة وتطبيق",
          icon: BookOpen,
          color: "bg-primary/10 text-primary border-primary/30",
        };
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="مخطط اليوم المثالي بالذكاء الاصطناعي (AI Smart Day Planner)"
        description="هندسة زمنية دقيقة لليوم توازن بين السنتر والمواصلات والمنصات التعليمية الخارجية والمذاكرة الفردية."
      />

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Input Configuration Panel */}
        <div className="lg:col-span-5 space-y-4">
          <div className="surface p-6 rounded-3xl border border-border/80 space-y-4">
            <div className="flex items-center gap-3 border-b pb-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CalendarDays className="size-5" />
              </div>
              <div>
                <h2 className="font-bold">مدخلات يومك اليوم</h2>
                <p className="text-xs text-muted-foreground">أدخل تفاصيل اليوم لجدولته بالساعة.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1 block">ميعاد الاستيقاظ *</label>
                <Input type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} />
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1 block">وقت المواصلات (دقائق)</label>
                <Input type="number" value={travelMinutes} onChange={(e) => setTravelMinutes(Number(e.target.value))} min={0} max={180} />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">مواعيد السنتر والنزول اليوم (إن وجد)</label>
              <Input
                value={centerDetails}
                onChange={(e) => setCenterDetails(e.target.value)}
                placeholder="مثال: سنتر النور كيمياء من 10 إلى 12 ظهرًا"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">محاضرات المنصات الخارجية المراد مشاهدتها اليوم</label>
              <Textarea
                rows={2}
                value={onlinePlatformsList}
                onChange={(e) => setOnlinePlatformsList(e.target.value)}
                placeholder="مثال: منصة أبواب - فيزياء حث كهرومغناطيسي، منصة حصص - لغة عربية"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">مهام المذاكرة وحل الشيتات المستهدفة</label>
              <Textarea
                rows={2}
                value={targetSubjects}
                onChange={(e) => setTargetSubjects(e.target.value)}
                placeholder="مثال: حل شيت الكيمياء، مراجعة كلمات اللغة الإنجليزية"
              />
            </div>

            <Button
              disabled={generateMutation.isPending}
              onClick={handleGenerate}
              className="w-full h-12 rounded-2xl gap-2 font-bold shadow-md shadow-primary/20"
            >
              <Sparkles className="size-5" />
              <span>{generateMutation.isPending ? "جارٍ التخطيط والهندسة..." : "توليد جدول اليوم بالساعة (+25 Coins)"}</span>
            </Button>
          </div>
        </div>

        {/* Output Plan Display */}
        <div className="lg:col-span-7 space-y-4">
          {planData?.timeline ? (
            <div className="surface p-6 rounded-3xl border border-primary/30 space-y-5">
              <div className="border-b pb-3 space-y-1">
                <span className="text-xs font-extrabold text-primary flex items-center gap-1">
                  <CheckCircle2 className="size-4" /> الخطة الزمنية المقترحة لليوم
                </span>
                <p className="text-sm font-bold leading-6">{planData.daySummary}</p>
                <span className="text-xs text-muted-foreground block">
                  إجمالي ساعات الدراسة الصافية: <strong>{planData.totalStudyHours} ساعات</strong>
                </span>
              </div>

              {/* Hourly Timeline */}
              <div className="space-y-3">
                {planData.timeline.map((slot: any, idx: number) => {
                  const badge = getSlotBadge(slot.type);
                  const Icon = badge.icon;

                  return (
                    <div key={idx} className="p-4 rounded-2xl border bg-card flex items-start gap-3 shadow-xs">
                      <div className="shrink-0 font-mono font-extrabold text-xs bg-muted px-2.5 py-1 rounded-xl text-primary mt-0.5">
                        {slot.timeSlot}
                      </div>

                      <div className="space-y-1 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-bold text-sm leading-5">{slot.activity}</h4>
                          <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${badge.color}`}>
                            <Icon className="size-3" /> {badge.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pro tips */}
              {planData.proTips && planData.proTips.length > 0 && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 text-xs space-y-2">
                  <span className="font-bold flex items-center gap-1.5">
                    <Lightbulb className="size-4 text-amber-500" /> نصائح استغلال الوقت والمنصات الخارجية:
                  </span>
                  <ul className="list-disc list-inside space-y-1 leading-5">
                    {planData.proTips.map((tip: string, tIdx: number) => (
                      <li key={tIdx}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="surface p-12 rounded-3xl border border-dashed border-border text-center space-y-3">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Clock className="size-7" />
              </div>
              <h3 className="font-bold text-base">لا تترك يومك للعشوائية والتشتت</h3>
              <p className="text-xs text-muted-foreground leading-5 max-w-md mx-auto">
                أدخل موعد استيقاظك ودروس السنتر اليوم والمنصات الخارجية، وسيولد لك الذكاء الاصطناعي جدولا دقيقا بالساعة للجمع بين السنتر والأونلاين بدون إرهاق.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
