import { useCallback, useEffect, useState } from "react";
import { arabicVoiceUnavailableMessage, listArabicVoices, selectArabicVoice, speakArabicText, type ArabicVoice } from "@/lib/voice";

const STORAGE_KEY = "seify-arabic-voice-uri";

export function useArabicVoice() {
  const [voices, setVoices] = useState<ArabicVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const update = () => {
      const all = window.speechSynthesis.getVoices();
      const arabic = listArabicVoices(all);
      setVoices(arabic);
      if (!selectedVoiceURI && arabic.length > 0) {
        const best = selectArabicVoice(arabic);
        if (best) setSelectedVoiceURI(best.voiceURI);
      }
    };

    try {
      setSelectedVoiceURI(window.localStorage.getItem(STORAGE_KEY));
    } catch {
      /* storage can be unavailable */
    }

    update();
    window.speechSynthesis.addEventListener("voiceschanged", update);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", update);
  }, []);

  const chooseVoice = useCallback((voiceURI: string) => {
    setSelectedVoiceURI(voiceURI);
    try {
      window.localStorage.setItem(STORAGE_KEY, voiceURI);
    } catch {
      /* storage can be unavailable */
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(
    (text: string, callbacks?: { onStart?: () => void; onEnd?: () => void }) => {
      if (!("speechSynthesis" in window)) {
        return { played: false, message: arabicVoiceUnavailableMessage() };
      }

      const played = speakArabicText(
        window.speechSynthesis,
        text,
        voices,
        selectedVoiceURI,
        {
          onStart: () => {
            setIsSpeaking(true);
            callbacks?.onStart?.();
          },
          onEnd: () => {
            setIsSpeaking(false);
            callbacks?.onEnd?.();
          },
          onError: () => {
            setIsSpeaking(false);
            callbacks?.onEnd?.();
          },
        }
      );

      return { played, message: played ? "" : arabicVoiceUnavailableMessage() };
    },
    [voices, selectedVoiceURI]
  );

  const testVoice = useCallback(() => {
    return speak("أهلاً بيك يا سيف، أنا سيفي رفيق مذاكرتك. سامع صوتي بوضوح؟");
  }, [speak]);

  return {
    voices,
    selectedVoiceURI,
    selectedVoice: selectArabicVoice(voices, selectedVoiceURI),
    chooseVoice,
    speak,
    stopSpeaking,
    isSpeaking,
    testVoice,
  };
}
