
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
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
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
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (e) {
        console.warn("PA SYSTEM: AudioContext resume failed", e);
      }
    }
    return ctx;
  }

  /**
   * For Gemini TTS (Raw 16-bit PCM)
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
      console.error("PA SYSTEM: PCM Playback Error", error);
    }
  }

  /**
   * For Recorded Voice (WebM/AAC containers)
   */
  async playVoice(base64Data: string) {
    const ctx = await this.resume();
    try {
      const bytes = decodeBase64(base64Data);
      // Native decoder handles browser-recorded blobs (WebM/Ogg/AAC)
      const audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      return new Promise((resolve) => {
        source.onended = resolve;
        source.start();
      });
    } catch (error) {
      console.error("PA SYSTEM: Voice Decoding failed, trying HTMLAudio fallback", error);
      return this.playURL(`data:audio/webm;base64,${base64Data}`);
    }
  }

  async playURL(url: string) {
    // We don't necessarily need the AudioContext for HTMLAudioElement, 
    // but resuming it helps keep the system awake.
    await this.resume();
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.crossOrigin = "anonymous";
      audio.src = url;
      audio.onended = () => resolve(true);
      audio.onerror = (e) => {
        console.error("PA SYSTEM: Ritual/URL Playback Error", e);
        reject(e);
      };
      audio.play().catch((err) => {
        console.error("PA SYSTEM: Audio.play() blocked by browser", err);
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
