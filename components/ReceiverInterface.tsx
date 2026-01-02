
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
      return saved ? JSON.parse(saved) : { grade: isGlobalMode ? 'WHOLE SCHOOL' : '', division: isGlobalMode ? 'ALL' : '' };
    } catch {
      return { grade: '', division: '' };
    }
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAction, setCurrentAction] = useState<string>('');
  const [status, setStatus] = useState<'OFFLINE' | 'ONLINE' | 'CONNECTING'>('OFFLINE');
  const [lastAnnouncement, setLastAnnouncement] = useState<Announcement | null>(null);
  const playQueue = useRef<Announcement[]>([]);

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
          if (String(announce.grade) === String(config.grade) && divs.includes(String(config.division))) {
            forMe = true;
          }
        }

        if (forMe) {
          playQueue.current.push(announce);
          if (!isPlaying) processQueue();
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setStatus('ONLINE');
        else setStatus('OFFLINE');
      });

    return () => { supabase.removeChannel(channel); };
  }, [isConfigured, isAudioUnlocked, config, isPlaying, isGlobalMode]);

  const processQueue = async () => {
    if (playQueue.current.length === 0) {
      setIsPlaying(false);
      setCurrentAction('');
      return;
    }

    setIsPlaying(true);
    const announce = playQueue.current.shift()!;
    setLastAnnouncement(announce);

    try {
      if (announce.type === 'text') {
        setCurrentAction('AI Voice Broadcast...');
        const audio = await generateTTS(announce.content);
        await paPlayer.playPCM(audio);
      } else if (announce.type === 'audio') {
        setCurrentAction('Live Voice Transmission...');
        await paPlayer.playVoice(announce.content);
      } else if (announce.type === 'anthem' || announce.type === 'vande') {
        const isAnthem = announce.type === 'anthem';
        setCurrentAction('Preparing Ritual...');
        const intro = await generateTTS(isAnthem ? "School, attention. Please stand for the National Anthem." : "Playing Vande Mataram.");
        await paPlayer.playPCM(intro);
        setCurrentAction(isAnthem ? 'National Anthem' : 'Vande Mataram');
        await paPlayer.playURL(RITUAL_SONGS[announce.type]);
      }
    } catch (err) {
      console.error("Playback error:", err);
    } finally {
      setCurrentAction('Ended');
      setTimeout(() => processQueue(), 1000);
    }
  };

  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-10 rounded-[3rem] shadow-2xl space-y-8 border border-slate-200">
          <div className="text-center">
            <div className="h-20 w-20 bg-blue-600 rounded-3xl flex items-center justify-center text-white text-4xl mx-auto mb-6 shadow-xl shadow-blue-100"><i className="fas fa-door-open"></i></div>
            <h2 className="text-3xl font-black text-slate-900 uppercase">Classroom Terminal</h2>
            <p className="text-slate-500 mt-2 font-medium">Select your grade and division</p>
          </div>
          <div className="space-y-4">
            <select value={config.grade} onChange={(e) => setConfig({ ...config, grade: e.target.value, division: '' })} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-blue-300 outline-none font-bold text-slate-700">
              <option value="">Choose Grade</option>
              {GRADES_LIST.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            {config.grade && (
              <select value={config.division} onChange={(e) => setConfig({ ...config, division: e.target.value })} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-blue-300 outline-none font-bold text-slate-700 animate-fade-in">
                <option value="">Choose Division</option>
                {(SCHOOL_HIERARCHY[config.grade] || []).map(d => <option key={d} value={d}>Division {d}</option>)}
              </select>
            )}
            <button disabled={!config.grade || !config.division} onClick={() => { localStorage.setItem('paSystem_receiverConfig', JSON.stringify(config)); setIsConfigured(true); }} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black shadow-xl disabled:opacity-50 text-lg uppercase">Connect Station</button>
            <button onClick={onExit} className="w-full py-3 text-slate-400 font-bold hover:text-slate-600 transition-all text-xs uppercase">Go Back</button>
          </div>
        </div>
      </div>
    );
  }

  if (!isAudioUnlocked) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="space-y-8 max-w-sm">
          <div className="w-32 h-32 bg-blue-600 rounded-full flex items-center justify-center text-white text-4xl mx-auto shadow-2xl animate-pulse ring-8 ring-blue-900/50"><i className="fas fa-broadcast-tower"></i></div>
          <div className="text-white">
            <h2 className="text-3xl font-black uppercase">{isGlobalMode ? 'Public Terminal' : 'Class Terminal'}</h2>
            <p className="text-slate-400 mt-4 font-medium italic">Station: {config.grade} {config.division !== 'ALL' ? `- Div ${config.division}` : ''}</p>
          </div>
          <button onClick={async () => { await paPlayer.resume(); setIsAudioUnlocked(true); }} className="w-full py-5 bg-white text-slate-950 rounded-2xl font-black text-lg uppercase tracking-widest shadow-2xl">Activate PA Station</button>
          <button onClick={onExit} className="text-slate-500 font-black uppercase text-xs tracking-widest hover:text-white transition-all underline">Back to Login</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6 relative overflow-hidden">
      <div className={`absolute inset-0 transition-opacity duration-1000 ${isPlaying ? 'opacity-30' : 'opacity-5'}`}>
        <div className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-600 via-transparent to-transparent animate-[spin_40s_linear_infinite]"></div>
      </div>

      <div className="absolute top-10 left-10 flex items-center gap-4 bg-white/5 p-4 rounded-3xl backdrop-blur-md border border-white/10">
        <div className="w-12 h-12 bg-white text-slate-950 rounded-2xl flex items-center justify-center font-black text-xl">PA</div>
        <div>
          <p className="font-bold text-lg">{config.grade} {config.division !== 'ALL' ? `- ${config.division}` : ''}</p>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${status === 'ONLINE' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{status}</p>
          </div>
        </div>
      </div>

      <button onClick={onExit} className="absolute top-10 right-10 px-6 py-4 bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-500 rounded-2xl border border-white/10 transition-all font-black text-[10px] uppercase tracking-widest backdrop-blur-md">
        <i className="fas fa-power-off mr-2"></i> Exit System
      </button>

      <div className="z-10 text-center w-full max-w-4xl space-y-12">
        {isPlaying ? (
          <div className="animate-fade-in space-y-10">
            <div className="flex justify-center gap-4 h-48 items-end">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="w-4 bg-blue-500 rounded-full animate-wave" style={{ animationDelay: `${i * 0.1}s`, height: `${30 + Math.random() * 70}%` }} />
              ))}
            </div>
            <div className="p-12 bg-white/5 border border-white/10 rounded-[4rem] backdrop-blur-3xl shadow-2xl">
              <p className="text-blue-400 font-black uppercase text-[10px] tracking-[0.4em] mb-6">{currentAction}</p>
              <p className="text-2xl sm:text-4xl font-light italic leading-relaxed text-slate-100">
                {lastAnnouncement?.type === 'text' ? `"${lastAnnouncement.content}"` : "Live School Transmission..."}
              </p>
            </div>
          </div>
        ) : (
          <div className="opacity-10 flex flex-col items-center gap-8 py-20">
            <i className="fas fa-satellite-dish text-9xl animate-pulse"></i>
            <h2 className="text-2xl font-bold tracking-[0.8em] uppercase text-slate-400">Monitoring Airwaves</h2>
          </div>
        )}
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes wave { 0%, 100% { transform: scaleY(0.4); opacity: 0.3; } 50% { transform: scaleY(1.5); opacity: 1; } }
        .animate-wave { animation: wave 1.2s ease-in-out infinite; transform-origin: bottom; }
      `}} />
    </div>
  );
};

export default ReceiverInterface;
