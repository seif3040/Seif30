import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";

export function useAudioTranscribe() {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  const startRecording = useCallback(async () => {
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(250); // collect chunks every 250ms
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error("Failed to start recording:", err);
      toast.error("تعذر تشغيل الميكروفون للتسجيل. يرجى السماح بالإذن.");
    }
  }, []);

  const stopRecordingAndTranscribe = useCallback(async (): Promise<string | null> => {
    if (!mediaRecorderRef.current) return null;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setIsRecording(false);
    setIsTranscribing(true);

    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder) {
        setIsTranscribing(false);
        resolve(null);
        return;
      }

      recorder.onstop = async () => {
        try {
          // Stop mic tracks
          recorder.stream.getTracks().forEach((track) => track.stop());

          const mimeType = recorder.mimeType || "audio/webm";
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

          // Convert blob to base64
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            try {
              const base64Data = (reader.result as string).split(",")[1];
              const response = await fetch("/api/gemini/transcribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  audioBase64: base64Data,
                  mimeType,
                }),
              });

              if (!response.ok) {
                const errJson = await response.json().catch(() => ({}));
                throw new Error(errJson.error || "تعذّر تفريغ الصوت");
              }

              const result = await response.json();
              const transcript = result.text?.trim() || "";
              setIsTranscribing(false);
              resolve(transcript);
            } catch (postErr: any) {
              console.error("Transcription API error:", postErr);
              toast.error(postErr.message || "فشل تفريغ التسجيل الصوتي");
              setIsTranscribing(false);
              resolve(null);
            }
          };
        } catch (err: any) {
          console.error("Audio processing error:", err);
          setIsTranscribing(false);
          resolve(null);
        }
      };

      recorder.stop();
    });
  }, []);

  const cancelRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setIsTranscribing(false);
    setRecordingSeconds(0);
    audioChunksRef.current = [];
  }, []);

  return {
    isRecording,
    isTranscribing,
    recordingSeconds,
    startRecording,
    stopRecordingAndTranscribe,
    cancelRecording,
  };
}
