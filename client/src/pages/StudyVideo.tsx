import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/PageHeader";
import { errorText, money, shortDate } from "@/lib/study";
import { trpc } from "@/lib/trpc";
import { classifyStudySource, isDirectMedia, sourceDomain, youtubeEmbed, youtubeWatchUrl } from "@/lib/videoSources";
import {
  BookOpen,
  CheckCircle2,
  CirclePause,
  CirclePlay,
  Clock3,
  Coffee,
  Download,
  ExternalLink,
  History,
  Link2,
  ListChecks,
  Pause,
  Pencil,
  Play,
  PlayCircle,
  Printer,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Square,
  Timer,
  Trash2,
  Video,
  Volume2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

type SubjectKey = "arabic" | "history" | "english" | "programming_ai" | "german" | "other";
type ProgressKey = "started" | "middle" | "finished" | "reviewed";

const subjects: Record<SubjectKey, string> = {
  arabic: "عربي",
  history: "تاريخ",
  english: "إنجليزي",
  programming_ai: "برمجة وذكاء اصطناعي",
  german: "ألماني",
  other: "أخرى",
};

const progressLabels: Record<ProgressKey, string> = {
  started: "لسه بادئ",
  middle: "في النص",
  finished: "خلصت الشرح",
  reviewed: "راجعت الواجب",
};

export const BLOCK_SECONDS = 45 * 60; // 45 minutes = 2700 seconds
export const BREAK_SECONDS = 15 * 60; // 15 minutes = 900 seconds

export function calculateBreakRemaining(breakEndsAt: Date | string | number | null | undefined, nowMs: number): number {
  if (!breakEndsAt) return BREAK_SECONDS;
  const endMs = new Date(breakEndsAt).getTime();
  if (isNaN(endMs)) return BREAK_SECONDS;
  return Math.max(0, Math.ceil((endMs - nowMs) / 1000));
}

export function calculateActiveNow(
  session: { phase?: string; timerRunning?: boolean; activeSeconds?: number; lastPlaybackAt?: Date | string | null; updatedAt?: Date | string | null } | null | undefined,
  nowMs: number
): number {
  if (!session) return 0;
  const currentSeconds = session.activeSeconds ?? 0;
  if (session.phase === "break") return currentSeconds;
  if (session.timerRunning) {
    const raw = session.lastPlaybackAt ?? session.updatedAt;
    if (raw) {
      const startMs = new Date(raw).getTime();
      if (!isNaN(startMs)) {
        const elapsed = Math.max(0, Math.floor((nowMs - startMs) / 1000));
        return currentSeconds + elapsed;
      }
    }
  }
  return currentSeconds;
}

function clock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function shortClock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function noteTime(seconds: number | null) {
  return seconds == null ? "بدون توقيت" : `عند ${clock(seconds)}`;
}

function playNotificationChime(type: "break" | "study") {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "break") {
      // Gentle relaxing chime
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.3); // E5
      osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.6); // G5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 1.2);
    } else {
      // Energetic resume chime
      osc.type = "sine";
      osc.frequency.setValueAtTime(440.0, ctx.currentTime); // A4
      osc.frequency.exponentialRampToValueAtTime(880.0, ctx.currentTime + 0.3); // A5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 1.0);
    }
  } catch {
    // AudioContext blocked or unsupported, silent fallback
  }
}

type VideoNote = {
  id: number;
  title: string;
  content: string;
  timestampSeconds: number | null;
  updatedAt: string | Date;
};

type VideoHistoryItem = {
  id: number;
  videoUrl: string;
  lessonTitle: string | null;
  subject: SubjectKey;
  sourceMode: "embedded" | "external";
  manualProgress: ProgressKey;
  activeSeconds: number;
  completedBlocks: number;
  phase: string;
  updatedAt: string | Date;
  notes: VideoNote[];
};

export default function StudyVideo() {
  const utils = trpc.useUtils();
  const { data: session, isLoading } = trpc.video.current.useQuery();
  const { data: history = [] } = trpc.video.history.useQuery();

  const [url, setUrl] = useState("");
  const [lessonTitle, setLessonTitle] = useState("");
  const [subject, setSubject] = useState<SubjectKey>("other");
  const [requestedMode, setRequestedMode] = useState<"auto" | "embedded" | "external">("auto");
  const [now, setNow] = useState(Date.now());
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [editingNote, setEditingNote] = useState<VideoNote | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const preview = useMemo(() => classifyStudySource(url), [url]);

  // Tick every second for accurate countdown & live progress
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const invalidate = () =>
    Promise.all([
      utils.video.current.invalidate(),
      utils.video.history.invalidate(),
      utils.dashboard.summary.invalidate(),
      utils.analytics.overview.invalidate(),
      utils.coins.ledger.invalidate(),
    ]);

  const start = trpc.video.start.useMutation({
    onSuccess: async () => {
      setUrl("");
      setLessonTitle("");
      toast.success("بدأت جلسة المذاكرة! المؤقت يعدّ دورة الـ 45 دقيقة 🎯");
      await invalidate();
    },
    onError: e => toast.error(errorText(e)),
  });

  const end = trpc.video.end.useMutation({
    onSuccess: async () => {
      toast.success("تم إنهاء الجلسة وحفظ كامل تقدمك بنجاح.");
      await invalidate();
    },
    onError: e => toast.error(errorText(e)),
  });

  const heartbeat = trpc.video.heartbeat.useMutation({
    onSuccess: async result => {
      if (result.blockCompleted) {
        playNotificationChime("break");
        toast.success("🎉 أحسنت! أكملت 45 دقيقة تركيز كاملة (+25 Coins) — بدأت استراحة الـ 15 دقيقة.");
        pauseAnyMedia();
      }
      await invalidate();
    },
    onError: e => {
      console.warn("Background heartbeat sync skipped:", e?.message);
    },
  });

  const triggerBreak = trpc.video.triggerBreak.useMutation({
    onSuccess: async result => {
      playNotificationChime("break");
      pauseAnyMedia();
      toast.success("🎉 أحسنت! أكملت 45 دقيقة تركيز كاملة (+25 Coins) — بدأت استراحة الـ 15 دقيقة.");
      await invalidate();
    },
    onError: e => toast.error(errorText(e)),
  });

  const resume = trpc.video.resume.useMutation({
    onSuccess: async () => {
      playNotificationChime("study");
      toast.success("انتهت الاستراحة! بدأت دورة الـ 45 دقيقة الجديدة 🚀");
      await invalidate();
      playAnyMedia();
    },
    onError: e => toast.error(errorText(e)),
  });

  const setTimer = trpc.video.setTimer.useMutation({
    onSuccess: async result => {
      if (result.blockCompleted) {
        playNotificationChime("break");
        toast.success("🎉 أكملت 45 دقيقة مذاكرة (+25 Coins) — خُد استراحة 15 دقيقة.");
        pauseAnyMedia();
      }
      await invalidate();
    },
    onError: e => {
      if (!e?.message?.toLowerCase().includes("fetch")) {
        toast.error(errorText(e));
      }
    },
  });

  const setProgress = trpc.video.setProgress.useMutation({
    onSuccess: async () => {
      toast.success("تم تحديث مستوى التقدّم.");
      await invalidate();
    },
    onError: e => toast.error(errorText(e)),
  });

  const createNote = trpc.video.createNote.useMutation({
    onSuccess: async () => {
      setNoteTitle("");
      setNoteContent("");
      toast.success("تم حفظ الملاحظة.");
      await utils.video.history.invalidate();
    },
    onError: e => toast.error(errorText(e)),
  });

  const updateNote = trpc.video.updateNote.useMutation({
    onSuccess: async () => {
      setEditingNote(null);
      setNoteTitle("");
      setNoteContent("");
      toast.success("تم تحديث الملاحظة.");
      await utils.video.history.invalidate();
    },
    onError: e => toast.error(errorText(e)),
  });

  const deleteNote = trpc.video.deleteNote.useMutation({
    onSuccess: async () => {
      toast.success("تم حذف الملاحظة.");
      await utils.video.history.invalidate();
    },
    onError: e => toast.error(errorText(e)),
  });

  // Calculate live active seconds
  const activeNow = useMemo(() => calculateActiveNow(session, now), [session, now]);

  // Break countdown calculation
  const breakRemaining = useMemo(
    () => (session?.phase === "break" ? calculateBreakRemaining(session?.breakEndsAt, now) : 0),
    [session?.phase, session?.breakEndsAt, now]
  );

  // Alert user when 15-minute break countdown finishes
  const breakFinishedAlertedRef = useRef(false);
  useEffect(() => {
    if (session?.phase === "break" && breakRemaining === 0 && !breakFinishedAlertedRef.current) {
      breakFinishedAlertedRef.current = true;
      playNotificationChime("study");
      toast.info("☕ انتهت فترة الاستراحة (15 دقيقة)! اضغط على الزر لبدء دورة الـ 45 دقيقة التالية 🚀");
    }
    if (session?.phase !== "break") {
      breakFinishedAlertedRef.current = false;
    }
  }, [session?.phase, breakRemaining]);

  // Current 45-minute block progress
  const currentBlockSeconds = activeNow % BLOCK_SECONDS;
  const remainingInBlock = BLOCK_SECONDS - currentBlockSeconds;
  const blockProgressPercent = Math.min(100, Math.round((currentBlockSeconds / BLOCK_SECONDS) * 100));

  // Helper to pause whatever media is playing (YouTube or HTML5)
  const pauseAnyMedia = () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    const iframe = document.getElementById("study-video-iframe") as HTMLIFrameElement | null;
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage(JSON.stringify({ event: "command", func: "pauseVideo", args: [] }), "*");
    }
  };

  const playAnyMedia = () => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => undefined);
    }
    const iframe = document.getElementById("study-video-iframe") as HTMLIFrameElement | null;
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage(JSON.stringify({ event: "command", func: "playVideo", args: [] }), "*");
    }
  };

  // When activeNow reaches 45 minutes (2700s) threshold during watching phase:
  // Automatically stop the video, chime, and trigger the 15-minute break!
  const hasTriggeredBreakRef = useRef<number | null>(null);
  useEffect(() => {
    if (!session || session.phase !== "watching" || !session.timerRunning) return;
    const targetBlock = session.completedBlocks + 1;
    const targetSeconds = targetBlock * BLOCK_SECONDS;

    if (activeNow >= targetSeconds && hasTriggeredBreakRef.current !== targetBlock) {
      hasTriggeredBreakRef.current = targetBlock;
      pauseAnyMedia();
      playNotificationChime("break");
      triggerBreak.mutate({
        sessionId: session.id,
      });
    }
  }, [activeNow, session?.phase, session?.timerRunning, session?.completedBlocks, session?.id]);

  useEffect(() => {
    if (session?.phase === "break") {
      hasTriggeredBreakRef.current = null;
    }
  }, [session?.phase]);

  // Periodic heartbeat every 20 seconds while watching to keep server time synchronized
  useEffect(() => {
    if (!session || session.phase !== "watching" || !session.timerRunning) return;
    const interval = setInterval(() => {
      heartbeat.mutate({
        sessionId: session.id,
        active: true,
        playbackPosition: videoRef.current ? Math.floor(videoRef.current.currentTime) : undefined,
      });
    }, 20_000);
    return () => clearInterval(interval);
  }, [session?.id, session?.phase, session?.timerRunning]);

  const sessionRef = useRef(session);
  sessionRef.current = session;

  const isSettingTimerRef = useRef(false);
  const handleMediaPlay = useCallback(() => {
    const s = sessionRef.current;
    if (!s || s.phase === "break") return;
    if (!s.timerRunning && !isSettingTimerRef.current) {
      isSettingTimerRef.current = true;
      setTimer.mutate(
        { sessionId: s.id, running: true },
        {
          onSettled: () => {
            isSettingTimerRef.current = false;
          },
        }
      );
    }
  }, [setTimer]);

  const handleMediaPause = useCallback(() => {
    const s = sessionRef.current;
    if (!s || s.phase === "break") return;
    if (s.timerRunning && !isSettingTimerRef.current) {
      isSettingTimerRef.current = true;
      setTimer.mutate(
        { sessionId: s.id, running: false },
        {
          onSettled: () => {
            isSettingTimerRef.current = false;
          },
        }
      );
    }
  }, [setTimer]);

  const toggleTimer = () => {
    if (!session) return;
    const nextState = !session.timerRunning;
    if (nextState) {
      playAnyMedia();
    } else {
      pauseAnyMedia();
    }
    setTimer.mutate({ sessionId: session.id, running: nextState });
  };

  const launch = () => {
    if (preview === "invalid") {
      toast.error("استخدم رابطًا صالحًا يبدأ بـ http:// أو https://.");
      return;
    }
    start.mutate({
      videoUrl: url.trim(),
      lessonTitle: lessonTitle.trim() || undefined,
      subject,
      requestedMode,
    });
  };

  const noteTimestamp = session?.sourceMode === "external"
    ? activeNow
    : videoRef.current?.currentTime
    ? Math.floor(videoRef.current.currentTime)
    : activeNow;

  const saveNote = () => {
    if ((!session && !editingNote) || !noteTitle.trim() || !noteContent.trim()) return;
    const timestampSeconds = editingNote
      ? session
        ? noteTimestamp
        : editingNote.timestampSeconds ?? 0
      : noteTimestamp;

    if (editingNote) {
      updateNote.mutate({
        noteId: editingNote.id,
        title: noteTitle.trim(),
        content: noteContent.trim(),
        timestampSeconds,
      });
    } else {
      createNote.mutate({
        sessionId: session!.id,
        title: noteTitle.trim(),
        content: noteContent.trim(),
        timestampSeconds,
      });
    }
  };

  const beginEdit = (note: VideoNote) => {
    setEditingNote(note);
    setNoteTitle(note.title);
    setNoteContent(note.content);
  };

  if (isLoading) return <div className="h-96 animate-pulse rounded-2xl bg-muted" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="فيديو المذاكرة والمحاضرات"
        description="نظام ذكي يعتمد على 45 دقيقة مذاكرة بتركيز كامل تفصل بعدها الاستراحة 15 دقيقة تلقائيًا مع منحك +25 Coins."
      />

      {!session ? (
        <>
          <VideoSetup
            lessonTitle={lessonTitle}
            url={url}
            subject={subject}
            requestedMode={requestedMode}
            preview={preview}
            busy={start.isPending}
            onTitle={setLessonTitle}
            onUrl={setUrl}
            onSubject={setSubject}
            onMode={setRequestedMode}
            onStart={launch}
          />

          {editingNote && (
            <div className="mx-auto mt-5 max-w-5xl">
              <NoteEditor
                title={noteTitle}
                content={noteContent}
                editing
                onTitle={setNoteTitle}
                onContent={setNoteContent}
                onSave={saveNote}
                onCancel={() => {
                  setEditingNote(null);
                  setNoteTitle("");
                  setNoteContent("");
                }}
                busy={updateNote.isPending}
              />
            </div>
          )}

          <VideoHistory
            history={history as VideoHistoryItem[]}
            onEdit={beginEdit}
            onDelete={noteId => deleteNote.mutate({ noteId })}
          />
        </>
      ) : (
        <>
          {/* Active Session Display */}
          <div className="grid gap-5 xl:grid-cols-[1fr_.38fr]">
            <section className="surface overflow-hidden rounded-2xl border border-border/80 shadow-sm">
              {/* Media Player Container or Break Screen */}
              {session.sourceMode === "external" ? (
                <ExternalLessonCard
                  session={session}
                  activeSeconds={activeNow}
                  breakRemaining={breakRemaining}
                  currentBlockSeconds={currentBlockSeconds}
                  remainingInBlock={remainingInBlock}
                  blockProgressPercent={blockProgressPercent}
                  busy={setTimer.isPending || resume.isPending}
                  onTimer={toggleTimer}
                  onProgress={progress => setProgress.mutate({ sessionId: session.id, progress })}
                  onResumeBreak={() => resume.mutate({ sessionId: session.id, force: true })}
                  onTriggerBreak={() => triggerBreak.mutate({ sessionId: session.id })}
                />
              ) : (
                <Player
                  session={session}
                  video={videoRef}
                  breakRemaining={breakRemaining}
                  activeSeconds={activeNow}
                  onResume={() => resume.mutate({ sessionId: session.id, force: true })}
                  onMediaPlay={handleMediaPlay}
                  onMediaPause={handleMediaPause}
                  onToggleTimer={toggleTimer}
                />
              )}

              {/* Study Focus Bar & Controls */}
              <div className="border-t border-border/60 bg-muted/20 p-4 sm:p-5">
                {/* 45-Minute Block Focus Indicator */}
                <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 font-bold text-primary">
                      <Timer className="size-4" />
                      <span>دورة التركيز الحالية (45 دقيقة)</span>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px]">
                        الدورة رقم {session.completedBlocks + 1}
                      </span>
                    </div>
                    <div className="font-mono font-bold text-muted-foreground">
                      {clock(currentBlockSeconds)} / 45:00 ({blockProgressPercent}%)
                    </div>
                  </div>

                  {/* Progress bar towards 45-min mark */}
                  <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-primary/15">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${blockProgressPercent}%` }}
                    />
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      {session.phase === "break" ? (
                        <span className="font-bold text-amber-500">☕ في فترة استراحة الآن</span>
                      ) : session.timerRunning ? (
                        <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                          <span className="relative flex size-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
                          </span>
                          المؤقت يعدّ وقت المذاكرة النشط
                        </span>
                      ) : (
                        <span className="font-semibold text-amber-600 dark:text-amber-400">
                          المؤقت موقوف مؤقتًا
                        </span>
                      )}
                    </span>
                    <span>
                      {session.phase === "break"
                        ? "الاستراحة جارية"
                        : `متبقي ${clock(remainingInBlock)} على الاستراحة`}
                    </span>
                  </div>
                </div>

                {/* Session Actions Footer */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">
                      {session.lessonTitle || sourceDomain(session.videoUrl)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {subjects[session.subject as SubjectKey]} ·{" "}
                      {session.sourceMode === "external" ? "منصة خارجية" : "داخل الموقع"}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {session.phase !== "break" && (
                      <>
                        <Button
                          size="sm"
                          variant={session.timerRunning ? "outline" : "default"}
                          disabled={setTimer.isPending}
                          onClick={toggleTimer}
                        >
                          {session.timerRunning ? (
                            <>
                              <Pause className="size-4" />
                              إيقاف مؤقت
                            </>
                          ) : (
                            <>
                              <Play className="size-4" />
                              استئناف المذاكرة
                            </>
                          )}
                        </Button>

                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={triggerBreak.isPending}
                          onClick={() => {
                            pauseAnyMedia();
                            triggerBreak.mutate({ sessionId: session.id });
                          }}
                          title="بدء استراحة الـ 15 دقيقة فوراً"
                        >
                          <Coffee className="size-4" />
                          استراحة 15 دقيقة
                        </Button>
                      </>
                    )}

                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={end.isPending}
                      onClick={() => end.mutate({ sessionId: session.id })}
                    >
                      <Square className="size-4" />
                      إنهاء الجلسة
                    </Button>
                  </div>
                </div>
              </div>
            </section>

            {/* Sidebar Details */}
            <VideoSidebar
              session={session}
              activeSeconds={activeNow}
              currentBlockSeconds={currentBlockSeconds}
              remainingInBlock={remainingInBlock}
              blockProgressPercent={blockProgressPercent}
              breakRemaining={breakRemaining}
            />
          </div>

          {/* Notes & History Grid */}
          <div className="mt-6 grid gap-5 lg:grid-cols-[.72fr_1fr]">
            <NoteEditor
              title={noteTitle}
              content={noteContent}
              editing={Boolean(editingNote)}
              onTitle={setNoteTitle}
              onContent={setNoteContent}
              onSave={saveNote}
              onCancel={() => {
                setEditingNote(null);
                setNoteTitle("");
                setNoteContent("");
              }}
              busy={createNote.isPending || updateNote.isPending}
              external={session.sourceMode === "external"}
            />

            <VideoHistory
              history={history as VideoHistoryItem[]}
              sessionId={session.id}
              onEdit={beginEdit}
              onDelete={noteId => deleteNote.mutate({ noteId })}
            />
          </div>
        </>
      )}
    </div>
  );
}

function VideoSetup({
  lessonTitle,
  url,
  subject,
  requestedMode,
  preview,
  busy,
  onTitle,
  onUrl,
  onSubject,
  onMode,
  onStart,
}: {
  lessonTitle: string;
  url: string;
  subject: SubjectKey;
  requestedMode: "auto" | "embedded" | "external";
  preview: "embedded" | "external" | "invalid";
  busy: boolean;
  onTitle: (value: string) => void;
  onUrl: (value: string) => void;
  onSubject: (value: SubjectKey) => void;
  onMode: (value: "auto" | "embedded" | "external") => void;
  onStart: () => void;
}) {
  const external = preview === "external" || requestedMode === "external";

  return (
    <section className="surface mx-auto max-w-3xl rounded-2xl border border-border/80 p-6 shadow-sm sm:p-8">
      <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Video className="size-6" />
      </div>
      <h2 className="text-xl font-bold">يلا نبدأ درس جديد</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        ادخل رابط الفيديو أو الدرس (سواء YouTube أو رابط مباشر أو كورس خارجي). سيفي هيعدلك 45 دقيقة مذاكرة
        بتركيز كامل، وبعدها يفصل الفيديو أوتوماتيك ويديلك استراحة 15 دقيقة مع +25 Coins!
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Input
          value={lessonTitle}
          onChange={event => onTitle(event.target.value)}
          placeholder="عنوان الدرس أو المحاضرة — اختياري"
        />
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          value={subject}
          onChange={event => onSubject(event.target.value as SubjectKey)}
          aria-label="المادة"
        >
          {Object.entries(subjects).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <Input
        dir="ltr"
        className="mt-3"
        value={url}
        onChange={event => onUrl(event.target.value)}
        onKeyDown={event => event.key === "Enter" && onStart()}
        placeholder="https://youtube.com/... أو رابط درسك المباشر"
      />

      <select
        className="mt-3 h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        value={requestedMode}
        onChange={event => onMode(event.target.value as "auto" | "embedded" | "external")}
        aria-label="نوع المصدر"
      >
        <option value="auto">اكتشاف نوع المصدر تلقائيًا</option>
        <option value="embedded">مشاهدة داخل الموقع (YouTube أو MP4)</option>
        <option value="external">درس على منصة أو موقع خارجي</option>
      </select>

      <div
        className={`mt-4 rounded-2xl border p-4 text-sm ${
          preview === "invalid"
            ? "border-destructive/30 bg-destructive/5 text-destructive"
            : external
            ? "border-amber-300/50 bg-amber-50/70 text-amber-950 dark:bg-amber-950/30 dark:text-amber-200"
            : "border-primary/20 bg-primary/5 text-primary"
        }`}
      >
        {preview === "invalid" ? (
          <>
            <XCircle className="mb-1.5 size-5" />
            <p className="font-bold">أدخل رابط الدرس عشان نحدد طريقة العرض والمتابعة</p>
          </>
        ) : external ? (
          <>
            <ShieldCheck className="mb-1.5 size-5" />
            <p className="font-bold">مذاكرة عبر منصة خارجية 🔐</p>
            <p className="mt-1 text-xs leading-5">
              هنفتح الدرس في تبويب مستقل، وسيفي هيتابع المؤقت (45 دقيقة تركيز + 15 دقيقة استراحة) مع الملاحظات والـ Coins هنا.
            </p>
          </>
        ) : (
          <>
            <PlayCircle className="mb-1.5 size-5 text-primary" />
            <p className="font-bold">مشاهدة مباشرة داخل الموقع 🎬</p>
            <p className="mt-1 text-xs leading-5">
              هيتعرض الدرس هنا مع مؤقت 45 دقيقة نشط، ويفصل الفيديو تلقائيًا عند انتهاء الـ 45 دقيقة لتبدأ استراحة الـ 15 دقيقة!
            </p>
          </>
        )}
      </div>

      <Button
        className="mt-5 w-full font-bold"
        disabled={!url.trim() || preview === "invalid" || busy}
        onClick={onStart}
      >
        {external ? (
          <>
            <ExternalLink className="size-4" />
            ابدأ الجلسة وافتح الدرس
          </>
        ) : (
          <>
            <Play className="size-4" />
            ابدأ المشاهدة والمذاكرة
          </>
        )}
      </Button>
    </section>
  );
}

function Player({
  session,
  video,
  breakRemaining,
  activeSeconds,
  onResume,
  onMediaPlay,
  onMediaPause,
  onToggleTimer,
}: {
  session: any;
  video: React.RefObject<HTMLVideoElement | null>;
  breakRemaining: number;
  activeSeconds: number;
  onResume: () => void;
  onMediaPlay: () => void;
  onMediaPause: () => void;
  onToggleTimer?: () => void;
}) {
  const embed = youtubeEmbed(session.videoUrl);

  // YouTube postMessage event listener
  useEffect(() => {
    if (!embed || typeof window === "undefined") return;

    const handleMessage = (e: MessageEvent) => {
      try {
        let data = e.data;
        if (typeof data === "string") {
          try {
            data = JSON.parse(data);
          } catch {
            return;
          }
        }
        if (!data) return;

        let playerState: number | undefined;
        if (data.event === "onStateChange" && typeof data.info === "number") {
          playerState = data.info;
        } else if (data.event === "infoDelivery" && data.info && typeof data.info.playerState === "number") {
          playerState = data.info.playerState;
        }

        if (playerState === 1) {
          onMediaPlay();
        } else if (playerState === 2 || playerState === 0) {
          onMediaPause();
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [embed, onMediaPlay, onMediaPause]);

  // When phase is "break", the video completely stops and the Break Screen replaces it!
  if (session.phase === "break") {
    return <BreakScreen breakRemaining={breakRemaining} onResume={onResume} />;
  }

  // YouTube Embed
  if (embed) {
    const watchUrl = youtubeWatchUrl(session.videoUrl);
    return (
      <div className="flex flex-col bg-black">
        {/* Quick External Link & Info Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-slate-950 px-4 py-2 text-xs text-white">
          <div className="flex items-center gap-2 truncate">
            <span className="font-bold text-white truncate">
              {session.lessonTitle || "مشاهدة الدرس"}
            </span>
          </div>
          <a
            href={watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-red-600/90 hover:bg-red-600 px-3 py-1 font-bold text-white transition-colors"
            title="فتح الفيديو مباشرة في يوتيوب في نافذة جديدة مع استمرار العداد في الخلفية"
          >
            <ExternalLink className="size-3.5" />
            <span>فتح في YouTube ↗</span>
          </a>
        </div>

        <div className="relative aspect-video w-full bg-black">
          <iframe
            key={embed}
            id="study-video-iframe"
            title="فيديو المذاكرة"
            className="h-full w-full border-0"
            src={embed}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => {
              const iframe = document.getElementById("study-video-iframe") as HTMLIFrameElement | null;
              if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage(JSON.stringify({ event: "listening" }), "*");
                iframe.contentWindow.postMessage(JSON.stringify({ event: "command", func: "addEventListener", args: ["onStateChange"] }), "*");
              }
            }}
          />
        </div>

        {/* Live Synchronized Control & Status Bar */}
        <div className="flex items-center justify-between border-t border-white/10 bg-slate-900/95 px-4 py-2.5 text-xs text-white">
          <div className="flex items-center gap-2">
            <span className={`inline-block size-2.5 rounded-full ${session.timerRunning ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
            <span className="font-medium">
              {session.timerRunning ? (
                <span className="text-emerald-300">المؤقت متزامن مع تشغيل الفيديو: <b className="font-mono text-white text-sm">{clock(activeSeconds)}</b></span>
              ) : (
                <span className="text-amber-200">المؤقت متوقف مؤقتًا — شغّل الفيديو أو اضغط هنا للبدء</span>
              )}
            </span>
          </div>

          {onToggleTimer && (
            <button
              type="button"
              onClick={onToggleTimer}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold transition-all ${
                session.timerRunning
                  ? "bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 ring-1 ring-amber-400/40"
                  : "bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-sm"
              }`}
            >
              {session.timerRunning ? (
                <>
                  <Pause className="size-3.5" />
                  <span>إيقاف مؤقت</span>
                </>
              ) : (
                <>
                  <Play className="size-3.5 fill-current" />
                  <span>تشغيل الفيديو والمؤقت</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    );
  }

  // HTML5 Direct Video
  if (isDirectMedia(session.videoUrl)) {
    return (
      <div className="flex flex-col bg-black">
        <div className="relative aspect-video w-full bg-black">
          <video
            ref={video}
            controls
            className="h-full w-full"
            src={session.videoUrl}
            onPlay={onMediaPlay}
            onPause={onMediaPause}
            onEnded={onMediaPause}
          >
            متصفحك لا يدعم تشغيل الفيديو.
          </video>
        </div>

        {/* Live Synchronized Control & Status Bar */}
        <div className="flex items-center justify-between border-t border-white/10 bg-slate-900/95 px-4 py-2.5 text-xs text-white">
          <div className="flex items-center gap-2">
            <span className={`inline-block size-2.5 rounded-full ${session.timerRunning ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
            <span className="font-medium">
              {session.timerRunning ? (
                <span className="text-emerald-300">المؤقت متزامن مع الفيديو: <b className="font-mono text-white text-sm">{clock(activeSeconds)}</b></span>
              ) : (
                <span className="text-amber-200">المؤقت متوقف مؤقتًا مع إيقاف الفيديو</span>
              )}
            </span>
          </div>

          {onToggleTimer && (
            <button
              type="button"
              onClick={onToggleTimer}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold transition-all ${
                session.timerRunning
                  ? "bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 ring-1 ring-amber-400/40"
                  : "bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-sm"
              }`}
            >
              {session.timerRunning ? (
                <>
                  <Pause className="size-3.5" />
                  <span>إيقاف مؤقت</span>
                </>
              ) : (
                <>
                  <Play className="size-3.5 fill-current" />
                  <span>تشغيل الفيديو والمؤقت</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex aspect-video flex-col items-center justify-center gap-3 bg-slate-950 p-6 text-center text-white">
      <XCircle className="size-11 text-rose-300" />
      <p className="font-bold">هذا الرابط ليس فيديو مدعومًا للتشغيل الداخلي</p>
      <p className="max-w-md text-sm text-slate-300">
        يمكنك فتحه في منصته الأصلية ومتابعة المذاكرة من خلال خيار "درس على منصة خارجية".
      </p>
    </div>
  );
}

function BreakScreen({
  breakRemaining,
  onResume,
}: {
  breakRemaining: number;
  onResume: () => void;
}) {
  const isFinished = breakRemaining <= 0;
  const breakMinutes = Math.floor(breakRemaining / 60);
  const breakSeconds = breakRemaining % 60;
  const progressPercent = Math.min(
    100,
    Math.max(0, Math.round(((BREAK_SECONDS - breakRemaining) / BREAK_SECONDS) * 100))
  );

  return (
    <div className="relative flex aspect-video w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-center text-white">
      {/* Decorative ambient glow */}
      <div className="pointer-events-none absolute -top-20 -right-20 size-64 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 size-64 rounded-full bg-amber-500/10 blur-3xl" />

      <div className="relative z-10 flex flex-col items-center max-w-lg">
        <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/30">
          <Coffee className="size-7" />
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300 ring-1 ring-emerald-400/30">
          <Sparkles className="size-3.5" />
          <span>أحسنت! أتممت 45 دقيقة مذاكرة (+25 Coins)</span>
        </div>

        <h2 className="mt-2 text-xl font-extrabold sm:text-2xl">
          {isFinished ? "انتهت فترة الاستراحة ☕" : "استراحة مستحقة ربع ساعة (15 دقيقة)"}
        </h2>

        {/* 15-minute countdown clock */}
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-8 py-4 backdrop-blur-sm">
          <p className="font-mono text-5xl font-black tracking-wider text-amber-300 sm:text-6xl">
            {String(breakMinutes).padStart(2, "0")}:{String(breakSeconds).padStart(2, "0")}
          </p>
          <p className="mt-1 text-xs text-slate-300">
            {isFinished ? "جاهز للدورة التالية؟" : "عداد تنازلي حتى نهاية الاستراحة"}
          </p>
        </div>

        {/* Break progress bar */}
        <div className="mt-4 h-1.5 w-64 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-amber-400 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Wellness tips */}
        <div className="mt-4 flex flex-wrap justify-center gap-3 text-xs text-slate-300">
          <span className="flex items-center gap-1">🧘 خذ نفساً عميقاً</span>
          <span className="flex items-center gap-1">💧 اشرب ماء</span>
          <span className="flex items-center gap-1">👀 أرح عينيك عن الشاشة</span>
        </div>

        {/* Action Button */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button
            size="lg"
            className={`font-bold ${
              isFinished
                ? "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
            onClick={onResume}
          >
            {isFinished ? (
              <>
                <CirclePlay className="size-5" />
                ابدأ دورة الـ 45 دقيقة التالية 🚀
              </>
            ) : (
              <>
                <RotateCcw className="size-4" />
                إنهاء الاستراحة وبدء المذاكرة الآن
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ExternalLessonCard({
  session,
  activeSeconds,
  breakRemaining,
  currentBlockSeconds,
  remainingInBlock,
  blockProgressPercent,
  busy,
  onTimer,
  onProgress,
  onResumeBreak,
  onTriggerBreak,
}: {
  session: any;
  activeSeconds: number;
  breakRemaining: number;
  currentBlockSeconds: number;
  remainingInBlock: number;
  blockProgressPercent: number;
  busy: boolean;
  onTimer: () => void;
  onProgress: (progress: ProgressKey) => void;
  onResumeBreak: () => void;
  onTriggerBreak?: () => void;
}) {
  const inBreak = session.phase === "break";

  return (
    <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-white">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-emerald-300">
            <Link2 className="size-5" />
          </span>
          <div>
            <p className="text-xs text-emerald-200">درس على منصة خارجية</p>
            <h2 className="mt-1 text-xl font-bold">
              {session.lessonTitle || sourceDomain(session.videoUrl)}
            </h2>
            <p className="mt-1 text-sm text-slate-300">
              {sourceDomain(session.videoUrl)} · {subjects[session.subject as SubjectKey]}
            </p>
          </div>
        </div>

        <a href={session.videoUrl} target="_blank" rel="noopener noreferrer">
          <Button className="bg-emerald-400 font-bold text-emerald-950 hover:bg-emerald-300">
            <ExternalLink className="size-4" />
            افتح الدرس في المنصة
          </Button>
        </a>
      </div>

      <p className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
        شغّل الدرس من منصته الخارجية، وسيفي هيتابع وقتك بدقة 45 دقيقة ثم استراحة 15 دقيقة 💪
      </p>

      {inBreak ? (
        <div className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-6 text-center text-white backdrop-blur-sm">
          <Coffee className="mx-auto size-8 text-amber-300" />
          <p className="mt-2 text-sm font-bold text-amber-300">استراحة مستحقة ربع ساعة (15 دقيقة) ☕</p>
          <p className="mt-1 font-mono text-4xl font-black text-amber-300">
            {clock(breakRemaining)}
          </p>
          <p className="mt-2 text-xs text-slate-300">
            أكملت دورة 45 دقيقة بنجاح وحصلت على +25 Coins!
          </p>
          <Button
            className="mt-4 bg-amber-400 text-slate-950 hover:bg-amber-300"
            size="sm"
            onClick={onResumeBreak}
          >
            استئناف المذاكرة الآن
          </Button>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-300">وقت الدورة الحالية (45 دقيقة)</p>
              <span className="font-mono text-xs text-emerald-300">{blockProgressPercent}%</span>
            </div>
            <p className="mt-1 font-mono text-4xl font-black tracking-wider text-emerald-300">
              {clock(currentBlockSeconds)} <span className="text-xl text-slate-400">/ 45:00</span>
            </p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-400 transition-all"
                style={{ width: `${blockProgressPercent}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-400">
              المتبقي للاستراحة: {clock(remainingInBlock)}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              className="h-auto min-h-16 px-8 font-bold"
              variant={session.timerRunning ? "destructive" : "secondary"}
              disabled={busy}
              onClick={onTimer}
            >
              {session.timerRunning ? (
                <>
                  <Pause className="size-5" />
                  إيقاف مؤقت
                </>
              ) : (
                <>
                  <Play className="size-5" />
                  {session.activeSeconds ? "استئناف" : "ابدأ المؤقت"}
                </>
              )}
            </Button>
            {onTriggerBreak && (
              <Button
                variant="outline"
                size="sm"
                className="border-amber-400/40 text-amber-300 hover:bg-amber-400/10 hover:text-amber-200"
                disabled={busy}
                onClick={onTriggerBreak}
                title="بدء استراحة الـ 15 دقيقة فوراً"
              >
                <Coffee className="size-4" />
                استراحة 15 دقيقة
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="mt-5">
        <p className="mb-2 text-xs font-bold text-slate-300">تقدّمك اليدوي في الدرس</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(progressLabels) as ProgressKey[]).map(progress => (
            <Button
              key={progress}
              size="sm"
              variant={session.manualProgress === progress ? "secondary" : "outline"}
              className={
                session.manualProgress === progress
                  ? "text-slate-950 font-bold"
                  : "border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
              }
              onClick={() => onProgress(progress)}
            >
              <ListChecks className="size-4" />
              {progressLabels[progress]}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

function VideoSidebar({
  session,
  activeSeconds,
  currentBlockSeconds,
  remainingInBlock,
  blockProgressPercent,
  breakRemaining,
}: {
  session: any;
  activeSeconds: number;
  currentBlockSeconds: number;
  remainingInBlock: number;
  blockProgressPercent: number;
  breakRemaining: number;
}) {
  return (
    <aside className="space-y-4">
      {/* 45-Minute Block Timer Widget */}
      <div className="surface p-5 rounded-2xl border border-border/80 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold tracking-wider text-primary">دورة المذاكرة (45 دقيقة)</p>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
            {session.phase === "break" ? "استراحة" : `${blockProgressPercent}%`}
          </span>
        </div>

        {session.phase === "break" ? (
          <div className="mt-3">
            <p className="font-mono text-3xl font-extrabold text-amber-500">
              {clock(breakRemaining)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              متبقي على انتهاء استراحة الـ 15 دقيقة
            </p>
          </div>
        ) : (
          <div className="mt-3">
            <p className="font-mono text-3xl font-extrabold">
              {clock(currentBlockSeconds)}{" "}
              <span className="text-base font-normal text-muted-foreground">/ 45:00</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              متبقي {clock(remainingInBlock)} حتى يفصل الفيديو وتبدأ الاستراحة
            </p>
          </div>
        )}

        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              session.phase === "break" ? "bg-amber-400" : "bg-primary"
            }`}
            style={{
              width: `${
                session.phase === "break"
                  ? Math.max(0, Math.min(100, Math.round(((BREAK_SECONDS - breakRemaining) / BREAK_SECONDS) * 100)))
                  : blockProgressPercent
              }%`,
            }}
          />
        </div>
      </div>

      {/* Total Active Time */}
      <div className="surface p-5 rounded-2xl border border-border/80 shadow-sm">
        <p className="text-xs font-bold tracking-wider text-primary">إجمالي وقت المذاكرة بالجلسة</p>
        <p className="mt-2 font-mono text-3xl font-extrabold">{clock(activeSeconds)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          محسوب بدقة لكل ثانية تشغيل أو مذاكرة نشطة
        </p>
      </div>

      {/* Completed Blocks & Rewards */}
      <div className="surface p-5 rounded-2xl border border-border/80 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PlayCircle className="size-5 text-primary" />
            <h2 className="font-bold">الدورات المكتملة</h2>
          </div>
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            +25 Coins لكل دورة
          </span>
        </div>

        <p className="font-mono text-3xl font-extrabold">{money.format(session.completedBlocks)}</p>
        <p className="mt-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          +{money.format(session.completedBlocks * 25)} Coins مكتسبة من هذا الفيديو
        </p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          كل 45 دقيقة مذاكرة تمنحك دورة مكتملة + 25 Coins وتفتح استراحة 15 دقيقة لتجديد نشاطك.
        </p>
      </div>
    </aside>
  );
}

function NoteEditor({
  title,
  content,
  editing,
  onTitle,
  onContent,
  onSave,
  onCancel,
  busy,
  external = false,
}: {
  title: string;
  content: string;
  editing: boolean;
  onTitle: (value: string) => void;
  onContent: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
  external?: boolean;
}) {
  return (
    <section className="surface rounded-2xl border border-border/80 p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Pencil className="size-5 text-primary" />
        <h2 className="font-bold">{editing ? "تعديل الملاحظة" : "ملاحظة سريعة أثناء الدرس"}</h2>
      </div>

      <Input
        value={title}
        onChange={event => onTitle(event.target.value)}
        placeholder="عنوان الملاحظة أو النقطة المهمة"
      />
      <Textarea
        className="mt-3 min-h-32"
        value={content}
        onChange={event => onContent(event.target.value)}
        placeholder="اكتب ما تريد تذكره من الشرح، القوانين، أو الملاحظات..."
      />

      <p className="mt-2 text-xs text-muted-foreground">
        {external
          ? "سيتم ربط الملاحظة بوقت الجلسة الحالي تلقائيًا."
          : "سيتم حفظ توقيت المشاهدة الحالي مع الملاحظة لتتمكن من الرجوع لها لاحقًا."}
      </p>

      <div className="mt-4 flex gap-2">
        <Button disabled={!title.trim() || !content.trim() || busy} onClick={onSave}>
          <Save className="size-4" />
          حفظ الملاحظة
        </Button>
        {editing && (
          <Button variant="outline" onClick={onCancel}>
            إلغاء
          </Button>
        )}
      </div>
    </section>
  );
}

function safeExportName(url: string) {
  return (
    url.match(/(?:v=|youtu\.be\/|\/)([A-Za-z0-9_-]{6,})/)?.[1] ?? "video-notes"
  ).slice(0, 48);
}

export function formatVideoNotesText(item: VideoHistoryItem) {
  const title = item.lessonTitle || sourceDomain(item.videoUrl);
  const lines = [
    `Seif Study OS — ملاحظات الدرس`,
    `الدرس: ${title}`,
    `المادة: ${item.subject ? subjects[item.subject] ?? item.subject : "عام"}`,
    `المصدر: ${item.sourceMode === "external" ? "منصة خارجية" : "داخل الموقع"}`,
    `التقدم: ${item.manualProgress ? progressLabels[item.manualProgress] ?? item.manualProgress : "قيد المذاكرة"}`,
    `الرابط: ${item.videoUrl}`,
    `تاريخ آخر نشاط: ${shortDate.format(new Date(item.updatedAt))}`,
    `وقت المذاكرة النشط: ${clock(item.activeSeconds)}`,
    `الدورات المكتملة: ${item.completedBlocks}`,
    "",
    ...item.notes.flatMap((note, index) => [
      `${index + 1}. ${note.title}`,
      `${noteTime(note.timestampSeconds)} · ${shortDate.format(new Date(note.updatedAt))}`,
      note.content,
      "",
    ]),
  ];
  return lines.join("\n");
}

function downloadText(item: VideoHistoryItem) {
  const blob = new Blob(["\ufeff" + formatVideoNotesText(item)], {
    type: "text/plain;charset=utf-8",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${safeExportName(item.videoUrl)}-notes.txt`;
  link.click();
  URL.revokeObjectURL(link.href);
  toast.success("تم تنزيل الملاحظات كملف نصي.");
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    char =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      }[char] ?? char)
  );
}

function printPdf(item: VideoHistoryItem) {
  const popup = window.open("", "_blank", "width=900,height=700");
  if (!popup) {
    toast.error("اسمح بالنوافذ المنبثقة لإنشاء ملف PDF.");
    return;
  }
  const notes = item.notes
    .map(
      (note, index) =>
        `<article><h2>${index + 1}. ${escapeHtml(note.title)}</h2><p class=meta>${escapeHtml(
          noteTime(note.timestampSeconds)
        )} · ${escapeHtml(shortDate.format(new Date(note.updatedAt)))}</p><p>${escapeHtml(
          note.content
        ).replace(/\n/g, "<br />")}</p></article>`
    )
    .join("");

  popup.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>ملاحظات الدرس</title><style>body{font-family:Arial,sans-serif;line-height:1.8;padding:40px;color:#10211d}h1{color:#087f6a;border-bottom:2px solid #bde7dc;padding-bottom:12px}h2{margin-bottom:4px}p{white-space:normal}.meta{color:#60736e;font-size:12px}article{border-bottom:1px solid #d9e4e0;padding:14px 0}@media print{button{display:none}}</style></head><body><h1>ملاحظات الدرس</h1><p>${escapeHtml(
    item.lessonTitle || sourceDomain(item.videoUrl)
  )}</p><p>${escapeHtml(subjects[item.subject])} · ${escapeHtml(
    item.sourceMode === "external" ? "منصة خارجية" : "داخل الموقع"
  )} · ${escapeHtml(progressLabels[item.manualProgress])}</p><p class="meta">${escapeHtml(
    shortDate.format(new Date(item.updatedAt))
  )} · ${clock(item.activeSeconds)} مذاكرة · ${item.completedBlocks} دورات</p>${
    notes || "<p>لا توجد ملاحظات لهذا الدرس.</p>"
  }<button onclick="window.print()">طباعة / حفظ كـ PDF</button></body></html>`);
  popup.document.close();
  popup.focus();
  window.setTimeout(() => popup.print(), 300);
}

function VideoHistory({
  history,
  sessionId,
  onEdit,
  onDelete,
}: {
  history: VideoHistoryItem[];
  sessionId?: number;
  onEdit: (note: VideoNote) => void;
  onDelete: (noteId: number) => void;
}) {
  const items = sessionId ? history.filter(item => item.id === sessionId) : history;

  return (
    <section className="surface mx-auto mt-5 w-full max-w-5xl rounded-2xl border border-border/80 p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <History className="size-5 text-primary" />
        <h2 className="font-bold">سجل الدروس والملاحظات</h2>
      </div>

      {items.length ? (
        <div className="space-y-4">
          {items.map(item => (
            <article key={item.id} className="rounded-2xl border border-border/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {item.lessonTitle || sourceDomain(item.videoUrl)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {subjects[item.subject]} ·{" "}
                    {item.sourceMode === "external" ? "على منصة خارجية" : "داخل الموقع"} ·{" "}
                    {progressLabels[item.manualProgress]}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {shortDate.format(new Date(item.updatedAt))} · {clock(item.activeSeconds)} مذاكرة
                    · {item.completedBlocks} دورات
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {item.notes.length} ملاحظات
                  </span>
                  {item.sourceMode === "external" && (
                    <a href={item.videoUrl} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline">
                        <ExternalLink className="size-4" />
                        افتح المصدر
                      </Button>
                    </a>
                  )}
                  <Button size="sm" variant="outline" onClick={() => downloadText(item)}>
                    <Download className="size-4" />
                    TXT
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => printPdf(item)}>
                    <Printer className="size-4" />
                    PDF
                  </Button>
                </div>
              </div>

              {item.notes.length ? (
                <div className="mt-4 space-y-3">
                  {item.notes.map(note => (
                    <div key={note.id} className="rounded-xl bg-muted/50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{note.title}</p>
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                            {note.content}
                          </p>
                          <p className="mt-2 text-xs text-primary">
                            {noteTime(note.timestampSeconds)} ·{" "}
                            {shortDate.format(new Date(note.updatedAt))}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="تعديل الملاحظة"
                            onClick={() => onEdit(note)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="حذف الملاحظة"
                            onClick={() => onDelete(note.id)}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  لا توجد ملاحظات لهذا الدرس حتى الآن.
                </p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          ستظهر هنا الدروس وملاحظاتها بعد بدء أول جلسة.
        </div>
      )}
    </section>
  );
}
