import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { CalendarRange, Moon, Palette, ShieldCheck, Sun } from "lucide-react";
import { ManusDataMigration } from "@/components/ManusDataMigration";

export default function Settings() {
  const { theme, toggleTheme } = useTheme();
  const { data } = trpc.dashboard.summary.useQuery();

  return (
    <div className="space-y-8">
      <PageHeader
        title="الإعدادات وإدارة البيانات"
        description="إدارة مظهر التطبيق، نقل وترحيل البيانات السابقة من مانوس، ومزامنة السحابة."
      />

      {/* Manus Database Migration Tool */}
      <ManusDataMigration />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="surface p-5 rounded-3xl border border-border/80">
          <div className="flex items-center gap-3">
            <span className="metric-icon bg-primary/10 text-primary">
              <Palette className="size-5" />
            </span>
            <div>
              <h2 className="font-bold">المظهر</h2>
              <p className="text-sm text-muted-foreground">انتقل بين المظهر الفاتح والداكن.</p>
            </div>
          </div>
          <Button className="mt-5 rounded-2xl font-bold" variant="outline" onClick={toggleTheme}>
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {theme === "dark" ? "تفعيل المظهر الفاتح" : "تفعيل المظهر الداكن"}
          </Button>
        </section>

        <section className="surface p-5 rounded-3xl border border-border/80">
          <div className="flex items-center gap-3">
            <span className="metric-icon bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
              <CalendarRange className="size-5" />
            </span>
            <div>
              <h2 className="font-bold">دورة الـ90 يوم</h2>
              <p className="text-sm text-muted-foreground">
                {data?.cycle
                  ? `تنتهي في ${new Date(data.cycle.endAt).toLocaleDateString("ar-EG")}`
                  : "يتم إعدادها عند بدء النشاط."}
              </p>
            </div>
          </div>
          <p className="mt-5 rounded-xl bg-muted/70 p-3 text-sm text-muted-foreground">
            تبقى الدورات السابقة محفوظة كسجل تاريخي؛ لا يتم حذف تقدمك عند بدء دورة جديدة.
          </p>
        </section>

        <section className="surface p-5 rounded-3xl border border-border/80 lg:col-span-2">
          <div className="flex items-center gap-3">
            <span className="metric-icon bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <h2 className="font-bold">سلامة البيانات والتخزين السحابي</h2>
              <p className="text-sm text-muted-foreground">
                يتم حفظ البيانات محلياً في SQLite مع مزامنة سحابية إلى Firestore وتشفير الجلسات.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
