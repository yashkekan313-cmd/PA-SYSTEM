
import { GoogleGenAI, Modality } from "@google/genai";

export const generateTTS = async (text: string, voice: string = 'Kore'): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    // Robustly find the inline audio data part
    let base64Audio = '';
    const parts = response.candidates?.[0]?.content?.parts || [];
    
    for (const part of parts) {
      if (part.inlineData?.data) {
        base64Audio = part.inlineData.data;
        break;
      }
    }

    if (!base64Audio) {
      throw new Error("No valid PCM audio data in Gemini response");
    }
    return base64Audio;
  } catch (error) {
    console.error("Gemini TTS Service Failure:", error);
    throw error;
  }
};
