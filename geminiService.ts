
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { SYSTEM_INSTRUCTION, MEMORY_STORAGE_KEY } from "../constants.tsx";

const getApiKey = () => {
  if (typeof process !== 'undefined' && process.env.API_KEY) {
    return process.env.API_KEY;
  }
  // @ts-ignore
  return window.API_KEY || "";
};

export const getAIInstance = () => {
  return new GoogleGenAI({ apiKey: getApiKey() });
};

// Memory Persistence Logic
export const getMemories = (): string[] => {
  const stored = localStorage.getItem(MEMORY_STORAGE_KEY);
  try {
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const saveMemory = (fact: string) => {
  const memories = getMemories();
  if (!memories.includes(fact)) {
    memories.push(fact);
    localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(memories.slice(-30)));
  }
};

export const clearMemories = () => {
  localStorage.removeItem(MEMORY_STORAGE_KEY);
};

export const extractMemories = async (conversation: any[]) => {
  const ai = getAIInstance();
  const recentHistory = conversation.slice(-4).map(m => `${m.role}: ${m.content}`).join("\n");
  
  if (!recentHistory.trim()) return;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Extract short personal facts about Indrajeet from this conversation. 
      Output ONLY a JSON array of strings, e.g. ["Indrajeet likes mangoes", "Indrajeet is an engineer"]. 
      If no new facts, return [].
      
      Conversation:
      ${recentHistory}`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    let jsonStr = (response.text || "[]").trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    }
    
    const newFacts = JSON.parse(jsonStr);
    if (Array.isArray(newFacts)) {
      newFacts.forEach((fact: string) => saveMemory(fact));
    }
  } catch (err) {
    console.warn("Memory extraction skip", err);
  }
};

const isPlatformError = (err: any) => {
  const errStr = (JSON.stringify(err) || "").toLowerCase();
  const msg = (err?.message || "").toLowerCase();
  return (
    errStr.includes("403") || 
    errStr.includes("permission_denied") ||
    errStr.includes("forbidden") ||
    msg.includes("permission") ||
    msg.includes("403") ||
    msg.includes("api key")
  );
};

export interface AudioPart {
  inlineData: {
    data: string;
    mimeType: string;
  };
}

export const generateText = async (prompt: string, history: any[] = [], audioPart?: AudioPart) => {
  const ai = getAIInstance();
  const memories = getMemories();
  const memoryContext = memories.length > 0 ? `\n\n[USER MEMORIES]\n${memories.map(m => `- ${m}`).join("\n")}` : "";

  const recentHistory = history.filter(msg => msg.id !== '1').slice(-8); 
  const contents = recentHistory.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));

  const currentParts: any[] = [];
  if (prompt) currentParts.push({ text: prompt });
  if (audioPart) currentParts.push(audioPart);
  if (currentParts.length === 0) currentParts.push({ text: "Voice input received. 💖" });
  contents.push({ role: 'user', parts: currentParts });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION + memoryContext,
        temperature: 0.8,
      }
    });
    
    extractMemories([...history, { role: 'user', content: prompt }, { role: 'model', content: response.text }]);

    return {
      text: response.text || "Myra thoda confuse ho gayi... 💖",
      sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (error: any) {
    console.error("Gemini Text Error:", error);
    if (isPlatformError(error)) {
        throw new Error("Indrajeet, check API key project permissions (403). 🌐");
    }
    throw new Error("Myra is having trouble connecting to the brain. Please check your network! 📶");
  }
};

export const analyzeImage = async (base64Image: string, prompt: string) => {
  const ai = getAIInstance();
  const memories = getMemories();
  const memoryContext = memories.length > 0 ? `\n\n[USER MEMORIES]\n${memories.map(m => `- ${m}`).join("\n")}` : "";
  const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: cleanBase64, mimeType: 'image/jpeg' } },
          { text: prompt }
        ]
      },
      config: { 
        systemInstruction: SYSTEM_INSTRUCTION + memoryContext
      }
    });

    return {
      text: response.text || "I can't see properly right now 💖",
      sources: []
    };
  } catch (err: any) {
    console.error("Vision Error:", err);
    throw new Error("Vision connection failed. Retry karein? 💖");
  }
};

export const chatWithImage = async (base64Image: string, question: string, history: any[] = []) => {
  const ai = getAIInstance();
  const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

  const contents: any[] = history.map(h => ({
    role: h.role === 'user' ? 'user' : 'model',
    parts: [{ text: h.content }]
  }));
  contents.push({
    role: 'user',
    parts: [
      { inlineData: { data: cleanBase64, mimeType: 'image/jpeg' } },
      { text: question }
    ]
  });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents
    });
    return { text: response.text, sources: [] };
  } catch (err: any) {
    throw new Error("Failed to chat about this image. 🌐");
  }
};

export const generateSpeech = async (text: string) => {
  const ai = getAIInstance();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
  } catch {
    return "";
  }
};

export const generateImage = async (prompt: string) => {
  const ai = getAIInstance();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { aspectRatio: "1:1" } }
    });
    const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    return part ? `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` : "";
  } catch {
    return "";
  }
};

export function encodePCM(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function decodePCM(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

export async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}
