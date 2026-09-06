import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { Award, BarChart3, Bot, BookOpen, CalendarDays, CalendarRange, CheckSquare, CircleDollarSign, Clock3, Cloud, ExternalLink, Flame, Gift, GraduationCap, LayoutDashboard, LogOut, Menu, NotebookPen, Layers3, Search, Settings, Sparkles, Timer, Trophy, Users, Video } from "lucide-react";
import { useLocation } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { Input } from "@/components/ui/input";
import { PersonalAssistantPanel } from "@/components/PersonalAssistant";
import { loginWithGoogle, useFirebaseUser } from "@/lib/firebase";
import { toast } from "sonner";
import { useState } from "react";

type MenuItem = [label: string, path: string, icon: any, externalUrl?: string];

const menu: MenuItem[] = [
  ["لوحة التحكم", "/", LayoutDashboard],
  ["مركز المذاكرة", "/hub", Sparkles],
  ["مصادر دروسي", "/lesson-sources", Users],
  ["خطة المنهج", "/study-plan", BookOpen],
  ["جدول الأسبوع", "/weekly-schedule", CalendarRange],
  ["الامتحانات", "/exams", GraduationCap],
  ["الجدول اليومي", "/daily", CalendarDays],
  ["دوّر في مذاكرتك", "/study-search", Search],
  ["فلاش كاردز", "/flashcards", Layers3],
  ["Pomodoro", "/pomodoro", Timer],
  ["استراحة محسوبة", "/focus-lounge", Clock3],
  ["فيديو المذاكرة", "/study-video", Video],
  ["الأهداف", "/goals", Trophy],
  ["العادات", "/habits", Flame],
  ["التحليلات", "/analytics", BarChart3],
  ["المساعد الذكي", "/assistant", Bot],
  ["NotebookLM (جوجل)", "/notebooks", Sparkles, "https://notebooklm.google.com/"],
  ["التقويم", "/calendar", CalendarDays],
  ["الإنجازات", "/achievements", Award],
  ["الهدايا", "/rewards", Gift],
  ["Coins", "/coins", CircleDollarSign],
  ["الإعدادات", "/settings", Settings],
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();
  if (loading || !user) return <SignInGate />;
  return <StudyNavigation>{children}</StudyNavigation>;
}

function SignInGate() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const handleGoogleSignIn = async () => {
    setGoogleBusy(true);
    try {
      const fbUser = await loginWithGoogle();
      if (fbUser) {
        const res = await fetch("/api/private-auth/firebase-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            uid: fbUser.uid,
            email: fbUser.email,
            name: fbUser.displayName || "Seif",
          }),
        });
        const data = await res.json();
        if (data.success) {
          toast.success(`مرحباً بك! تم تسجيل الدخول بحساب Google (${fbUser.displayName || fbUser.email})`);
          window.location.reload();
          return;
        }
      }
    } catch (err: any) {
      console.error("Google sign in error:", err);
      toast.error(err.message || "تعذر تسجيل الدخول بحساب Google");
    } finally {
      setGoogleBusy(false);
    }
  };

  const signIn = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/private-auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: "seif94803@gmail.com", password }),
      });
      const result = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !result.success) {
        toast.error(result.message ?? "تعذّر تسجيل الدخول.");
        return;
      }
      window.location.reload();
    } catch {
      toast.error("تعذّر الاتصال بخدمة تسجيل الدخول.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-shell flex min-h-screen items-center justify-center p-5">
      <div className="surface w-full max-w-md p-8 text-center rounded-3xl border border-border/80 shadow-2xl">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
          <Sparkles className="size-7" />
        </div>
        <h1 className="text-2xl font-black tracking-tight">Seif Study OS</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          حساب شخصي آمن لحفظ خطة مذاكرتك، استراحاتك، وCoins مع سحابة Firestore وذكاء Gemini.
        </p>

        {/* Primary Action: Google Sign-in with Firebase Auth */}
        <div className="mt-6 space-y-3">
          <Button
            type="button"
            variant="outline"
            disabled={googleBusy || busy}
            onClick={handleGoogleSignIn}
            className="w-full h-12 rounded-2xl gap-3 font-bold border-border/80 bg-background hover:bg-muted shadow-xs transition-all"
          >
            <svg className="size-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>{googleBusy ? "جارٍ تسجيل الدخول بجوجل…" : "تسجيل الدخول باستخدام Google (Firebase Auth)"}</span>
          </Button>

          <div className="relative my-4 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/70" />
            </div>
            <span className="relative bg-card px-3 text-xs text-muted-foreground">أو بكلمة المرور الخاصة</span>
          </div>

          <div className="space-y-2 text-right">
            <label className="block text-xs font-bold text-muted-foreground">البريد المصرح له</label>
            <Input dir="ltr" value="seif94803@gmail.com" readOnly aria-label="البريد المسموح له" className="h-10 rounded-xl bg-muted/30" />
            <label className="block text-xs font-bold text-muted-foreground">كلمة المرور</label>
            <Input
              dir="ltr"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && signIn()}
              placeholder="أدخل كلمة المرور"
              autoComplete="current-password"
              className="h-10 rounded-xl"
            />
          </div>

          <Button disabled={!password || busy || googleBusy} onClick={signIn} className="mt-4 w-full h-11 rounded-2xl font-bold">
            {busy ? "جارٍ التحقق…" : "تسجيل الدخول بكلمة المرور"}
          </Button>
        </div>
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
        <div className="flex h-[76px] items-center justify-between border-b border-border/70 bg-background/65 px-4 backdrop-blur-xl md:px-8">
          <div className="flex items-center gap-3">
            {mobile && <SidebarTrigger className="rounded-xl"><Menu /></SidebarTrigger>}
            <div>
              <p className="text-xs text-muted-foreground">يلا نكسب اليوم</p>
              <p className="font-bold">{current}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Cloud Sync with Firestore indicator */}
            <div className="hidden items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 sm:flex">
              <Cloud className="size-3.5" />
              <span>Firestore متزامن</span>
            </div>
            <div className="hidden items-center gap-2 rounded-xl bg-card px-3 py-2 text-sm shadow-sm sm:flex">
              <CheckSquare className="size-4 text-primary" />
              <span>مهمة واحدة = يوم جامد</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => navigate("/assistant")} className="rounded-xl" title="المساعد الذكي">
              <Bot className="size-5" />
            </Button>
          </div>
        </div>
        <main className="page-enter min-h-[calc(100vh-76px)] p-4 md:p-8">{children}</main>
        <PersonalAssistantPanel />
      </SidebarInset>
    </SidebarProvider>
  );
}
