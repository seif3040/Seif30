export type StudySourceKind = "embedded" | "external" | "invalid";

export function safeStudyUrl(url: string) {
  try { const parsed = new URL(url.trim()); return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null; } catch { return null; }
}

export function youtubeEmbed(url: string) {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.replace("www.", "").toLowerCase();
    let id = "";
    if (host === "youtu.be") {
      id = parsed.pathname.slice(1).split("?")[0].split("&")[0];
    } else if (host.includes("youtube.com") || host === "m.youtube.com") {
      if (parsed.pathname.startsWith("/shorts/")) {
        id = parsed.pathname.split("/shorts/")[1]?.split(/[?&]/)[0] ?? "";
      } else if (parsed.pathname.startsWith("/live/")) {
        id = parsed.pathname.split("/live/")[1]?.split(/[?&]/)[0] ?? "";
      } else if (parsed.pathname.startsWith("/embed/")) {
        id = parsed.pathname.split("/embed/")[1]?.split(/[?&]/)[0] ?? "";
      } else {
        id = parsed.searchParams.get("v") ?? parsed.pathname.split("/").filter(Boolean).at(-1) ?? "";
      }
    }
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
    return `https://www.youtube.com/embed/${id}?enablejsapi=1&rel=0&playsinline=1`;
  } catch { return null; }
}

export function youtubeWatchUrl(url: string) {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.replace("www.", "").toLowerCase();
    let id = "";
    if (host === "youtu.be") {
      id = parsed.pathname.slice(1).split("?")[0].split("&")[0];
    } else if (host.includes("youtube.com") || host === "m.youtube.com") {
      if (parsed.pathname.startsWith("/shorts/")) {
        id = parsed.pathname.split("/shorts/")[1]?.split(/[?&]/)[0] ?? "";
      } else if (parsed.pathname.startsWith("/live/")) {
        id = parsed.pathname.split("/live/")[1]?.split(/[?&]/)[0] ?? "";
      } else if (parsed.pathname.startsWith("/embed/")) {
        id = parsed.pathname.split("/embed/")[1]?.split(/[?&]/)[0] ?? "";
      } else {
        id = parsed.searchParams.get("v") ?? parsed.pathname.split("/").filter(Boolean).at(-1) ?? "";
      }
    }
    if (/^[A-Za-z0-9_-]{11}$/.test(id)) {
      return `https://www.youtube.com/watch?v=${id}`;
    }
    return url;
  } catch {
    return url;
  }
}

export function isDirectMedia(url: string) { return /\.(mp4|webm|ogv|ogg)(?:$|[?#])/i.test(url); }
export function classifyStudySource(url: string): StudySourceKind { const safe = safeStudyUrl(url); if (!safe) return "invalid"; return youtubeEmbed(safe) || isDirectMedia(safe) ? "embedded" : "external"; }
export function sourceDomain(url: string) { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "المصدر الخارجي"; } }
