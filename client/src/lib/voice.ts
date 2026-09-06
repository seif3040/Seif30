export type SpeechRecognitionConstructor = new () => {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onstart: (() => void) | null;
  onerror: ((event?: { error?: string }) => void) | null;
  onend: (() => void) | null;
  onresult: ((event: unknown) => void) | null;
  start: () => void;
  stop: () => void;
};

export type ArabicVoice = Pick<SpeechSynthesisVoice, "voiceURI" | "name" | "lang" | "default">;
const ARABIC_PRIORITY = ["ar-eg", "ar-sa", "ar-ae", "ar-kw", "ar-qa", "ar-ma", "ar"];

export function getSpeechRecognitionConstructor(runtime: { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }) {
  return runtime.SpeechRecognition ?? runtime.webkitSpeechRecognition ?? null;
}

export function voiceRecognitionUnavailableMessage() {
  return "المتصفح ده مش بيدعم الاستماع الصوتي المباشر. جرّب متصفح Google Chrome للحصول على أفضل تجربة صوتية.";
}

export function voiceRecognitionFailedMessage() {
  return "ما سمعتكش بوضوح يا بطل. قرّب من المايك وقول «يا سيفي» أو دوس واتكلم تاني.";
}

export function voiceRecognitionErrorMessage(error?: string) {
  if (["not-allowed", "service-not-allowed"].includes(error ?? "")) {
    return "المتصفح مانع الميكروفون. اضغط على علامة القفل أو إعدادات الموقع جنب العنوان وفعّل الميكروفون.";
  }
  if (["audio-capture", "not-found"].includes(error ?? "")) {
    return "مش لاقي ميكروفون شغّال. اتأكد من توصيل المايك وتفعيله من إعدادات الصوت.";
  }
  if (error === "network") {
    return "في مشكلة في الاتصال الصوتي. اتأكد من اتصالك بالإنترنت وجرّب تاني.";
  }
  if (error === "no-speech") {
    return "ماسمعتش صوتك كويس. ناديني بـ «يا سيفي» واتكلم بعدها علطول.";
  }
  return voiceRecognitionFailedMessage();
}

export function microphoneAccessErrorMessage(error?: { name?: string } | null) {
  if (["NotAllowedError", "SecurityError"].includes(error?.name ?? "")) return voiceRecognitionErrorMessage("not-allowed");
  if (["NotFoundError", "DevicesNotFoundError", "OverconstrainedError"].includes(error?.name ?? "")) return voiceRecognitionErrorMessage("audio-capture");
  return "مش قادر أجهز الميكروفون دلوقتي. اتأكد إنه مش مستخدم في تطبيق تاني وجرّب تاني.";
}

type MicrophoneRuntime = {
  navigator?: {
    mediaDevices?: {
      getUserMedia?: (constraints: MediaStreamConstraints) => Promise<{ getTracks: () => { stop: () => void }[] }>;
    };
  };
};

export async function prepareMicrophone(runtime: MicrophoneRuntime) {
  const getUserMedia = runtime.navigator?.mediaDevices?.getUserMedia;
  if (!getUserMedia) return { allowed: true as const };
  try {
    const stream = await getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    return { allowed: true as const };
  } catch (error) {
    const name = (error as { name?: string })?.name ?? "";
    if (["NotAllowedError", "SecurityError", "NotFoundError", "DevicesNotFoundError", "OverconstrainedError"].includes(name)) {
      return { allowed: false as const, message: microphoneAccessErrorMessage(error as { name?: string }) };
    }
    return { allowed: true as const, warning: microphoneAccessErrorMessage(error as { name?: string }) };
  }
}

export function arabicVoiceUnavailableMessage() {
  return "مش لاقي صوت عربي مثبت على جهازك. المتصفح هيستخدم أقرب صوت متاح أو تقدر تثبت حزمة صوتية عربية (مصرية) من إعدادات النظام.";
}

export function listArabicVoices(voices: ArabicVoice[]) {
  return voices.filter(voice => /^ar(?:[-_]|$)/i.test(voice.lang) || /arabic|عربي|مصر/i.test(voice.name));
}

export function selectArabicVoice(voices: ArabicVoice[], selectedVoiceURI?: string | null) {
  const arabic = listArabicVoices(voices);
  if (!arabic.length) return null;

  // 1. Explicitly selected voice
  if (selectedVoiceURI) {
    const explicitlySelected = arabic.find(voice => voice.voiceURI === selectedVoiceURI);
    if (explicitlySelected) return explicitlySelected;
  }

  // 2. High priority to Egyptian dialect voices (ar-EG or name containing Egypt/Hoda/Maged/Shakir/Salma)
  const egyptianVoice = arabic.find(
    v => /ar[-_]eg/i.test(v.lang) || /egypt|مصر|hoda|maged|salma|shakir|tarek/i.test(v.name)
  );
  if (egyptianVoice) return egyptianVoice;

  // 3. Fallback priority across standard Arabic dialects
  return [...arabic].sort((a, b) => {
    const aRank = ARABIC_PRIORITY.indexOf(a.lang.toLowerCase().replace("_", "-"));
    const bRank = ARABIC_PRIORITY.indexOf(b.lang.toLowerCase().replace("_", "-"));
    return (aRank < 0 ? ARABIC_PRIORITY.length : aRank) - (bRank < 0 ? ARABIC_PRIORITY.length : bRank) || Number(b.default) - Number(a.default);
  })[0];
}

export function cleanSpeechText(text: string): string {
  return text
    .replace(/[*_~`#><[\]()«»]/g, " ")
    .replace(/https?:\/\/\S+/g, " رابط خارجي ")
    .replace(/\s+/g, " ")
    .trim();
}

let audioCtx: AudioContext | null = null;
export function playAssistantChime(type: "wake" | "listen" | "finish") {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioCtx) audioCtx = new AudioContextClass();
    if (audioCtx.state === "suspended") audioCtx.resume();

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === "wake") {
      // Ascending futuristic chime
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.12); // G5
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.23);
    } else if (type === "listen") {
      // Soft high ping
      osc.type = "triangle";
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.16);
    } else if (type === "finish") {
      // Gentle warm chord
      osc.type = "sine";
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.18); // C5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.26);
    }
  } catch {
    // Non-fatal if audio context fails
  }
}

export function speakArabicText(
  runtime: Pick<SpeechSynthesis, "cancel" | "speak">,
  text: string,
  voices: ArabicVoice[],
  selectedVoiceURI?: string | null,
  options?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: any) => void;
  }
) {
  const voice = selectArabicVoice(voices, selectedVoiceURI);
  if (!voice) {
    // If no Arabic voice is registered, try any voice that might support Arabic or fallback
    return false;
  }

  try {
    runtime.cancel();
    const clean = cleanSpeechText(text);
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.voice = voice as SpeechSynthesisVoice;
    utterance.lang = voice.lang || "ar-EG";
    // Slightly natural pitch and cadence for warm Egyptian colloquial speech
    utterance.rate = 1.02;
    utterance.pitch = 1.05;

    if (options?.onStart) utterance.onstart = options.onStart;
    if (options?.onEnd) utterance.onend = options.onEnd;
    if (options?.onError) utterance.onerror = options.onError;

    runtime.speak(utterance);
    return true;
  } catch (err) {
    if (options?.onError) options.onError(err);
    return false;
  }
}

export function isWakeWordDetected(transcript: string): boolean {
  const normalized = transcript
    .replace(/[أإآ]/g, "ا")
    .replace(/[ة]/g, "ه")
    .replace(/[ى]/g, "ي")
    .toLowerCase();

  return (
    normalized.includes("سيفي") ||
    normalized.includes("يا سيفي") ||
    normalized.includes("يا سيف") ||
    normalized.includes("سيف")
  );
}

export function cleanWakeWordPrompt(transcript: string): string {
  return transcript
    .replace(/^(يا\s+)?(سيفي|سيف)\s*[,،:]?\s*/i, "")
    .trim();
}

export function startVoiceRecognition(
  runtime: { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor },
  handlers: {
    onStart: () => void;
    onError: (error?: string) => void;
    onEnd: () => void;
    onTranscript: (text: string) => void;
    onInterim?: (text: string) => void;
    onUnavailable: () => void;
    continuous?: boolean;
  }
) {
  const Recognition = getSpeechRecognitionConstructor(runtime);
  if (!Recognition) {
    handlers.onUnavailable();
    return null;
  }

  try {
    const instance = new Recognition();
    instance.lang = "ar-EG";
    instance.interimResults = Boolean(handlers.onInterim);
    instance.continuous = Boolean(handlers.continuous);

    instance.onstart = handlers.onStart;
    instance.onerror = event => handlers.onError(event?.error);
    instance.onend = handlers.onEnd;

    instance.onresult = (event: any) => {
      const results = event?.results;
      if (!results) return;

      let interim = "";
      let final = "";

      for (let i = 0; i < results.length; ++i) {
        const item = results[i];
        const text = item?.[0]?.transcript?.trim() || "";
        if (item.isFinal) {
          final += (final ? " " : "") + text;
        } else {
          interim += (interim ? " " : "") + text;
        }
      }

      if (handlers.onInterim && interim) {
        handlers.onInterim(interim);
      }
      if (final) {
        handlers.onTranscript(final);
      } else if (!instance.continuous && !final && interim) {
        handlers.onTranscript(interim);
      }
    };

    instance.start();
    return instance;
  } catch {
    handlers.onError("start-failed");
    return null;
  }
}
