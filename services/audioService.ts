
export function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodePCMData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  // Fix: Create a clean buffer to ensure proper 16-bit alignment for raw PCM
  const buffer = new ArrayBuffer(data.length);
  new Uint8Array(buffer).set(data);
  const dataInt16 = new Int16Array(buffer);
  
  const frameCount = dataInt16.length / numChannels;
  const audioBuffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Normalize signed 16-bit PCM (-32768 to 32767) to float (-1.0 to 1.0)
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return audioBuffer;
}

export class PAAudioPlayer {
  private ctx: AudioContext | null = null;

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    return this.ctx;
  }

  async resume() {
    const ctx = this.getCtx();
    // Aggressive resume to bypass browser power-saving or autoplay restrictions
    if (ctx.state !== 'running') {
      try {
        await ctx.resume();
      } catch (e) {
        console.warn("PA SYSTEM: Audio hardware failed to activate. User interaction may be required.", e);
      }
    }
    return ctx;
  }

  /**
   * AI Voice Playback (Raw 16-bit PCM from Gemini)
   */
  async playPCM(base64Data: string) {
    const ctx = await this.resume();
    try {
      const bytes = decodeBase64(base64Data);
      const audioBuffer = await decodePCMData(bytes, ctx, 24000, 1);
      
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      
      return new Promise((resolve) => {
        source.onended = resolve;
        source.start();
      });
    } catch (error) {
      console.error("PA SYSTEM: AI Voice Playback Error", error);
    }
  }

  /**
   * Live Voice Playback (Recorded Blobs)
   */
  async playVoice(base64Data: string) {
    const ctx = await this.resume();
    try {
      const bytes = decodeBase64(base64Data);
      const audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      return new Promise((resolve) => {
        source.onended = resolve;
        source.start();
      });
    } catch (error) {
      console.error("PA SYSTEM: Voice stream decoding failed, trying HTML fallback", error);
      return this.playURL(`data:audio/webm;base64,${base64Data}`);
    }
  }

  /**
   * Ritual/Song Playback (MP3/WAV URLs)
   */
  async playURL(url: string) {
    await this.resume();
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.crossOrigin = "anonymous";
      audio.src = url;
      
      const cleanUp = () => {
        audio.removeEventListener('ended', onEnded);
        audio.removeEventListener('error', onError);
      };

      const onEnded = () => {
        cleanUp();
        resolve(true);
      };
      
      const onError = (e: any) => {
        cleanUp();
        console.error("PA SYSTEM: Ritual audio stream error", e);
        reject(e);
      };

      audio.addEventListener('ended', onEnded);
      audio.addEventListener('error', onError);
      
      audio.play().catch((err) => {
        console.error("PA SYSTEM: Audio playback blocked by browser security policy", err);
        reject(err);
      });
    });
  }
}

export const paPlayer = new PAAudioPlayer();

export class VoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];

  async start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) this.audioChunks.push(event.data);
      };
      this.mediaRecorder.start();
    } catch (e) {
      console.error("PA SYSTEM: Microphone access denied", e);
      throw e;
    }
  }

  async stop(): Promise<string> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') return resolve('');
      
      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64data = (reader.result as string).split(',')[1];
          resolve(base64data);
        };
      };
      this.mediaRecorder.stop();
    });
  }
}

export const voiceRecorder = new VoiceRecorder();
