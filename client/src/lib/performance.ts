import { useEffect, useRef } from "react";

/**
 * A highly precise, zero-dependency performance tracking hook
 * to monitor rendering speeds and identify bottlenecks in main study modules.
 */
export function useRenderLogger(moduleName: string) {
  const renderCount = useRef(0);
  const mountStart = useRef(performance.now());
  
  // Track mounting time
  useEffect(() => {
    const mountDuration = performance.now() - mountStart.current;
    console.log(
      `%c[Performance] 🚀 ${moduleName} fully mounted in ${mountDuration.toFixed(2)}ms`,
      "color: #4f46e5; font-weight: 800; font-size: 12px; background-color: rgba(79, 70, 229, 0.08); padding: 3px 8px; border-radius: 6px;"
    );

    return () => {
      console.log(
        `%c[Performance] 💤 ${moduleName} unmounted`,
        "color: #e11d48; font-weight: bold; font-size: 11px;"
      );
    };
  }, [moduleName]);

  // Track individual render update times
  const renderStart = performance.now();
  renderCount.current += 1;

  useEffect(() => {
    const renderDuration = performance.now() - renderStart;
    if (renderCount.current > 1) {
      console.log(
        `%c[Performance] ⚡ ${moduleName} updated (Render #${renderCount.current}) in ${renderDuration.toFixed(2)}ms`,
        "color: #d97706; font-weight: 700; font-size: 11px;"
      );
    }
  });
}
