import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";

// Converts Float32Array PCM from Web Audio API to 16-bit linear PCM (little-endian) Base64
function floatTo16BitPCMBase64(float32Array: Float32Array): string {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  let offset = 0;
  for (let i = 0; i < float32Array.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Converts 16-bit linear PCM base64 string from Live API to an AudioBuffer at 24kHz
function base64ToAudioBuffer(base64: string, ctx: AudioContext): AudioBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768.0;
  }
  const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
  audioBuffer.getChannelData(0).set(float32);
  return audioBuffer;
}

export type LiveVoiceState = "disconnected" | "connecting" | "connected" | "speaking" | "listening" | "error";

export function useLiveVoice() {
  const [state, setState] = useState<LiveVoiceState>("disconnected");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);

  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  const stopAudioPlayback = useCallback(() => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch {
        // ignore
      }
    });
    activeSourcesRef.current = [];
    if (outputAudioCtxRef.current) {
      nextStartTimeRef.current = outputAudioCtxRef.current.currentTime;
    }
  }, []);

  const disconnect = useCallback(() => {
    stopAudioPlayback();

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }
    if (outputAudioCtxRef.current) {
      outputAudioCtxRef.current.close().catch(() => {});
      outputAudioCtxRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setState("disconnected");
    setAudioLevel(0);
  }, [stopAudioPlayback]);

  const connect = useCallback(async () => {
    disconnect();
    setState("connecting");
    setErrorMessage(null);

    try {
      // 1. Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      // 2. Setup AudioContexts (16kHz input for Gemini Live, 24kHz output for Gemini voice playback)
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      inputAudioCtxRef.current = inputCtx;
      await inputCtx.resume();

      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      outputAudioCtxRef.current = outputCtx;
      await outputCtx.resume();
      nextStartTimeRef.current = outputCtx.currentTime;

      // 3. Connect WebSocket
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/api/live`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setState("connected");
        toast.success("سيفي متصل صوتياً ومستعد للمحادثة المباشرة!");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.interrupted) {
            stopAudioPlayback();
            setState("listening");
            return;
          }
          if (data.audio && outputAudioCtxRef.current) {
            setState("speaking");
            const buffer = base64ToAudioBuffer(data.audio, outputAudioCtxRef.current);
            const source = outputAudioCtxRef.current.createBufferSource();
            source.buffer = buffer;
            source.connect(outputAudioCtxRef.current.destination);

            const now = outputAudioCtxRef.current.currentTime;
            const startTime = Math.max(now, nextStartTimeRef.current);
            source.start(startTime);
            nextStartTimeRef.current = startTime + buffer.duration;

            activeSourcesRef.current.push(source);
            source.onended = () => {
              activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
              if (activeSourcesRef.current.length === 0) {
                setState("listening");
              }
            };
          }
          if (data.error) {
            setErrorMessage(data.error);
            setState("error");
            toast.error(data.error);
          }
        } catch (err) {
          console.error("Failed to parse Live message:", err);
        }
      };

      ws.onerror = (err) => {
        console.error("Live WebSocket error:", err);
        setErrorMessage("تعذر الاتصال بالخادم الصوتي المباشر");
        setState("error");
      };

      ws.onclose = () => {
        disconnect();
      };

      // 4. Hook microphone stream to send PCM audio chunks
      const source = inputCtx.createMediaStreamSource(stream);
      // bufferSize 4096 gives ~256ms at 16kHz
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (ws.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          // calculate audio level for visualizer
          let sum = 0;
          for (let i = 0; i < inputData.length; i++) {
            sum += inputData[i] * inputData[i];
          }
          const rms = Math.sqrt(sum / inputData.length);
          setAudioLevel(Math.min(1, rms * 5));

          const base64Audio = floatTo16BitPCMBase64(inputData);
          ws.send(JSON.stringify({ audio: base64Audio }));
        }
      };

      source.connect(processor);
      processor.connect(inputCtx.destination);
    } catch (err: any) {
      console.error("Error starting live voice session:", err);
      disconnect();
      setErrorMessage(err.message || "فشل فتح الميكروفون أو بدء الاتصال الصوتي");
      setState("error");
      toast.error(err.message || "يرجى السماح بالوصول للميكروفون لبدء المحادثة الصوتية");
    }
  }, [disconnect, stopAudioPlayback]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    state,
    errorMessage,
    audioLevel,
    connect,
    disconnect,
    isConnected: state === "connected" || state === "speaking" || state === "listening",
    isSpeaking: state === "speaking",
  };
}
