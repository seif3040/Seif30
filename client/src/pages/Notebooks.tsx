import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useFirebaseUser } from "@/lib/firebase";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  ExternalLink,
  Sparkles,
  BookOpen,
  Headphones,
  FileText,
  CheckCircle2,
  ShieldCheck,
  ArrowUpRight,
  GraduationCap,
  Bot,
  Zap,
} from "lucide-react";

export default function Notebooks() {
  const { user: fbUser } = useFirebaseUser();
  const { user } = useAuth();
  const email = fbUser?.email || "seif94803@gmail.com";

  const openNotebookLM = () => {
    window.open("https://notebooklm.google.com/", "_blank", "noopener,noreferrer");
  };

  const openGemini = () => {
    window.open("https://gemini.google.com/", "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Google NotebookLM — جيميناي نوتبوك"
          description="مساعد المذاكرة والبحث الذكي المعتمد على أحدث نماذج Gemini لقراءة وتلخيص ملازمك وكتبك مع البودكاست الصوتي التفاعلي."
        />

        <div className="flex items-center gap-2">
          <Button
            onClick={openNotebookLM}
            size="lg"
            className="rounded-2xl gap-2 font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform"
          >
            <Sparkles className="size-5" />
            <span>فتح NotebookLM الآن</span>
            <ExternalLink className="size-4" />
          </Button>
        </div>
      </div>

      {/* Main Hero Card */}
      <section className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-violet-500/10 p-6 md:p-8 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              <Sparkles className="size-3.5" />
              <span>مدعوم بنماذج Google Gemini المتقدمة</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight">
              ذاكر بذكاء مع Google NotebookLM
            </h2>
            <p className="text-sm md:text-base leading-relaxed text-muted-foreground">
              ارفع ملفات الـ PDF، كتب الوزارة، مذكرات الدروس، ومستندات Google Docs. نوت بوك إل إم يحللها بالكامل، ويجاوب على أي سؤال مع ذكر الصفحة والمصدر بدقة دون أي تخمين!
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>جاهز للفتح مباشرة بحساب Google الخاص بك: <strong className="font-mono text-foreground">{email}</strong></span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-3 w-full md:w-auto shrink-0">
            <Button
              onClick={openNotebookLM}
              size="lg"
              className="h-14 rounded-2xl gap-3 text-base font-extrabold shadow-xl shadow-primary/25 hover:scale-[1.03] transition-all"
            >
              <ArrowUpRight className="size-5" />
              <span>افتح NotebookLM</span>
              <ExternalLink className="size-4 opacity-70" />
            </Button>
            <Button
              onClick={openGemini}
              variant="outline"
              size="lg"
              className="h-12 rounded-2xl gap-2 font-bold border-border/80 bg-background/80 hover:bg-muted"
            >
              <Bot className="size-4 text-violet-600 dark:text-violet-400" />
              <span>فتح Google Gemini</span>
              <ExternalLink className="size-3.5 opacity-60" />
            </Button>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="surface p-5 rounded-3xl border border-border/80 space-y-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <FileText className="size-6" />
          </div>
          <h3 className="font-bold text-base">رفع كتب وملازم PDF</h3>
          <p className="text-xs leading-relaxed text-muted-foreground">
            يدعم كتب وملازم حتى مئات الصفحات، روابط YouTube، مواقع الويب، والملاحظات المكتوبة لتحويلها لمرجع دراسي فوري.
          </p>
        </div>

        <div className="surface p-5 rounded-3xl border border-border/80 space-y-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
            <Headphones className="size-6" />
          </div>
          <h3 className="font-bold text-base">بودكاست صوتي ذكي (Audio Overview)</h3>
          <p className="text-xs leading-relaxed text-muted-foreground">
            يحوّل مذكرتك أو ملخص الدرس إلى مناقشة صوتية شيقة بين مذيعين بالذكاء الاصطناعي كأنك تسمع بودكاست لشرح الدرس.
          </p>
        </div>

        <div className="surface p-5 rounded-3xl border border-border/80 space-y-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="size-6" />
          </div>
          <h3 className="font-bold text-base">إجابات دقيقة مع المصادر</h3>
          <p className="text-xs leading-relaxed text-muted-foreground">
            كل إجابة أو ملخص بيحتوي على أرقام واقتباسات مباشرة من صفحات ملفك، بحيث تتأكد 100% من صحة المعلومة.
          </p>
        </div>

        <div className="surface p-5 rounded-3xl border border-border/80 space-y-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <GraduationCap className="size-6" />
          </div>
          <h3 className="font-bold text-base">دليل دراسة وأسئلة تدريبية</h3>
          <p className="text-xs leading-relaxed text-muted-foreground">
            بضغطة واحدة ينشئ لك Study Guide متكامل، جدول زمني، بنك أسئلة شائعة، وفلاش كاردز سريعة قبل الامتحانات.
          </p>
        </div>
      </div>

      {/* Instructions & Workflow */}
      <section className="surface p-6 rounded-3xl border border-border/80">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Zap className="size-5 text-primary" />
          <span>خطوات الاستخدام في 3 خطوات بسيطة:</span>
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="p-4 rounded-2xl bg-muted/40 border border-border/60">
            <div className="flex items-center gap-2 font-bold text-primary text-sm mb-1">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-black">1</span>
              <span>افتح NotebookLM</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              اضغط على زر الفتح وسيتم نقلك مباشرة إلى لوحة دفاتر Google NotebookLM المسجلة بحسابك.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-muted/40 border border-border/60">
            <div className="flex items-center gap-2 font-bold text-primary text-sm mb-1">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-black">2</span>
              <span>أنشئ دفتراً وارفع ملازمك</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              اختر اسم الدفتر (مثال: فيزياء — الباب الأول) وارفع ملفات الـ PDF أو الملخصات الخاصة بالوحدة.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-muted/40 border border-border/60">
            <div className="flex items-center gap-2 font-bold text-primary text-sm mb-1">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-black">3</span>
              <span>اسأل ولخص واسمع الشرح</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              اطلب تلخيص أي فكرة، اسأل عن أي قانون معقد، أو اسمع الـ Audio Overview وأنت في الطريق!
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
