
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { Announcement, ReceiverConfig } from '../types';
import { GRADES_LIST, SCHOOL_HIERARCHY } from '../constants';
import { generateTTS } from '../services/geminiService';
import { paPlayer } from '../services/audioService';

const RITUAL_SONGS: Record<string, string> = {
  'anthem': 'https://reyfxiecqhyqxmszxvnn.supabase.co/storage/v1/object/public/Announcements/Jana%20Gana%20Mana%20(HD)%20-%20National%20Anthem%20With%20Lyrics%20-%20Best%20Patriotic%20Song.mp3', 
  'vande': 'https://reyfxiecqhyqxmszxvnn.supabase.co/storage/v1/object/public/Announcements/Vande%20Mataram%20(HD)%20-%20National%20Song%20Of%20india%20-%20Best%20Patriotic%20Song.mp3'
};

interface ReceiverInterfaceProps {
  onExit: () => void;
  isGlobalMode?: boolean;
}

const ReceiverInterface: React.FC<ReceiverInterfaceProps> = ({ onExit, isGlobalMode = false }) => {
  const [isConfigured, setIsConfigured] = useState(isGlobalMode);
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  const [config, setConfig] = useState<ReceiverConfig>(() => {
    const saved = localStorage.getItem('paSystem_receiverConfig');
    try {
      if (saved) {
        const parsed = JSON.parse(saved);
        if (isGlobalMode && parsed.grade !== 'WHOLE SCHOOL') {
          return { grade: 'WHOLE SCHOOL', division: 'ALL' };
        }
        return parsed;
      }
    } catch {}
    return { grade: isGlobalMode ? 'WHOLE SCHOOL' : '', division: isGlobalMode ? 'ALL' : '' };
  });
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAction, setCurrentAction] = useState<string>('');
  const [status, setStatus] = useState<'OFFLINE' | 'ONLINE' | 'CONNECTING'>('OFFLINE');
  const [lastAnnouncement, setLastAnnouncement] = useState<Announcement | null>(null);
  const playQueue = useRef<Announcement[]>([]);
  const isProcessingQueue = useRef(false);

  useEffect(() => {
    if (isGlobalMode) {
      setConfig({ grade: 'WHOLE SCHOOL', division: 'ALL' });
      setIsConfigured(true);
    }
  }, [isGlobalMode]);

  useEffect(() => {
    if (!isConfigured || !isAudioUnlocked) return;

    setStatus('CONNECTING');

    const channel = supabase.channel('pa_system_main')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, (payload) => {
        const announce = payload.new as Announcement;
        let forMe = false;

        if (announce.target_mode === 'WHOLE_SCHOOL') {
          forMe = true;
        } else if (!isGlobalMode && announce.target_mode === 'SELECTED_GRADE') {
          const divs = Array.isArray(announce.divisions) ? announce.divisions.map(String) : [];
          if (String(announce.grade) === String(config.grade) && (divs.length === 0 || divs.includes(String(config.division)))) {
            forMe = true;
          }
        }

        if (forMe) {
          playQueue.current.push(announce);
          if (!isProcessingQueue.current) {
            processQueue();
          }
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setStatus('ONLINE');
        else setStatus('OFFLINE');
      });

    return () => { supabase.removeChannel(channel); };
  }, [isConfigured, isAudioUnlocked, config, isGlobalMode]);

  const processQueue = async () => {
    if (playQueue.current.length === 0) {
      setIsPlaying(false);
      setCurrentAction('');
      isProcessingQueue.current = false;
      return;
    }

    isProcessingQueue.current = true;
    setIsPlaying(true);
    const announce = playQueue.current.shift()!;
    setLastAnnouncement(announce);

    try {
      // Re-resume context before every transmission to stay "awake"
      await paPlayer.resume();

      if (announce.type === 'text') {
        setCurrentAction('AI Voice Dispatch...');
        const audio = await generateTTS(announce.content);
        if (audio) {
          await paPlayer.playPCM(audio);
        }
      } else if (announce.type === 'audio') {
        setCurrentAction('Live Voice Transmission...');
        await paPlayer.playVoice(announce.content);
      } else if (announce.type === 'anthem' || announce.type === 'vande') {
        const isAnthem = announce.type === 'anthem';
        
        // 1. Play ritual intro
        try {
          setCurrentAction('Preparing Ritual...');
          const introTxt = isAnthem ? "School, attention. Please stand for the National Anthem." : "School, attention. Playing Vande Mataram.";
          const introAudio = await generateTTS(introTxt);
          if (introAudio) await paPlayer.playPCM(introAudio);
        } catch (e) { 
          console.warn("PA SYSTEM: Intro ritual failed", e); 
        }

        // 2. Play ritual song
        setCurrentAction(isAnthem ? 'Performing National Anthem' : 'Performing Vande Mataram');
        await paPlayer.playURL(RITUAL_SONGS[announce.type]);
      }
    } catch (err) {
      console.error("PA SYSTEM: Transmission Playback Failure", err);
    } finally {
      setCurrentAction('Ended');
      setTimeout(() => processQueue(), 1200);
    }
  };

  const unlockAudio = async () => {
    await paPlayer.resume();
    setIsAudioUnlocked(true);
  };

  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-10 rounded-[3rem] shadow-2xl space-y-8 border border-slate-200">
          <div className="text-center">
            <div className="h-20 w-20 bg-blue-600 rounded-3xl flex items-center justify-center text-white text-4xl mx-auto mb-6 shadow-xl shadow-blue-100">
              <i className="fas fa-door-open"></i>
            </div>
            <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Terminal Setup</h2>
            <p className="text-slate-500 mt-2 font-medium">Configure this station's location</p>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Grade</label>
              <select 
                value={config.grade} 
                onChange={(e) => setConfig({ ...config, grade: e.target.value, division: '' })} 
                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-blue-300 outline-none font-bold text-slate-700 transition-all"
              >
                <option value="">Choose Grade</option>
                {GRADES_LIST.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            {config.grade && (
              <div className="space-y-2 animate-fade-in">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Division</label>
                <select 
                  value={config.division} 
                  onChange={(e) => setConfig({ ...config, division: e.target.value })} 
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-blue-300 outline-none font-bold text-slate-700"
                >
                  <option value="">Choose Division</option>
                  {(SCHOOL_HIERARCHY[config.grade] || []).map(d => <option key={d} value={d}>Division {d}</option>)}
                </select>
              </div>
            )}
            <button 
              disabled={!config.grade || !config.division} 
              onClick={() => { localStorage.setItem('paSystem_receiverConfig', JSON.stringify(config)); setIsConfigured(true); }} 
              className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black shadow-xl disabled:opacity-50 text-lg uppercase tracking-widest transition-all active:scale-95"
            >
              Connect Station
            </button>
            <button onClick={onExit} className="w-full py-3 text-slate-400 font-bold hover:text-slate-600 transition-all text-xs uppercase tracking-widest">
              Back to Mode Select
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isAudioUnlocked) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="space-y-8 max-w-sm">
          <div className="w-32 h-32 bg-blue-600 rounded-[2.5rem] flex items-center justify-center text-white text-5xl mx-auto shadow-2xl animate-pulse ring-8 ring-blue-900/30">
            <i className="fas fa-satellite-dish"></i>
          </div>
          <div className="text-white">
            <h2 className="text-4xl font-black uppercase tracking-tighter">{isGlobalMode ? 'Global PA Terminal' : 'Class Terminal'}</h2>
            <p className="text-slate-400 mt-4 font-bold tracking-widest text-xs uppercase opacity-70">
              Location: {config.grade} {config.division !== 'ALL' ? `• Division ${config.division}` : ''}
            </p>
          </div>
          <div className="space-y-4 w-full">
            <button 
              onClick={unlockAudio} 
              className="w-full py-6 bg-white text-slate-950 rounded-3xl font-black text-xl uppercase tracking-widest shadow-2xl hover:bg-blue-50 transition-all active:scale-95"
            >
              Activate System
            </button>
            <button 
              onClick={onExit} 
              className="w-full py-4 text-slate-500 font-black uppercase text-xs tracking-widest hover:text-white transition-all underline decoration-2 underline-offset-8"
            >
              Exit Terminal
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6 relative overflow-hidden font-inter">
      {/* Background Visualizer Effect */}
      <div className={`absolute inset-0 transition-opacity duration-1000 ${isPlaying ? 'opacity-30' : 'opacity-5'}`}>
        <div className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-600 via-transparent to-transparent animate-[spin_40s_linear_infinite]"></div>
      </div>

      {/* Top Left Status */}
      <div className="absolute top-10 left-10 flex items-center gap-5 bg-white/5 p-5 rounded-[2rem] backdrop-blur-2xl border border-white/10 shadow-2xl">
        <div className="w-14 h-14 bg-white text-slate-950 rounded-2xl flex items-center justify-center font-black text-2xl shadow-xl">PA</div>
        <div>
          <p className="font-black text-xl tracking-tighter uppercase">{config.grade}</p>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${status === 'ONLINE' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{status}</p>
          </div>
        </div>
      </div>

      {/* Top Right Exit */}
      <button 
        onClick={onExit} 
        className="absolute top-10 right-10 px-8 py-5 bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-500 rounded-2xl border border-white/10 transition-all font-black text-xs uppercase tracking-[0.2em] backdrop-blur-2xl group shadow-2xl"
      >
        <i className="fas fa-power-off mr-3 group-hover:rotate-90 transition-transform"></i> System Exit
      </button>

      {/* Main UI */}
      <div className="z-10 text-center w-full max-w-4xl space-y-12">
        {isPlaying ? (
          <div className="animate-fade-in space-y-12">
            <div className="flex justify-center gap-4 h-48 items-end">
              {[...Array(16)].map((_, i) => (
                <div key={i} className="w-4 bg-blue-500 rounded-full animate-wave shadow-lg shadow-blue-500/20" style={{ animationDelay: `${i * 0.1}s`, height: `${30 + Math.random() * 70}%` }} />
              ))}
            </div>
            <div className="p-16 bg-white/5 border border-white/10 rounded-[4rem] backdrop-blur-3xl shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-blue-600/5 group-hover:bg-blue-600/10 transition-colors"></div>
              <p className="text-blue-400 font-black uppercase text-xs tracking-[0.5em] mb-8 relative">{currentAction}</p>
              <p className="text-3xl sm:text-5xl font-light italic leading-relaxed text-slate-100 relative max-w-3xl mx-auto">
                {lastAnnouncement?.type === 'text' ? `"${lastAnnouncement.content}"` : "Official Audio Stream In Progress..."}
              </p>
            </div>
          </div>
        ) : (
          <div className="opacity-10 flex flex-col items-center gap-10 py-20">
            <div className="relative">
              <i className="fas fa-broadcast-tower text-9xl animate-pulse"></i>
              <div className="absolute -inset-10 border-4 border-white/20 rounded-full animate-ping opacity-20"></div>
            </div>
            <h2 className="text-2xl font-black tracking-[1em] uppercase text-slate-400">Monitoring Airwaves</h2>
          </div>
        )}
      </div>

      {/* Bottom Visual Tag */}
      <div className="absolute bottom-10 text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] opacity-40">
        Smart PA System Deployment • Terminal v2.5
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes wave { 0%, 100% { transform: scaleY(0.4); opacity: 0.3; } 50% { transform: scaleY(1.5); opacity: 1; } }
        .animate-wave { animation: wave 1s ease-in-out infinite; transform-origin: bottom; }
        .font-inter { font-family: 'Inter', sans-serif; }
      `}} />
    </div>
  );
};

export default ReceiverInterface;
