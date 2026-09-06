import { useEffect, useRef, useState } from "react";
import type { Message } from "@/components/AIChatBox";
import { SeifyVoiceControl } from "@/components/SeifyVoiceControl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { errorText } from "@/lib/study";
import { trpc } from "@/lib/trpc";
import { useArabicVoice } from "@/hooks/useArabicVoice";
import { Bot, Check, ChevronDown, Compass, Mic, ShieldCheck, Sparkles, Volume2, VolumeX, X } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const routeLabels: Record<string, string> = { "/tasks": "المهام", "/habits": "العادات", "/goals": "الأهداف", "/study-plan": "خطة المذاكرة", "/exams": "الامتحانات", "/pomodoro": "Pomodoro", "/notebooks": "NotebookLM (جوجل)", "/analytics": "التحليلات" };
type Plan = { reply: string; actionType: string; title: string; targetTitle: string; priority: "urgent" | "medium" | "low"; scheduledFor: string; frequency: "daily" | "weekly"; target: number; route: string; requiresConfirmation: boolean };

function ActionPreview({ plan, onConfirm, onNavigate, loading }: { plan: Plan; onConfirm: () => void; onNavigate: () => void; loading: boolean }) {
  if (plan.actionType === "none") return null;
  const isNavigation = plan.actionType === "navigate"; const isDelete = plan.actionType.startsWith("delete"); const isEdit = plan.actionType.startsWith("update"); const isReschedule = plan.actionType === "reschedule_task"; const isPriority = plan.actionType === "reprioritize_task";
  const label = isNavigation ? `افتح ${routeLabels[plan.route] ?? "الصفحة"}` : isDelete ? `حذف «${plan.title}»` : isReschedule ? `نقل «${plan.targetTitle}» ليوم ${plan.scheduledFor}` : isPriority ? `تغيير أولوية «${plan.targetTitle}»` : isEdit ? `تعديل «${plan.targetTitle}» إلى «${plan.title}»` : `إضافة «${plan.title}»`;
  const detail = isNavigation ? "هتتنقل للصفحة دي من غير ما يتغير أي بيانات." : isDelete ? "هتتشال نهائيًا من المنصة. راجع الاسم قبل التأكيد." : isReschedule ? "الموعد الجديد مش هيتسجل غير بعد التأكيد." : isPriority ? `هتتغير الأولوية لـ ${plan.priority === "urgent" ? "مهم" : plan.priority === "low" ? "خفيف" : "متوسط"} بعد التأكيد.` : isEdit ? "التعديل هيحصل بعد ما تأكد، والبيانات التانية هتفضل زي ما هي." : "هتتضاف لحسابك بعد ما تأكد.";
  return <div className={cn("mt-3 rounded-2xl border p-3 text-sm", isDelete ? "border-amber-200 bg-amber-50 text-amber-950" : "border-primary/20 bg-primary/5")}><div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" /><div className="min-w-0 flex-1"><p className="font-bold">{label}</p><p className="mt-1 text-xs leading-5 opacity-80">{detail}</p></div></div><Button size="sm" className="mt-3 w-full" variant={isDelete ? "destructive" : "default"} disabled={loading} onClick={isNavigation ? onNavigate : onConfirm}>{isNavigation ? <><Compass />افتح الصفحة</> : <><Check />{loading ? "بيتنفّذ…" : "أيوه نفّذها"}</>}</Button></div>;
}

export function PersonalAssistantConversation({ height = "560px", brief }: { height?: string; brief?: string | null }) {
  const utils = trpc.useUtils(); const [, navigate] = useLocation(); const [messages, setMessages] = useState<Message[]>([]); const [plan, setPlan] = useState<Plan | null>(null); const [voiceEnabled, setVoiceEnabled] = useState(true); const hydrated = useRef(false);
  const { voices, selectedVoiceURI, chooseVoice, speak } = useArabicVoice();
  const memory = trpc.personalAssistant.memory.useQuery();
  useEffect(() => { if (!hydrated.current && memory.data) { setMessages(memory.data.map(message => ({ role: message.role, content: message.content }))); hydrated.current = true; } }, [memory.data]);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  const say = (content: string) => { if (!voiceEnabled) return; const result = speak(content); if (!result.played) toast.error(result.message); };
  const execute = trpc.personalAssistant.execute.useMutation({ onSuccess: async result => { setMessages(previous => [...previous, { role: "assistant", content: result.message }]); say(result.message); setPlan(null); await Promise.all([utils.tasks.list.invalidate(), utils.habits.list.invalidate(), utils.goals.list.invalidate(), utils.dashboard.summary.invalidate(), utils.personalAssistant.memory.invalidate()]); toast.success("تمام يا بطل، اتنفّذت."); }, onError: error => toast.error(errorText(error)) });
  const planRequest = trpc.personalAssistant.plan.useMutation({ onSuccess: result => { setMessages(previous => [...previous, { role: "assistant", content: result.reply }]); setPlan(result as Plan); say(result.reply); utils.personalAssistant.memory.invalidate(); }, onError: error => toast.error(errorText(error)) });
  const send = (content: string) => { setMessages(previous => [...previous, { role: "user", content }]); setPlan(null); planRequest.mutate({ request: content }); };
  return (
    <div className="flex flex-col gap-4">
      {brief && (
        <div className="flex items-start gap-3 rounded-3xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
          <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <p className="text-base font-bold">ملخص سيفي لليوم</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{brief}</p>
          </div>
        </div>
      )}

      {/* Voice Selection Panel */}
      <div className="rounded-3xl border border-primary/15 bg-primary/5 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-base font-bold">صوت سيفي</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {voices.length ? "اختار صوت عربي من جهازك" : "مفيش صوت عربي متاح؛ مش هنستخدم صوت بلغة تانية."}
            </p>
          </div>
          <Button
            size="icon"
            variant="outline"
            className="rounded-full shadow-sm"
            aria-label={voiceEnabled ? "إيقاف صوت سيفي" : "تشغيل صوت سيفي"}
            onClick={() => {
              if (voiceEnabled) window.speechSynthesis?.cancel();
              setVoiceEnabled((value) => !value);
            }}
          >
            {voiceEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4 text-muted-foreground" />}
          </Button>
        </div>
        {voices.length > 0 && (
          <select
            aria-label="اختيار صوت سيفي العربي"
            className="mt-3 w-full rounded-2xl border bg-background px-4 py-2.5 text-sm font-medium shadow-sm outline-none focus:ring-2 focus:ring-primary/20"
            value={selectedVoiceURI ?? voices[0]?.voiceURI ?? ""}
            onChange={(event) => chooseVoice(event.target.value)}
          >
            {voices.map((voice) => (
              <option key={voice.voiceURI} value={voice.voiceURI}>
                {voice.name} — {voice.lang}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* The Central Voice Control */}
      <SeifyVoiceControl disabled={planRequest.isPending} onTranscript={send} />

      {/* Latest Subtitles */}
      {messages.length > 0 && (
        <div className="mt-2 flex flex-col gap-3 rounded-3xl border border-border/60 bg-muted/30 p-4 text-center">
          {messages.slice(-2).map((msg, idx) => (
            <p
              key={idx}
              className={cn(
                "text-sm leading-relaxed",
                msg.role === "user" ? "text-muted-foreground italic font-medium" : "text-foreground font-bold text-base"
              )}
            >
              {msg.role === "user" ? `« ${msg.content} »` : msg.content}
            </p>
          ))}
        </div>
      )}

      {/* Pending Action Preview */}
      {plan && (
        <ActionPreview
          plan={plan}
          loading={execute.isPending}
          onConfirm={() => execute.mutate({ plan: plan as any, confirmed: true })}
          onNavigate={() => {
            if (plan.route) navigate(plan.route);
            setPlan(null);
          }}
        />
      )}
    </div>
  );
}

export function PersonalAssistantPanel() {
  const [open, setOpen] = useState(false); const [brief, setBrief] = useState<string | null>(null); const daily = trpc.personalAssistant.dailySummary.useMutation({ onSuccess: summary => { setBrief(summary.content); if (summary.isNew) toast("ملخص سيفي لليوم جاهز", { description: summary.content }); } });
  useEffect(() => { daily.mutate(); }, []);
  return <div className="fixed bottom-4 left-4 z-50 flex flex-col items-start gap-3" dir="rtl">{open && <section className="w-[calc(100vw-2rem)] max-w-[430px] overflow-hidden rounded-3xl border border-primary/20 bg-background shadow-2xl shadow-black/20"><header className="flex items-center justify-between border-b bg-gradient-to-l from-primary/15 via-primary/5 to-transparent p-4"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Sparkles className="size-5" /></span><div><p className="font-bold">سيفي — مساعدك الصوتي</p><p className="text-xs text-muted-foreground">قولّي عايز تعمل إيه</p></div></div><Button size="icon" variant="ghost" className="rounded-xl" aria-label="إغلاق المساعد" onClick={() => setOpen(false)}><X className="size-4" /></Button></header><div className="p-3"><PersonalAssistantConversation height="min(45vh, 390px)" brief={brief} /></div></section>}<Button aria-label={open ? "تصغير مساعد سيفي" : "فتح مساعد سيفي"} onClick={() => setOpen(value => !value)} className="group h-14 rounded-2xl px-4 shadow-xl shadow-primary/25"><Mic className="size-5 transition-transform group-hover:scale-110" /><span className="font-bold">{open ? "صغّر سيفي" : "كلم سيفي"}</span><ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} /></Button></div>;
}

export function PersonalAssistantWorkspace() {
  return (
    <div className="grid gap-4 xl:grid-cols-[.34fr_1fr]">
      <aside className="surface bg-gradient-to-b from-primary/10 via-background to-background p-6 rounded-3xl border border-primary/20">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Mic />
          </span>
          <div>
            <h2 className="text-xl font-extrabold">أنا سيفي، اتكلم معايا</h2>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 inline-block mt-0.5">
              مجاني 100% بدون أي رسوم
            </span>
          </div>
        </div>
        <p className="mt-4 text-sm leading-7 text-muted-foreground">
          دوس على المايك أو اكتب طلبك، احكي بالمصري وأنا هرد عليك بصوت عربي. هساعدك تنظم مذاكرتك، أضيف وأعدل مهامك وعاداتك، وأشرح لك أي مسألة أو استفسار دراسي محتاجه.
        </p>
        <div className="mt-5 rounded-2xl border border-primary/15 bg-background/70 p-4 text-sm space-y-2">
          <p className="font-bold text-primary text-xs">أمثلة تقدر تطلبها مني:</p>
          <ul className="text-xs leading-6 text-muted-foreground list-disc list-inside space-y-1">
            <li>«ضيف مهمة حل واجب الكيمياء بكرة»</li>
            <li>«خلّي أولوية المراجعة مهمة»</li>
            <li>«ضيف عادة قراءة ملخص كل يوم»</li>
            <li>«اشرح لي قانون أوم في الفيزياء»</li>
            <li>«أعمل إيه لما أفقد الشغف في المذاكرة؟»</li>
          </ul>
        </div>
      </aside>
      <PersonalAssistantConversation height="min(68vh, 700px)" />
    </div>
  );
}
