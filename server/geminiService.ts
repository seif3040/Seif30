import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { WebSocketServer, WebSocket } from "ws";
import type { Server as HttpServer } from "http";
import type { Express, Request, Response } from "express";

let genAIClient: GoogleGenAI | null = null;

export function getGenAI(): GoogleGenAI {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not configured.");
    }
    genAIClient = new GoogleGenAI({ apiKey });
  }
  return genAIClient;
}

export function registerGeminiRoutes(app: Express, server: HttpServer) {
  // 1. Multi-turn Gemini Chat with Model Selection and System Roles
  app.post("/api/gemini/chat", async (req: Request, res: Response) => {
    try {
      const { messages, model, role, systemInstruction: customInstruction, useSearch } = req.body;
      
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "Missing or empty messages array" });
      }

      const selectedModel =
        model === "gemini-3.1-flash-lite"
          ? "gemini-3.1-flash-lite"
          : "gemini-3.8-flash";

      let systemInstruction = customInstruction || "أنت سيفي (Seif Study OS AI Tutor)، المساعد الذكي لمذاكرة الثانوية والجامعة. قدّم إجابات تفاعلية وواضحة ومنظمة باللغة العربية، وحفّز الطالب دائماً.";

      if (role === "study_mentor") {
        systemInstruction = "أنت موجه ومرشد مذاكرة خبير (Study Mentor) في Seif Study OS. تنظم خطط المذاكرة وتلخص الدروس وتساعد الطالب على التركيز وبناء عادات إيجابية.";
      } else if (role === "exam_tutor") {
        systemInstruction = "أنت خبير امتحانات متمرس (Exam Tutor) في Seif Study OS. تدرب الطالب على حل أسئلة الامتحانات الصعبة والأسئلة غير المباشرة وتوضح طريقة التفكير النموذجية.";
      } else if (role === "concept_explainer") {
        systemInstruction = "أنت معلم متميز في تبسيط المفاهيم (Concept Explainer) في Seif Study OS. تشرح القوانين والمعادلات والأحداث التاريخية والمفاهيم العلمية بطرق وأمثلة حياتية سلسة.";
      }

      const ai = getGenAI();

      const formattedContents = messages.map((m: any) => ({
        role: m.role === "assistant" || m.role === "model" ? "model" : "user",
        parts: [{ text: String(m.content || m.text || "") }],
      }));

      const config: any = {
        systemInstruction,
      };

      if (useSearch) {
        config.tools = [{ googleSearch: {} }];
      }

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: formattedContents,
        config,
      });

      const sources: { title: string; uri: string }[] = [];
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks && Array.isArray(chunks)) {
        for (const chunk of chunks) {
          if (chunk.web?.uri) {
            sources.push({
              title: chunk.web.title || chunk.web.uri,
              uri: chunk.web.uri,
            });
          }
        }
      }

      return res.json({
        text: response.text ?? "",
        model: selectedModel,
        sources,
      });
    } catch (err: any) {
      console.error("Gemini chat error:", err);
      return res.status(500).json({ error: err.message || "فشل الاتصال بـ Gemini" });
    }
  });

  // 2. Google Search Grounding with gemini-3.5-flash
  app.post("/api/gemini/search", async (req: Request, res: Response) => {
    try {
      const { query } = req.body;
      if (!query || typeof query !== "string") {
        return res.status(400).json({ error: "Missing query string" });
      }

      const ai = getGenAI();
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: query,
        config: {
          tools: [{ googleSearch: {} }],
          systemInstruction: "أنت باحث دراسي موثوق في Seif Study OS. استخرج إجابات دقيقة ومحدثة مع توثيق المصادر والروابط.",
        },
      });

      const sources: { title: string; uri: string }[] = [];
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks && Array.isArray(chunks)) {
        for (const chunk of chunks) {
          if (chunk.web?.uri) {
            sources.push({
              title: chunk.web.title || chunk.web.uri,
              uri: chunk.web.uri,
            });
          }
        }
      }

      return res.json({
        text: response.text ?? "",
        model: "gemini-3.8-flash",
        sources,
      });
    } catch (err: any) {
      console.error("Gemini search error:", err);
      return res.status(500).json({ error: err.message || "فشل البحث بواسطة Google Search Grounding" });
    }
  });

  // 3. Audio Transcription with gemini-3.5-transcribe
  app.post("/api/gemini/transcribe", async (req: Request, res: Response) => {
    try {
      const { audioBase64, mimeType } = req.body;
      if (!audioBase64) {
        return res.status(400).json({ error: "Missing audioBase64 payload" });
      }

      const ai = getGenAI();
      const audioPart = {
        inlineData: {
          mimeType: mimeType || "audio/webm",
          data: audioBase64,
        },
      };

      const response = await ai.models.generateContent({
        model: "gemini-3.5-transcribe",
        contents: {
          parts: [
            audioPart,
            {
              text: "قم بتفريغ هذا التسجيل الصوتي بدقة تامة باللغة المنطوقة (عربية أو إنجليزية). احتفظ بالمصطلحات العلمية والتعليمية والترقيم الواضح بدون حذف.",
            },
          ],
        },
      });

      return res.json({
        text: response.text ?? "",
      });
    } catch (err: any) {
      console.error("Gemini transcribe error:", err);
      return res.status(500).json({ error: err.message || "فشل التفريغ الصوتي عبر gemini-3.5-transcribe" });
    }
  });

  // 4. Live API Voice Conversations (WebSocket bridge to gemini-3.1-flash-live-preview)
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url || "", `http://${request.headers.host}`);
    if (url.pathname === "/api/live" || url.pathname === "/live") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });

  wss.on("connection", async (clientWs: WebSocket) => {
    console.log("[Live API] Client connected to live voice socket");
    let session: any = null;

    try {
      const ai = getGenAI();
      session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: "أنت سيفي (Seif Study OS Live Voice Assistant). مساعد ذكي صوتي مباشر للمذاكرة، تتحدث باللغة العربية بأسلوب ودود ومحفز وموجز، وتساعد الطالب في فهم الدروس والتركيز ومتابعة أهدافه.",
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            try {
              const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
              if (audio && clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({ audio }));
              }
              if (message.serverContent?.interrupted && clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({ interrupted: true }));
              }
            } catch (err) {
              console.error("[Live API] Error forwarding model audio:", err);
            }
          },
          onclose: () => {
            console.log("[Live API] Session closed by Gemini");
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ status: "closed" }));
            }
          },
        },
      });

      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ status: "connected", message: "Live voice session active" }));
      }

      clientWs.on("message", (data) => {
        try {
          const payload = JSON.parse(data.toString());
          if (payload.audio && session) {
            session.sendRealtimeInput({
              audio: { data: payload.audio, mimeType: "audio/pcm;rate=16000" },
            });
          } else if (payload.text && session) {
            session.sendRealtimeInput({
              text: payload.text,
            });
          }
        } catch (err) {
          console.error("[Live API] Error processing client audio frame:", err);
        }
      });

      clientWs.on("close", () => {
        console.log("[Live API] Client disconnected");
        if (session) {
          try {
            session.close();
          } catch {
            // ignore
          }
        }
      });

      clientWs.on("error", (err) => {
        console.error("[Live API] Client WebSocket error:", err);
      });
    } catch (err: any) {
      console.error("[Live API] Failed to initialize Live session:", err);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ error: err.message || "Failed to connect to Live API" }));
        clientWs.close();
      }
    }
  });
}
