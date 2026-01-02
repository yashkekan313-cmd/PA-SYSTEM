
import { GoogleGenAI, Modality } from "@google/genai";

export const generateTTS = async (text: string, voice: string = 'Kore'): Promise<string> => {
  // Always initialize with the latest key from the environment directly
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

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("No audio data received from Gemini API");
    }
    return base64Audio;
  } catch (error) {
    console.error("Gemini TTS Error:", error);
    // Return an empty string or handle gracefully to prevent app crash
    throw error;
  }
};
