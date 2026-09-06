import { GoogleGenAI } from "@google/genai";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: string;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type JsonSchema = {
  name?: string;
  description?: string;
  strict?: boolean;
  schema: Record<string, unknown>;
};

export type OutputSchema = {
  name: string;
  description?: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  model?: string;
  thinking?: Record<string, unknown>;
  reasoning?: Record<string, unknown>;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

function extractText(content: MessageContent | MessageContent[]): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map(item => extractText(item)).join("\n");
  }
  if (content && typeof content === "object" && "text" in content) {
    return content.text;
  }
  return "";
}

function sanitizeSchema(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeSchema);
  const copy: any = { ...obj };
  if (Array.isArray(copy.enum)) {
    copy.enum = copy.enum.filter((item: any) => typeof item !== "string" || item.trim().length > 0);
    if (copy.enum.length === 0) {
      delete copy.enum;
    }
  }
  for (const key of Object.keys(copy)) {
    if (typeof copy[key] === "object" && copy[key] !== null) {
      copy[key] = sanitizeSchema(copy[key]);
    }
  }
  return copy;
}

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } }
      });
      const systemInstruction = params.messages
        .filter(m => m.role === "system")
        .map(m => extractText(m.content))
        .join("\n\n");

      const userMessages = params.messages
        .filter(m => m.role !== "system")
        .map(m => `${m.role === "assistant" ? "المساعد" : "المستخدم"}: ${extractText(m.content)}`)
        .join("\n\n");

      const prompt = userMessages || "مرحباً";

      const config: any = {};
      if (systemInstruction) {
        config.systemInstruction = systemInstruction;
      }

      const rawSchema = params.outputSchema?.schema || params.output_schema?.schema ||
        (params.responseFormat?.type === "json_schema" ? params.responseFormat.json_schema?.schema : undefined) ||
        (params.response_format?.type === "json_schema" ? params.response_format.json_schema?.schema : undefined);

      if (rawSchema) {
        const schema = sanitizeSchema(rawSchema);
        config.responseMimeType = "application/json";
        config.responseSchema = schema;
      }

      const candidateModels = [
        params.model || "gemini-3.1-flash-lite",
        "gemini-3.1-flash-lite",
        "gemini-3.8-flash",
        "gemini-flash-latest"
      ];
      // Deduplicate while preserving order
      const uniqueModels = Array.from(new Set(candidateModels));

      let responseText = "";
      let usedModel = "gemini-3.1-flash-lite";

      for (const modelToTry of uniqueModels) {
        try {
          const response = await ai.models.generateContent({
            model: modelToTry,
            contents: prompt,
            config: Object.keys(config).length > 0 ? config : undefined,
          });
          if (response.text) {
            responseText = response.text;
            usedModel = modelToTry;
            break;
          }
        } catch (modelErr: any) {
          console.warn(`[LLM] Model ${modelToTry} attempt failed (${modelErr?.status || modelErr?.message}), trying next candidate...`);
        }
      }

      if (!responseText) {
        throw new Error("All candidate Gemini models failed to generate response.");
      }

      return {
        id: `gemini-${Date.now()}`,
        created: Math.floor(Date.now() / 1000),
        model: usedModel,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: responseText,
            },
            finish_reason: "stop",
          },
        ],
      };
    } catch (err) {
      console.warn("[LLM] Gemini API call error, using fallback:", err);
    }
  }

  // Fallback if no API key or API call fails
  const lastMessage = params.messages[params.messages.length - 1];
  const lastText = lastMessage ? extractText(lastMessage.content) : "";

  let fallbackContent = "أنا معك يا سيف! تم تسجيل طلبك، وسأساعدك في تنظيم وقتك ومذاكرتك بكل كفاءة.";

  if (params.outputSchema || params.responseFormat?.type === "json_schema") {
    // If structured quiz requested
    if (lastText.includes("امتحان") || lastText.includes("اختبار") || lastText.includes("quiz")) {
      fallbackContent = JSON.stringify({
        questions: Array.from({ length: 8 }).map((_, i) => ({
          question: `سؤال مراجعة رقم ${i + 1}: ما هي الفكرة الأساسية في هذا الموضوع؟`,
          answer: "الإجابة النموذجية تعتمد على استيعاب النقاط والمفاهيم الرئيسية في الدرس.",
          choices: [
            "الخيار الأول: التركيز على المفاهيم",
            "الخيار الثاني: حل التدريبات العملية",
            "الخيار الثالث: المراجعة الدورية",
            "الخيار الرابع: جميع ما سبق"
          ]
        }))
      });
    } else {
      fallbackContent = JSON.stringify({
        reply: "تم تجهيز خطة المذاكرة بنجاح!",
        actionType: "create_task",
        title: "مراجعة درس جديد",
        targetTitle: "مذاكرة مركزة",
        priority: "urgent",
        scheduledFor: new Date().toISOString().slice(0, 10),
        frequency: "daily",
        target: 1,
        route: "/tasks",
        requiresConfirmation: false
      });
    }
  }

  return {
    id: `fallback-${Date.now()}`,
    created: Math.floor(Date.now() / 1000),
    model: "study-os-local",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: fallbackContent,
        },
        finish_reason: "stop",
      },
    ],
  };
}

export async function listLLMModels(): Promise<{ object: string; data: Array<{ id: string; object: string; created: number; owned_by: string }> }> {
  return {
    object: "list",
    data: [
      { id: "gemini-3.8-flash", object: "model", created: Date.now(), owned_by: "google" },
      { id: "study-os-local", object: "model", created: Date.now(), owned_by: "local" },
    ],
  };
}
