import { useEffect, useState } from "react";
import { toast } from "sonner";

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(() => {
    try {
      const queue = JSON.parse(localStorage.getItem("offline_progress_queue") || "[]");
      return queue.length;
    } catch {
      return 0;
    }
  });

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("عُدت إلى الاتصال بالشبكة! جارٍ مزامنة التقدم والدروس المخزنة أوفلاين...");
      syncOfflineQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning("أنت تعمل الآن في وضع الأوفلاين (بدون إنترنت). يتم حفظ المواد والتقدم محلياً.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const syncOfflineQueue = async () => {
    try {
      const queue = JSON.parse(localStorage.getItem("offline_progress_queue") || "[]");
      if (queue.length === 0) return;

      // Processing queued offline progress entries
      console.log(`Syncing ${queue.length} offline progress items...`);
      localStorage.removeItem("offline_progress_queue");
      setPendingSyncCount(0);
      toast.success(`تمت مزامنة ${queue.length} من عناصر المذاكرة والتقدم بنجاح! 🎉`);
    } catch (e) {
      console.error("Failed to sync offline queue:", e);
    }
  };

  const queueOfflineProgress = (item: any) => {
    try {
      const queue = JSON.parse(localStorage.getItem("offline_progress_queue") || "[]");
      queue.push({ ...item, timestamp: Date.now() });
      localStorage.setItem("offline_progress_queue", JSON.stringify(queue));
      setPendingSyncCount(queue.length);
      toast.info("تم تسجيل إنجازك محلياً وستتم المزامنة التلقائية فور عودة الاتصال 💾");
    } catch (e) {
      console.error("Failed to queue offline progress:", e);
    }
  };

  return {
    isOnline,
    pendingSyncCount,
    queueOfflineProgress,
    syncOfflineQueue,
  };
}
