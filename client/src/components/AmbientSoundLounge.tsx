import { useState, useEffect, useRef } from "react";
import { Volume2, VolumeX, Play, Pause, CloudRain, Waves, Coffee, Headphones, Radio, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

type SoundType = "rain" | "waves" | "cafe" | "lofi" | "whitenoise";

interface SoundTrack {
  id: SoundType;
  name: string;
  icon: any;
  description: string;
}

const SOUNDS: SoundTrack[] = [
  { id: "rain", name: "صوت المطر والغيوم 🌧️", icon: CloudRain, description: "تساقط قطرات المطر الهادئة لعزل التشتيت" },
  { id: "waves", name: "أمواج البحر والشاطئ 🌊", icon: Waves, description: "إيقاع حركات الموج للهدوء والسكينة" },
  { id: "cafe", name: "دفء القهوة والمكتبة ☕", icon: Coffee, description: "أجواء الدراسة الجماعية والتركيز" },
  { id: "lofi", name: "نغمات Lo-Fi الاسترخائية 🎧", icon: Headphones, description: "ألحان سينث هادئة تساعد على التفكير العميق" },
  { id: "whitenoise", name: "الضوضاء البيضاء للتركيز 📻", icon: Radio, description: "تردد منتظم لعزل الضوضاء المحيطة تماماً" },
];

export function AmbientSoundLounge() {
  const [playingState, setPlayingState] = useState<Record<SoundType, boolean>>({
    rain: false,
    waves: false,
    cafe: false,
    lofi: false,
    whitenoise: false,
  });

  const [volumes, setVolumes] = useState<Record<SoundType, number>>({
    rain: 50,
    waves: 50,
    cafe: 40,
    lofi: 40,
    whitenoise: 30,
  });

  const audioCtxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<Record<string, { gain: GainNode; stop: () => void }>>({});

  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioCtx();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  const startSound = (type: SoundType) => {
    const ctx = getAudioContext();
    const gainNode = ctx.createGain();
    gainNode.gain.value = (volumes[type] / 100) * 0.3;
    gainNode.connect(ctx.destination);

    let stopFunc = () => {};

    if (type === "rain") {
      // Pink noise + lowpass filter for rain
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        data[i] *= 0.11;
        b6 = white * 0.115926;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 1200;

      noise.connect(filter);
      filter.connect(gainNode);
      noise.start();

      stopFunc = () => {
        try { noise.stop(); } catch {}
      };
    } else if (type === "waves") {
      // Low noise with LFO modulation
      const bufferSize = ctx.sampleRate * 3;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 400;

      // LFO for wave swelling
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.12; // wave speed
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 300;

      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      noise.connect(filter);
      filter.connect(gainNode);

      noise.start();
      lfo.start();

      stopFunc = () => {
        try { noise.stop(); lfo.stop(); } catch {}
      };
    } else if (type === "lofi") {
      // Gentle chord generator pad
      const chords = [
        [261.63, 329.63, 392.0, 493.88], // Cmaj7
        [220.0, 261.63, 329.63, 392.0],  // Am7
        [174.61, 220.0, 261.63, 329.63], // Fmaj7
        [196.0, 246.94, 293.66, 349.23], // G7
      ];

      let chordIdx = 0;
      let intervalId: any;

      const playCurrentChord = () => {
        const freqs = chords[chordIdx];
        chordIdx = (chordIdx + 1) % chords.length;

        freqs.forEach((freq) => {
          const osc = ctx.createOscillator();
          const oscGain = ctx.createGain();

          osc.type = "sine";
          osc.frequency.value = freq;

          oscGain.gain.setValueAtTime(0, ctx.currentTime);
          oscGain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 1.5);
          oscGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 5.5);

          osc.connect(oscGain);
          oscGain.connect(gainNode);

          osc.start();
          osc.stop(ctx.currentTime + 6);
        });
      };

      playCurrentChord();
      intervalId = setInterval(playCurrentChord, 6000);

      stopFunc = () => {
        clearInterval(intervalId);
      };
    } else if (type === "cafe" || type === "whitenoise") {
      // Warm noise with ambient bandpass
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = type === "cafe" ? "bandpass" : "lowpass";
      filter.frequency.value = type === "cafe" ? 800 : 2500;

      noise.connect(filter);
      filter.connect(gainNode);
      noise.start();

      stopFunc = () => {
        try { noise.stop(); } catch {}
      };
    }

    nodesRef.current[type] = { gain: gainNode, stop: stopFunc };
  };

  const stopSound = (type: SoundType) => {
    if (nodesRef.current[type]) {
      nodesRef.current[type].stop();
      delete nodesRef.current[type];
    }
  };

  const toggleSound = (type: SoundType) => {
    const isPlaying = !playingState[type];
    setPlayingState((prev) => ({ ...prev, [type]: isPlaying }));

    if (isPlaying) {
      startSound(type);
    } else {
      stopSound(type);
    }
  };

  const handleVolumeChange = (type: SoundType, val: number) => {
    setVolumes((prev) => ({ ...prev, [type]: val }));
    if (nodesRef.current[type]) {
      nodesRef.current[type].gain.gain.setValueAtTime((val / 100) * 0.3, getAudioContext().currentTime);
    }
  };

  useEffect(() => {
    return () => {
      Object.keys(nodesRef.current).forEach((key) => {
        nodesRef.current[key]?.stop();
      });
    };
  }, []);

  return (
    <div className="surface p-6 rounded-3xl border border-primary/20 space-y-5">
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
            <Headphones className="size-6" />
          </div>
          <div>
            <h2 className="font-bold text-lg flex items-center gap-2">
              صالة الأصوات الهادئة للتركيز (Ambiance Lounge)
            </h2>
            <p className="text-xs text-muted-foreground">تشغيل خلفيات صوتية عازلة للدوشة لمساعدتك على المذاكرة بتركيز عميق.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <Sparkles className="size-3.5" /> توليد مباشر بدون إنترنت
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {SOUNDS.map((sound) => {
          const Icon = sound.icon;
          const isPlaying = playingState[sound.id];
          const volume = volumes[sound.id];

          return (
            <div
              key={sound.id}
              className={`p-4 rounded-2xl border transition-all ${
                isPlaying
                  ? "border-primary bg-primary/10 shadow-sm"
                  : "border-border/80 bg-card hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex size-9 items-center justify-center rounded-xl ${
                      isPlaying ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="size-5" />
                  </div>
                  <span className="font-bold text-sm">{sound.name}</span>
                </div>

                <Button
                  size="icon"
                  variant={isPlaying ? "default" : "outline"}
                  onClick={() => toggleSound(sound.id)}
                  className="size-9 rounded-xl shadow-xs"
                >
                  {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground mb-3 leading-5">{sound.description}</p>

              <div className="flex items-center gap-2 pt-1">
                {volume === 0 ? (
                  <VolumeX className="size-4 text-muted-foreground" />
                ) : (
                  <Volume2 className="size-4 text-primary" />
                )}
                <Slider
                  value={[volume]}
                  max={100}
                  step={1}
                  onValueChange={([val]) => handleVolumeChange(sound.id, val)}
                  className="flex-1"
                />
                <span className="text-[10px] font-bold text-muted-foreground w-6 text-left">{volume}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
