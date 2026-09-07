import React, { useState } from "react";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { Download, Smartphone, Check, X, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA in standalone mode, hide
  if (isInstalled) {
    return (
      <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
        <ShieldCheck className="size-4 text-emerald-500" />
        <span>تطبيق مثبت (PWA)</span>
      </div>
    );
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <Button
        onClick={install}
        size="sm"
        className="rounded-xl gap-2 text-xs font-extrabold shadow-md shadow-primary/20 bg-gradient-to-r from-primary to-teal-600 hover:opacity-90"
      >
        <Download className="size-4 animate-bounce" />
        <span>تثبيت التطبيق (PWA)</span>
      </Button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <Button
          onClick={() => setShowIOSGuide(true)}
          size="sm"
          variant="outline"
          className="rounded-xl gap-1.5 text-xs font-bold border-primary/30 text-primary"
        >
          <Smartphone className="size-3.5" />
          <span>تثبيت على الآيفون</span>
        </Button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-3xl bg-card border p-6 shadow-2xl space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-base font-black flex items-center gap-2 text-foreground">
                  <Smartphone className="size-5 text-primary" />
                  <span>تثبيت Seif Study OS على iPhone / iPad</span>
                </h3>
                <button onClick={() => setShowIOSGuide(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="size-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-foreground leading-relaxed">
                <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-muted/50 border">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-xs">
                    1
                  </span>
                  <p>
                    اضغط على زر <strong>المشاركة (Share)</strong> في أسفل شريط متصفح Safari.
                  </p>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-muted/50 border">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-xs">
                    2
                  </span>
                  <p>
                    اسحب القائمة لأسفل واختر <strong>إضافة إلى الشاشة الرئيسية (Add to Home Screen)</strong>.
                  </p>
                </div>
              </div>

              <Button
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded-2xl font-bold text-xs"
              >
                فهمت ذلك
              </Button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Fallback desktop install prompt button
  return (
    <Button
      onClick={() => {
        alert("لتثبيت التطبيق على جهازك: اضغط على أيقونة التثبيت ⊕ الموجودة بجوار شريط العنوان في متصفحك (Chrome / Edge / Safari).");
      }}
      size="sm"
      variant="outline"
      className="rounded-xl gap-1.5 text-xs font-bold border-primary/20 text-muted-foreground hover:text-foreground"
    >
      <Download className="size-3.5 text-primary" />
      <span>تثبيت التطبيق</span>
    </Button>
  );
}
