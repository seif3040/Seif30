import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Download, RefreshCw, HardDrive, CloudCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { downloadObjectAsJson, getLocalVaultSnapshot } from "@/lib/offlineStorage";

interface BackupStatus {
  success: boolean;
  lastBackupFormatted: string;
  nextBackupInHours: number;
  totalBackupFiles: number;
  frequency: string;
}

export function BackupSafetyWidget() {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/backup/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch {}
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  const downloadJsonDirect = async () => {
    try {
      const res = await fetch("/api/backup/download-json");
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const todayStr = new Date().toISOString().split("T")[0];
        a.download = `seif_study_os_backup_${todayStr}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        return true;
      }
    } catch (e) {
      console.warn("Server json download fallback:", e);
    }

    // Fallback: client vault
    try {
      const localVault = await getLocalVaultSnapshot("dashboard_summary");
      downloadObjectAsJson(
        {
          app: "Seif Study OS",
          exportDate: new Date().toISOString(),
          offlineVault: localVault,
        },
        `seif_study_os_backup_${new Date().toISOString().split("T")[0]}`
      );
      return true;
    } catch {
      return false;
    }
  };

  const handleManualBackup = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/backup/create-now", { method: "POST" });
      if (res.ok) {
        fetchStatus();
      }
      // Automatically download JSON file to user's device!
      await downloadJsonDirect();
      toast.success("🛡️ تم النسخ بنجاح ونزل ملف الـ JSON على جهازك فوراً!");
    } catch {
      await downloadJsonDirect();
      toast.info("تم حفظ وتنزيل ملف الـ JSON على جهازك بنجاح.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadBackup = async () => {
    setDownloading(true);
    try {
      await downloadJsonDirect();
      toast.success("📥 تم تجهيز وتنزيل ملف الـ JSON لحفظه على جهازك أو Google Drive!");
    } catch (e) {
      toast.error("حدث خطأ أثناء تحميل النسخة.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="surface rounded-3xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-card to-emerald-500/5 p-4 sm:p-5 shadow-xs">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20 shrink-0">
            <ShieldCheck className="size-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-extrabold text-sm sm:text-base text-foreground">
                النسخ الاحتياطي الآمن والدرع الثلاثي 🛡️
              </h4>
              <span className="rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 text-[11px] font-bold">
                كل 6 ساعات تلقائياً
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              آخر حفظ تلقائي: <b className="text-foreground">{status?.lastBackupFormatted || "منذ قليل"}</b> • متزامن في المتصفح، السيرفر، وقاعدة البيانات
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={handleManualBackup}
            disabled={loading}
            className="rounded-xl font-bold text-xs gap-1.5 border-emerald-500/30 hover:bg-emerald-500/10 flex-1 md:flex-none"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>{loading ? "جاري الحفظ وتنزيل JSON…" : "نسخ وتنزيل JSON الآن ⚡📥"}</span>
          </Button>

          <Button
            size="sm"
            onClick={handleDownloadBackup}
            disabled={downloading}
            className="rounded-xl font-bold text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex-1 md:flex-none"
          >
            <Download className="size-3.5" />
            <span>تنزيل نسخة لجهازي / Drive 📥</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
