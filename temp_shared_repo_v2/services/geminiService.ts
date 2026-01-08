import { GoogleGenAI, Type, Modality, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { ExtractedDocument, CaseData, PersonInfo } from "../types";

let aiInstance: GoogleGenAI | null = null;

const getAiClient = (): GoogleGenAI => {
  if (!aiInstance) {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API Key is missing.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
};

const handleGeminiError = (error: any): never => {
  console.error("Gemini API Error:", error);
  let message = "حدث خطأ في خدمة الذكاء الاصطناعي.";
  const errorMsg = error.message || error.toString();
  if (errorMsg.includes("429")) message = "تم تجاوز حد الاستخدام المسموح.";
  if (errorMsg.includes("401")) message = "مفتاح API غير صالح.";
  if (errorMsg.includes("JSON")) message = "فشل في معالجة البيانات المستخرجة.";
  throw new Error(message);
};

const cleanAndParseJson = (text: string): ExtractedDocument => {
  let cleanText = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  
  // Basic cleanup of invisible characters
  cleanText = cleanText.replace(/[\u200B-\u200D\uFEFF]/g, "");

  try {
    return JSON.parse(cleanText);
  } catch (e: any) {
    console.warn("Initial JSON parse failed, attempting repair...");
    
    // Heuristic: truncate if sessionDecision caused a loop/truncation issue
    const lastValidIndex = cleanText.lastIndexOf("}");
    if (lastValidIndex !== -1) {
      try {
        const repaired = cleanText.substring(0, lastValidIndex + 1);
        // If it was an array element that got cut off, close the array and object
        if (repaired.endsWith("}")) {
            const finalAttempt = repaired.includes('"cases": [') && !repaired.endsWith("]}") ? repaired + "]}" : repaired;
            return JSON.parse(finalAttempt);
        }
      } catch (retryError) {
        console.error("Repair failed:", retryError);
      }
    }
    throw new Error("فشل قراءة البيانات المستخرجة بتنسيق JSON.");
  }
};

export const analyzeDocumentImage = async (base64Image: string): Promise<ExtractedDocument> => {
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Image } },
          { text: "Extract legal case data from this Kuwait Ministry of Justice document. Provide person details and a table of cases in raw JSON." }
        ],
      },
      config: {
        responseMimeType: "application/json",
        temperature: 0.1,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            person: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                civilId: { type: Type.STRING },
                dateOfReport: { type: Type.STRING },
                type: { type: Type.STRING },
              },
              required: ["name", "civilId"],
            },
            cases: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sequenceNumber: { type: Type.STRING },
                  automatedNumber: { type: Type.STRING },
                  entity: { type: Type.STRING },
                  caseType: { type: Type.STRING },
                  circleNumber: { type: Type.STRING },
                  caseNumber: { type: Type.STRING },
                  opponent: { type: Type.STRING },
                  sessionDate: { type: Type.STRING },
                  sessionDecision: { type: Type.STRING },
                  nextSessionDate: { type: Type.STRING },
                },
              },
            },
          },
        },
      },
    });
    return cleanAndParseJson(response.text || "{}");
  } catch (error) {
    handleGeminiError(error);
  }
};

export const getQuickSummary = async (data: ExtractedDocument): Promise<string> => {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Provide a short 1-sentence Arabic summary for: ${JSON.stringify(data.cases.slice(0, 5))}`,
    });
    return response.text || "";
  } catch (error) {
    return "لا يتوفر ملخص سريع.";
  }
};

export const chatWithLegalAssistant = async (message: string, context: ExtractedDocument, history: any[], useThinking: boolean = false): Promise<string> => {
  try {
    const ai = getAiClient();
    const chat = ai.chats.create({
      model: "gemini-3-pro-preview",
      config: {
        systemInstruction: `You are a legal assistant. Use this data: ${JSON.stringify(context)}. Reply in Arabic.`,
        thinkingConfig: useThinking ? { thinkingBudget: 4096 } : undefined,
      },
      history: history,
    });
    const result = await chat.sendMessage({ message });
    return result.text || "";
  } catch (error) {
    handleGeminiError(error);
  }
};

export const generateAudioSummary = async (text: string): Promise<string> => {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: { parts: [{ text }] },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
        },
      },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("Audio missing");
    return base64Audio;
  } catch (error) {
    handleGeminiError(error);
  }
};