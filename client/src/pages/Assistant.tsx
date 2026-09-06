import { PersonalAssistantWorkspace } from "@/components/PersonalAssistant";
import { PageHeader } from "@/components/PageHeader";
import { useFirebaseUser } from "@/lib/firebase";
import { Sparkles, CheckCircle2, Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Assistant() {
  const { user, loginWithGoogle, isAuthenticated } = useFirebaseUser();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="سيفي — رفيق ومساعد المذاكرة الذكي"
          description="مساعدك الشخصي الصوتي لتنظيم المهام، العادات، خطط المذاكرة، والإجابة على أسئلتك الدراسية مجاناً بالكامل وبدون أي اشتراكات أو API مدفوع."
        />

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-bold">
            <CheckCircle2 className="size-4 text-emerald-500" />
            <span>مجاني 100% — بدون API مدفوع</span>
          </div>

          {isAuthenticated ? (
            <div className="flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs text-primary font-bold">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>مزامنة سحابية ({user?.displayName || user?.email})</span>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => loginWithGoogle()}
              className="gap-2 rounded-2xl border-primary/30 font-bold text-xs"
            >
              <Cloud className="size-4 text-primary" />
              ربط بـ Google / Firestore
            </Button>
          )}
        </div>
      </div>

      <PersonalAssistantWorkspace />
    </div>
  );
}
