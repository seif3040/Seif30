import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLiveVoice } from "@/hooks/useLiveVoice";
import { useAudioTranscribe } from "@/hooks/useAudioTranscribe";
import { useFirebaseUser, saveChatMessageToFirestore } from "@/lib/firebase";
import {
  Bot,
  Send,
  Sparkles,
  Search,
  Globe,
  Mic,
  Square,
  Volume2,
  Copy,
  Check,
  PhoneCall,
  PhoneOff,
  Radio,
  Cpu,
  GraduationCap,
  Layers,
  Lightbulb,
  ExternalLink,
  Trash2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  sources?: { title: string; uri: string }[];
  timestamp: string;
};

const initialGreetings: ChatMessage[] = [
  {
    id: "greet-1",
    role: "assistant",
    content: "أهلاً بك يا بطل! أنا سيفي، رفيقك التعليمي الذكي المدعوم بنماذج Gemini. يمكنك سؤالي عن أي مسألة أو مفهوم دراسي، أو البحث في الويب ببيانات Google Search المباشرة، أو التحدث معي بالصوت الحقيقي.",
    model: "gemini-3.5-flash",
    timestamp: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
  },
];

export function GeminiStudyChat({ defaultRole = "study_mentor" }: { defaultRole?: string }) {
  const { user } = useFirebaseUser();
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem("seif_study_gemini_chat");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return initialGreetings;
      }
    }
    return initialGreetings;
  });

  const [inputPrompt, setInputPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState<"gemini-3.5-flash" | "gemini-3.1-flash-lite" | "gemini-3.1-pro-preview">("gemini-3.5-flash");
  const [selectedRole, setSelectedRole] = useState<"study_mentor" | "exam_tutor" | "concept_explainer">(
    defaultRole as any || "study_mentor"
  );
  const [useSearch, setUseSearch] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showLiveVoiceModal, setShowLiveVoiceModal] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Live voice hook (gemini-3.1-flash-live-preview)
  const liveVoice = useLiveVoice();

  // Audio transcribe hook (gemini-3.5-transcribe)
  const transcribe = useAudioTranscribe();

  useEffect(() => {
    localStorage.setItem("seif_study_gemini_chat", JSON.stringify(messages));
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputPrompt).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: "usr-" + Date.now(),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputPrompt("");
    setIsLoading(true);

    if (user?.uid) {
      saveChatMessageToFirestore(user.uid, {
        role: "user",
        content: text,
      });
    }

    try {
      const response = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          model: selectedModel,
          role: selectedRole,
          useSearch,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "فشل توليد الإجابة");
      }

      const data = await response.json();
      const assistantMsg: ChatMessage = {
        id: "ast-" + Date.now(),
        role: "assistant",
        content: data.text || "تم تلقي إجابتك.",
        model: data.model || selectedModel,
        sources: data.sources || [],
        timestamp: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (user?.uid) {
        saveChatMessageToFirestore(user.uid, {
          role: "assistant",
          content: assistantMsg.content,
          model: assistantMsg.model,
          sources: assistantMsg.sources,
        });
      }
    } catch (err: any) {
      console.error("Chat error:", err);
      toast.error(err.message || "حدث خطأ أثناء التواصل مع Gemini");
      const errorMsg: ChatMessage = {
        id: "err-" + Date.now(),
        role: "assistant",
        content: "عذراً يا صديقي، حدث تعثر مؤقت في الاتصال بالنموذج. تأكد من اتصال الإنترنت ثم أعد المحاولة.",
        model: selectedModel,
        timestamp: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("تم نسخ النص للحافظة");
  };

  const handleTranscribeComplete = async () => {
    const transcript = await transcribe.stopRecordingAndTranscribe();
    if (transcript) {
      setInputPrompt((prev) => (prev ? prev + " " + transcript : transcript));
      toast.success("تم تفريغ الصوت بنجاح عبر gemini-3.5-transcribe!");
    }
  };

  const clearChat = () => {
    if (confirm("هل تريد مسح سجل المحادثة الحالي؟")) {
      setMessages(initialGreetings);
      localStorage.removeItem("seif_study_gemini_chat");
      toast.info("تم مسح سجل المحادثة");
    }
  };

  return (
    <div className="flex h-full flex-col rounded-3xl border border-border/80 bg-card/60 shadow-xl backdrop-blur-md overflow-hidden">
      {/* Top Header & Model / Role Controls */}
      <header className="border-b border-border/60 bg-muted/30 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
              <Bot className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base tracking-tight">سيفي — رفيق المذاكرة الذكي (Gemini Chat)</h3>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary">
                  {selectedModel === "gemini-3.1-pro-preview" ? "Pro 3.1" : selectedModel === "gemini-3.1-flash-lite" ? "Flash-Lite" : "Flash 3.5"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">شات متعدد الأدوار، بحث لحظي مع Google Search، ومحادثة صوتية حية</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Live Voice Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowLiveVoiceModal(true);
                if (!liveVoice.isConnected) {
                  liveVoice.connect();
                }
              }}
              className="gap-2 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400 font-bold"
            >
              <Radio className="size-4 animate-pulse text-emerald-500" />
              محادثة صوتية حية (Live API)
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={clearChat}
              title="مسح المحادثة"
              className="size-9 rounded-xl text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>

        {/* Filters and Switches Row */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40 text-xs">
          {/* Models Selector */}
          <div className="flex items-center gap-1.5 bg-background/80 p-1 rounded-xl border border-border/60">
            <span className="text-muted-foreground px-1 font-medium">النموذج:</span>
            <button
              onClick={() => setSelectedModel("gemini-3.5-flash")}
              className={cn(
                "rounded-lg px-2.5 py-1 font-bold transition-all",
                selectedModel === "gemini-3.5-flash"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              3.5 Flash (عام)
            </button>
            <button
              onClick={() => setSelectedModel("gemini-3.1-flash-lite")}
              className={cn(
                "rounded-lg px-2.5 py-1 font-bold transition-all",
                selectedModel === "gemini-3.1-flash-lite"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              3.1 Flash-Lite (سريع)
            </button>
            <button
              onClick={() => setSelectedModel("gemini-3.1-pro-preview")}
              className={cn(
                "rounded-lg px-2.5 py-1 font-bold transition-all",
                selectedModel === "gemini-3.1-pro-preview"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              3.1 Pro (عميق للمسائل)
            </button>
          </div>

          {/* Role Persona Selector */}
          <div className="flex items-center gap-1.5 bg-background/80 p-1 rounded-xl border border-border/60">
            <span className="text-muted-foreground px-1 font-medium">الدور:</span>
            <button
              onClick={() => setSelectedRole("study_mentor")}
              className={cn(
                "flex items-center gap-1 rounded-lg px-2.5 py-1 font-bold transition-all",
                selectedRole === "study_mentor"
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <GraduationCap className="size-3.5" />
              مرشد مذاكرة
            </button>
            <button
              onClick={() => setSelectedRole("exam_tutor")}
              className={cn(
                "flex items-center gap-1 rounded-lg px-2.5 py-1 font-bold transition-all",
                selectedRole === "exam_tutor"
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Layers className="size-3.5" />
              خبير امتحانات
            </button>
            <button
              onClick={() => setSelectedRole("concept_explainer")}
              className={cn(
                "flex items-center gap-1 rounded-lg px-2.5 py-1 font-bold transition-all",
                selectedRole === "concept_explainer"
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Lightbulb className="size-3.5" />
              مبسط مفاهيم
            </button>
          </div>

          {/* Google Search Grounding Toggle */}
          <button
            onClick={() => setUseSearch((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-bold transition-all border",
              useSearch
                ? "border-blue-500/40 bg-blue-500/15 text-blue-600 dark:text-blue-400"
                : "border-border/60 bg-background/80 text-muted-foreground hover:text-foreground"
            )}
            title="تفعيل البحث اللحظي وتوثيق الروابط من Google Search"
          >
            <Globe className={cn("size-3.5", useSearch && "animate-spin text-blue-500")} />
            <span>بحث جوجل مباشر (Search Grounding)</span>
            <span className={cn("size-2 rounded-full", useSearch ? "bg-blue-500" : "bg-muted-foreground/40")} />
          </button>
        </div>
      </header>

      {/* Messages Thread */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[350px]">
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={msg.id}
              className={cn("flex flex-col max-w-[88%]", isUser ? "mr-auto items-start" : "ml-auto items-end")}
            >
              <div
                className={cn(
                  "rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
                  isUser
                    ? "bg-primary text-primary-foreground rounded-tr-xs"
                    : "bg-muted/70 text-foreground border border-border/70 rounded-tl-xs"
                )}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {/* Grounding Sources / Search Citations if present */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-border/40">
                    <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 mb-1.5">
                      <Globe className="size-3" />
                      مصادر بحث Google Search الموثقة:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.sources.map((src, i) => (
                        <a
                          key={i}
                          href={src.uri}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] bg-background/80 hover:bg-background px-2 py-0.5 rounded-lg border border-border/60 text-foreground/80 hover:text-primary transition-colors"
                        >
                          <span className="truncate max-w-[180px]">{src.title || src.uri}</span>
                          <ExternalLink className="size-2.5 shrink-0 opacity-60" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Message metadata and actions */}
              <div className="mt-1 flex items-center gap-2 px-1 text-[10px] text-muted-foreground">
                <span>{msg.timestamp}</span>
                {msg.model && <span>• {msg.model}</span>}
                {!isUser && (
                  <button
                    onClick={() => copyToClipboard(msg.id, msg.content)}
                    className="hover:text-foreground flex items-center gap-0.5"
                    title="نسخ الإجابة"
                  >
                    {copiedId === msg.id ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                    <span>{copiedId === msg.id ? "تم النسخ" : "نسخ"}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground p-3 rounded-2xl bg-muted/40 border border-border/40 max-w-sm mr-auto animate-pulse">
            <Loader2 className="size-4 animate-spin text-primary" />
            <span>سيفي يفكر ويجمع المعلومات عبر Gemini...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form & Speech Transcribe */}
      <footer className="border-t border-border/60 bg-muted/20 p-3">
        {/* Transcription recording indicator */}
        {transcribe.isRecording && (
          <div className="mb-2 flex items-center justify-between rounded-xl bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-destructive animate-ping" />
              <span className="font-bold">جارٍ التسجيل الصوتي... ({transcribe.recordingSeconds} ثانية)</span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="destructive" onClick={handleTranscribeComplete} className="h-7 text-xs">
                <Square className="size-3 ml-1" />
                تفريغ الصوت (Transcribe)
              </Button>
              <Button size="sm" variant="ghost" onClick={transcribe.cancelRecording} className="h-7 text-xs">
                إلغاء
              </Button>
            </div>
          </div>
        )}

        {transcribe.isTranscribing && (
          <div className="mb-2 flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-3 py-2 text-xs text-primary">
            <Loader2 className="size-3.5 animate-spin" />
            <span>جارٍ تحويل الصوت لنص عربي دقيق عبر gemini-3.5-transcribe...</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* Audio Transcribe Mic Button */}
          <Button
            type="button"
            variant={transcribe.isRecording ? "destructive" : "outline"}
            size="icon"
            onClick={transcribe.isRecording ? handleTranscribeComplete : transcribe.startRecording}
            disabled={transcribe.isTranscribing || isLoading}
            className="size-11 rounded-2xl shrink-0"
            title="تسجيل صوتي وتفريغه عبر gemini-3.5-transcribe"
          >
            <Mic className={cn("size-5", transcribe.isRecording && "animate-bounce")} />
          </Button>

          <Input
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={
              useSearch
                ? "اسأل سؤالك وسيقوم سيفي بالبحث المباشر في Google Search..."
                : "اسأل سيفي في أي مادة، مسألة، أو تلخيص..."
            }
            className="h-11 rounded-2xl bg-background text-sm"
            disabled={isLoading || transcribe.isRecording}
          />

          <Button
            type="button"
            onClick={() => handleSendMessage()}
            disabled={!inputPrompt.trim() || isLoading}
            className="size-11 rounded-2xl shrink-0 bg-primary text-primary-foreground shadow-md shadow-primary/20"
          >
            {isLoading ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
          </Button>
        </div>
      </footer>

      {/* Modal for Live API Real-Time Voice Conversation (gemini-3.1-flash-live-preview) */}
      {showLiveVoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-primary/30 bg-card p-6 shadow-2xl text-center space-y-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2 text-right">
                <Radio className="size-5 text-emerald-500 animate-pulse" />
                <div>
                  <h4 className="font-extrabold text-base">محادثة صوتية حية (Live API)</h4>
                  <p className="text-xs text-muted-foreground">gemini-3.1-flash-live-preview</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  liveVoice.disconnect();
                  setShowLiveVoiceModal(false);
                }}
                className="rounded-xl"
              >
                إغلاق
              </Button>
            </div>

            {/* Sound Wave Animation */}
            <div className="relative flex flex-col items-center justify-center py-8">
              <div
                className={cn(
                  "size-28 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl",
                  liveVoice.isSpeaking
                    ? "bg-emerald-500 text-white scale-110 shadow-emerald-500/40"
                    : liveVoice.isConnected
                    ? "bg-primary text-primary-foreground animate-pulse shadow-primary/30"
                    : "bg-muted text-muted-foreground"
                )}
                style={{
                  transform: liveVoice.audioLevel ? `scale(${1 + liveVoice.audioLevel * 0.4})` : undefined,
                }}
              >
                {liveVoice.isSpeaking ? <Volume2 className="size-12 animate-pulse" /> : <Mic className="size-12" />}
              </div>

              {/* Status text */}
              <div className="mt-6 text-sm font-bold">
                {liveVoice.state === "connecting" && <span className="text-amber-500">جارٍ الاتصال بنموذج Live API...</span>}
                {liveVoice.state === "connected" && <span className="text-emerald-500">سيفي يستمع لك الآن! تكلّم مباشرةً...</span>}
                {liveVoice.state === "speaking" && <span className="text-emerald-600 dark:text-emerald-400">سيفي يتحدث إليك بصوته الحي...</span>}
                {liveVoice.state === "listening" && <span className="text-primary">بانتظار كلامك (الميكروفون نشط)...</span>}
                {liveVoice.state === "disconnected" && <span className="text-muted-foreground">المحادثة متوقفة</span>}
                {liveVoice.state === "error" && <span className="text-destructive">{liveVoice.errorMessage || "حدث خطأ في الاتصال"}</span>}
              </div>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                تحدث مع سيفي في أي موضوع دراسي وسيرد عليك فوراً بدون انتظار. يمكنك مقاطعته في أي لحظة.
              </p>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-3 pt-2">
              {liveVoice.isConnected ? (
                <Button
                  variant="destructive"
                  onClick={liveVoice.disconnect}
                  className="rounded-2xl gap-2 font-bold px-6 h-12"
                >
                  <PhoneOff className="size-5" />
                  إنهاء المحادثة
                </Button>
              ) : (
                <Button
                  onClick={liveVoice.connect}
                  className="rounded-2xl gap-2 font-bold px-6 h-12 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <PhoneCall className="size-5" />
                  بدء المحادثة الصوتية
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
