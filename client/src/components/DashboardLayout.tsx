import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { Award, BarChart3, Bot, BookOpen, BookX, Brain, CalendarDays, CalendarRange, Check, CheckSquare, CircleDollarSign, Clock3, Cloud, Copy, ExternalLink, Eye, FileText, Flame, Gift, GraduationCap, HelpCircle, Inbox, Laptop, LayoutDashboard, Link2, LogOut, Mail, Menu, Network, NotebookPen, Layers3, Presentation, Search, Settings, ShieldAlert, Sparkles, Split, Timer, Trophy, Users, Video, X } from "lucide-react";
import { useLocation } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { Input } from "@/components/ui/input";
import { PersonalAssistantPanel } from "@/components/PersonalAssistant";
import { NotificationCenter } from "@/components/NotificationCenter";
import { PWAInstallButton } from "@/components/PWAInstallButton";
import { OfflineSyncBanner } from "@/components/OfflineSyncBanner";
import { loginWithGoogle, useFirebaseUser } from "@/lib/firebase";
import { toast } from "sonner";
import { useState } from "react";

type MenuItem = [label: string, path: string, icon: any, externalUrl?: string];

const menu: MenuItem[] = [
  ["الرئيسية (الداشبورد)", "/", LayoutDashboard],
  ["سنتر المذاكرة الذكي", "/hub", Sparkles],
  ["ربط المصادر والمواقع", "/resource-bridge", Link2],
  ["نتيجة المذاكرة الذكية", "/smart-learning-calendar", CalendarDays],
  ["تخطيط يومك بالساعة", "/smart-planner", CalendarDays],
  ["وضع التركيز العالي (Deep Work)", "/deep-work", ShieldAlert],
  ["دروس الأونلاين والسناتر", "/hybrid-hub", Laptop],
  ["مصادر وملازم دروسي", "/lesson-sources", Users],
  ["خطة المنهج والمواد", "/study-plan", BookOpen],
  ["جدول المذاكرة الأسبوعي", "/weekly-schedule", CalendarRange],
  ["سجل الامتحانات والاختبارات", "/exams", GraduationCap],
  ["كشكول الأخطاء والتعليم", "/mistakes", BookX],
  ["معمل الأخطاء والتكرار", "/mistake-lab", Brain],
  ["استوديو فاينمان (اشرح لنفسك)", "/feynman", Presentation],
  ["امتحانات فورية بالـ AI", "/quiz-generator", HelpCircle],
  ["ملخص الملازم والورق", "/summarizer", FileText],
  ["الخرائط الذهنية الذكية", "/mindmap", Network],
  ["تفكيك الدروس الصعبة", "/decomposer", Split],
  ["المهام والجدول اليومي", "/daily", CalendarDays],
  ["سرش في كل المذاكرة", "/study-search", Search],
  ["كروت المراجعة (Flashcards)", "/flashcards", Layers3],
  ["تايمر البومودورو 🍅", "/pomodoro", Timer],
  ["ركن الروقان والموسيقى 🎧", "/focus-lounge", Clock3],
  ["مذاكرة الفيديوهات واليوتيوب", "/study-video", Video],
  ["أهدافي وطموحاتي 🎯", "/goals", Trophy],
  ["عاداتي اليومية 🔥", "/habits", Flame],
  ["إحصائيات وأداء المذاكرة", "/analytics", BarChart3],
  ["صاحبك الذكي (Seify) 🤖", "/assistant", Bot],
  ["NotebookLM (جوجل)", "/notebooks", Sparkles, "https://notebooklm.google.com/"],
  ["كل المواعيد والامتحانات", "/calendar", CalendarDays],
  ["إنجازاتي وأوسمتي 🏅", "/achievements", Award],
  ["متجر المكافآت 🎁", "/rewards", Gift],
  ["عملاتي (Coins) 🪙", "/coins", CircleDollarSign],
  ["إعدادات الحساب", "/settings", Settings],
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [localAuthed, setLocalAuthed] = useState(() => {
    try {
      return Boolean(localStorage.getItem("seif_local_auth_user"));
    } catch {
      return false;
    }
  });

  const effectiveUser = user || (localAuthed ? {
    id: 1,
    openId: "private-owner:seif94803@gmail.com",
    name: "سيف",
    email: "seif94803@gmail.com",
    role: "admin",
  } : null);

  if (!effectiveUser) return <SignInGate onAuthed={() => setLocalAuthed(true)} />;
  return <StudyNavigation>{children}</StudyNavigation>;
}

function SignInGate({ onAuthed }: { onAuthed: () => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const authenticateLocally = () => {
    const verifiedUser = {
      id: 1,
      openId: "private-owner:seif94803@gmail.com",
      name: "سيف",
      email: "seif94803@gmail.com",
      role: "admin",
    };
    try {
      localStorage.setItem("seif_local_auth_user", JSON.stringify(verifiedUser));
      localStorage.setItem("manus-runtime-user-info", JSON.stringify(verifiedUser));
      localStorage.setItem("seif_private_token", "static-mode-token");
      sessionStorage.setItem("seif_private_token", "static-mode-token");
    } catch {}
    toast.success("تم تسجيل الدخول بنجاح! مرحباً بك يا سيف 🚀");
    onAuthed();
  };

  const handleSignIn = async () => {
    const pass = password.trim().toLowerCase();
    if (!pass) {
      toast.error("يرجى إدخال كلمة المرور أولاً.");
      return;
    }

    setBusy(true);

    // Direct password match (Static VibeHost or Offline)
    if (pass === "seif12345678" || pass === "seif" || pass === "12345678" || pass === "admin") {
      authenticateLocally();
      setBusy(false);
      return;
    }

    // Try server verification if running with backend
    try {
      const response = await fetch("/api/private-auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: "seif94803@gmail.com", password: password.trim() }),
      });
      const contentType = response.headers.get("content-type") || "";
      if (response.ok && contentType.includes("application/json")) {
        const result = await response.json();
        if (result.success) {
          authenticateLocally();
          setBusy(false);
          return;
        }
      }
    } catch {}

    toast.error("كلمة المرور غير صحيحة. كلمة المرور هي: seif12345678");
    setBusy(false);
  };

  return (
    <div className="app-shell flex min-h-screen items-center justify-center p-4 sm:p-6 bg-gradient-to-b from-background via-background/95 to-muted/30">
      <div className="surface w-full max-w-md p-6 sm:p-8 text-center rounded-3xl border border-border/80 shadow-2xl relative">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
          <Sparkles className="size-7" />
        </div>
        <h1 className="text-2xl font-black tracking-tight">Seif Study OS</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          أدخل كلمة المرور الخاصة بحسابك للدخول إلى لوحة المذاكرة والتحكم.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSignIn();
          }}
          className="mt-6 space-y-4 text-right"
        >
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-muted-foreground">الحساب المصرح له</label>
            <Input dir="ltr" value="seif94803@gmail.com" readOnly className="h-10 rounded-xl bg-muted/40 font-semibold text-foreground/80" />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">كلمة المرور: <code className="font-mono text-primary font-bold">seif12345678</code></span>
              <label className="block text-xs font-bold text-muted-foreground">كلمة المرور</label>
            </div>
            <Input
              dir="ltr"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="أدخل كلمة المرور (seif12345678)"
              autoComplete="current-password"
              className="h-11 rounded-xl text-base"
              autoFocus
            />
          </div>

          <Button type="submit" disabled={busy} className="w-full h-12 rounded-2xl font-bold text-base shadow-md transition-all hover:scale-[1.01]">
            {busy ? "جاري الدخول…" : "تسجيل الدخول إلى الحساب 🚀"}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setPassword("seif12345678");
              setTimeout(() => authenticateLocally(), 50);
            }}
            className="w-full h-11 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground border-dashed"
          >
            ⚡ دخول فوري بنقرة واحدة (حساب سيف)
          </Button>
        </form>
      </div>
    </div>
  );
}

function StudyNavigation({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { user: fbUser } = useFirebaseUser();
  const [location, navigate] = useLocation();
  const mobile = useIsMobile();
  const { theme, toggleTheme } = useTheme();
  const current = menu.find(([_, path]) => path === location)?.[0] ?? "Seif Study OS";

  return (
    <SidebarProvider defaultOpen>
      <Sidebar side="right" collapsible="offcanvas" className="border-l border-sidebar-border">
        <SidebarHeader className="h-[76px] border-b border-sidebar-border px-4">
          <button onClick={() => navigate("/")} className="flex w-full items-center gap-3 text-right">
            <div className="flex size-10 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-black/10">
              <GraduationCap className="size-5" />
            </div>
            <div>
              <p className="font-[Manrope] text-base font-extrabold tracking-tight">SEIF STUDY OS</p>
              <p className="text-[10px] text-sidebar-foreground/65">مذاكرتك على مزاجك</p>
            </div>
          </button>
        </SidebarHeader>
        <SidebarContent className="px-3 py-4">
          <p className="mb-2 px-3 text-[10px] font-bold tracking-[0.13em] text-sidebar-foreground/50">مساحة العمل</p>
          <SidebarMenu>
            {menu.map(([label, path, Icon, externalUrl]) => (
              <SidebarMenuItem key={path}>
                <SidebarMenuButton
                  isActive={location === path}
                  onClick={() => {
                    if (externalUrl) {
                      window.open(externalUrl, "_blank", "noopener,noreferrer");
                    }
                    navigate(path);
                  }}
                  className="h-10 rounded-xl text-sidebar-foreground/80 data-[active=true]:bg-sidebar-primary data-[active=true]:font-bold data-[active=true]:text-sidebar-primary-foreground"
                >
                  <Icon className="size-4" />
                  <span className="flex-1 text-right">{label}</span>
                  {externalUrl && (
                    <ExternalLink className="size-3.5 opacity-60 shrink-0" />
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border p-3">
          <button onClick={toggleTheme} className="mb-2 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-sidebar-foreground/75 hover:bg-sidebar-accent">
            <Clock3 className="size-4" />
            المظهر: {theme === "dark" ? "داكن" : "فاتح"}
          </button>
          <div className="flex items-center gap-3 rounded-xl bg-sidebar-accent/70 p-2.5">
            <Avatar className="size-9">
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground">
                {(fbUser?.displayName || user?.name)?.slice(0, 1) ?? "S"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{(fbUser?.displayName || user?.name) ?? "Seif"}</p>
              <p className="truncate text-xs text-sidebar-foreground/60">{fbUser?.email || "seif94803@gmail.com"}</p>
            </div>
            <button onClick={logout} aria-label="تسجيل الخروج" className="rounded-lg p-2 text-sidebar-foreground/65 hover:bg-black/10">
              <LogOut className="size-4" />
            </button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="app-shell min-h-screen">
        <div className="relative z-40 flex h-[76px] items-center justify-between border-b border-border/70 bg-background/65 px-4 backdrop-blur-xl md:px-8">
          <div className="flex items-center gap-3">
            {mobile && <SidebarTrigger className="rounded-xl"><Menu /></SidebarTrigger>}
            <div>
              <p className="text-xs text-muted-foreground">يلا بينا نكسر الدنيا اليوم 🚀</p>
              <p className="font-bold">{current}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Cloud Sync with Firestore indicator */}
            <div className="hidden items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 sm:flex">
              <Cloud className="size-3.5" />
              <span>السحابة متزامنة 🔥</span>
            </div>
            <div className="hidden items-center gap-2 rounded-xl bg-card px-3 py-2 text-sm shadow-sm sm:flex">
              <CheckSquare className="size-4 text-primary" />
              <span>خلص مهمة وخليك جامد 💪</span>
            </div>
            <PWAInstallButton />
            <NotificationCenter />
            <Button variant="ghost" size="icon" onClick={() => navigate("/assistant")} className="rounded-xl" title="المساعد الذكي">
              <Bot className="size-5" />
            </Button>
          </div>
        </div>
        <main className="page-enter min-h-[calc(100vh-76px)] p-4 md:p-8">{children}</main>
        <PersonalAssistantPanel />
        <OfflineSyncBanner />
      </SidebarInset>
    </SidebarProvider>
  );
}
