import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { ExtractedDocument } from "@/lib/legalTypes";

const getApiKey = () => localStorage.getItem('gemini_api_key');

const handleGeminiError = (error: any): never => {
    console.error("Gemini API Error Details:", error);

    let message = "حدث خطأ غير متوقع في خدمة الذكاء الاصطناعي.";
    const errorMsg = error.message || error.toString();

    if (errorMsg.includes("404") || errorMsg.includes("NOT_FOUND")) {
        message = "نموذج الذكاء الاصطناعي المطلوب غير متوفر حالياً (404). يرجى المحاولة لاحقاً.";
    } else if (errorMsg.includes("401") || errorMsg.includes("INVALID_ARGUMENT") || errorMsg.includes("API_KEY")) {
        message = "مفتاح API غير صالح أو غير مصرح له بالوصول للخدمة.";
    } else if (errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED")) {
        message = "تم تجاوز حد الاستخدام المسموح (Quota Exceeded). يرجى الانتظار قليلاً ثم المحاولة.";
    } else if (errorMsg.includes("503") || errorMsg.includes("UNAVAILABLE")) {
        message = "الخدمة غير متوفرة حالياً بسبب ضغط الخوادم، يرجى المحاولة لاحقاً.";
    } else if (errorMsg.includes("SAFETY") || errorMsg.includes("BLOCKED")) {
        message = "تم حظر المحتوى بواسطة مرشحات الأمان الخاصة بالنموذج.";
    } else if (errorMsg.includes("network") || errorMsg.includes("fetch")) {
        message = "حدث خطأ في الاتصال بالشبكة.";
    } else if (errorMsg.includes("JSON")) {
        message = "فشل في معالجة البيانات المستخرجة. يرجى المحاولة مرة أخرى.";
    }

    throw new Error(message);
};

const cleanAndParseJson = (text: string): ExtractedDocument => {
    console.log("Raw Gemini Response Length:", text.length);
    console.log("Raw Gemini Response (First 500 chars):", text.substring(0, 500));

    // 1. Remove markdown code blocks
    let cleanText = text.replace(/```json/gi, "").replace(/```/g, "").trim();

    // 2. Extract JSON object only (find first '{' and last '}')
    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleanText = cleanText.substring(firstBrace, lastBrace + 1);
    }

    // 3. Basic cleanup of invisible characters
    cleanText = cleanText.replace(/[\u200B-\u200D\uFEFF]/g, "");

    try {
        const parsed = JSON.parse(cleanText);
        // Ensure cases array exists
        if (!parsed.cases || !Array.isArray(parsed.cases)) {
            console.warn("Gemini returned person but no cases array. Response:", cleanText);
            parsed.cases = [];
        }
        return parsed;
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
                    const fixedParsed = JSON.parse(finalAttempt);
                    if (!fixedParsed.cases || !Array.isArray(fixedParsed.cases)) {
                        fixedParsed.cases = [];
                    }
                    return fixedParsed;
                }
            } catch (retryError) {
                console.error("Repair failed:", retryError);
            }
        }
        throw new Error("فشل قراءة البيانات المستخرجة بتنسيق JSON. النص الخام: " + text.substring(0, 100) + "...");
    }
};

export const analyzeDocumentImage = async (base64Data: string, mimeType: string = "image/jpeg"): Promise<ExtractedDocument> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("مفتاح Gemini API غير موجود. يرجى إعداده في صفحة الذكاء الاصطناعي.");

    const ai = new GoogleGenAI({ apiKey });
    // Using gemini-2.0-flash-exp for best performance and stability
    const modelId = "gemini-2.0-flash-exp";

    try {
        const response = await ai.models.generateContent({
            model: modelId,
            contents: [
                {
                    parts: [
                        {
                            inlineData: {
                                mimeType: mimeType,
                                data: base64Data,
                            },
                        },
                        {
                            text: "You are a professional legal data extractor. Analyze this Kuwait Ministry of Justice document.\n" +
                                "This may be a multi-page PDF. You MUST process ALL pages from start to finish.\n\n" +
                                "1. Extract the person's name and Civil ID from the header (usually on the first page).\n" +
                                "2. Extract EVERY row from the table of cases found throughout the document. The table typically has headers like: م, الرقم الآلي, الجهة, النوع, رقم الدائرة, رقم القضية, الخصم, ت. الجلسة, قرار الجلسة, ت. الجلسة القادمة.\n" +
                                "3. For the 'opponent' field, use the 'الخصم' or 'المدعي عليه' column. Combine multi-line names into a single string. Do NOT include dates or times in the name.\n" +
                                "4. For 'caseNumber', use 'رقم القضية'.\n" +
                                "5. For 'automatedNumber', use 'الرقم الآلي'.\n" +
                                "6. For 'entity', use 'الجهة'.\n" +
                                "7. For 'sessionDate', use 'ت. الجلسة' or 'تاريخ الجلسة'.\n" +
                                "8. For 'sessionDecision', use 'قرار الجلسة'.\n\n" +
                                "CRITICAL: Do not skip any rows. Extract ALL cases found across ALL pages into the 'cases' array. Ensure the output is strictly valid JSON matching the schema."
                        },
                    ],
                },
            ],
            config: {
                responseMimeType: "application/json",
                temperature: 0.1,
                safetySettings: [
                    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                ],
                maxOutputTokens: 8192,
                responseSchema: {
                    type: Type.OBJECT,
                    required: ["person", "cases"],
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
                                    amountDue: { type: Type.STRING },
                                    notes: { type: Type.STRING },
                                },
                                required: ["caseNumber", "opponent"],
                            },
                        },
                    },
                },
            },
        });

        const text = response.text;
        if (!text) {
            throw new Error("No response text from Gemini. The model may have blocked the content.");
        }

        return cleanAndParseJson(text);

    } catch (error) {
        handleGeminiError(error);
        return { person: { name: '', civilId: '', dateOfReport: '', type: '' }, cases: [] }; // Fallback
    }
};
