
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { Announcement, ReceiverConfig } from '../types';
import { GRADES_LIST, SCHOOL_HIERARCHY } from '../constants';
import { generateTTS } from '../services/geminiService';
import { paPlayer } from '../services/audioService';

/**
 * Official School Ritual Audio Links - Stored in Supabase
 */
const RITUAL_SONGS: Record<string, string> = {
  'anthem': 'https://reyfxiecqhyqxmszxvnn.supabase.co/storage/v1/object/public/Announcements/Jana%20Gana%20Mana%20(HD)%20-%20National%20Anthem%20With%20Lyrics%20-%20Best%20Patriotic%20Song.mp3', 
  'vande': 'https://reyfxiecqhyqxmszxvnn.supabase.co/storage/v1/object/public/Announcements/Vande%20Mataram%20(HD)%20-%20National%20Song%20Of%20india%20-%20Best%20Patriotic%20Song.mp3'
};

interface ReceiverInterfaceProps {
  onExit: () => void;
}

const ReceiverInterface: React.FC<ReceiverInterfaceProps> = ({ onExit }) => {
  const [isConfigured, setIsConfigured] = useState(false);
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  const [config, setConfig] = useState<ReceiverConfig>(() => {
    const saved = localStorage.getItem('paSystem_receiverConfig');
    try {
      return saved ? JSON.parse(saved) : { grade: '', division: '' };
    } catch {
      return { grade: '', division: '' };
    }
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAction, setCurrentAction] = useState<string>('');
  const [status, setStatus] = useState<'OFFLINE' | 'ONLINE' | 'CONNECTING'>('OFFLINE');
  const [lastAnnouncement, setLastAnnouncement] = useState<Announcement | null>(null);
  const playQueue = useRef<Announcement[]>([]);

  const safeStr = (val: any): string => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    return JSON.stringify(val);
  };

  useEffect(() => {
    if (config.grade && config.division) {
      setIsConfigured(true);
    }
  }, [config]);

  useEffect(() => {
    if (!isConfigured || !isAudioUnlocked) return;

    setStatus('CONNECTING');

    const channel = supabase.channel('pa_system_main')
      .on(
        'postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'announcements' }, 
        (payload) => {
          const announce = payload.new as Announcement;
          
          let forMe = false;
          if (announce.target_mode === 'WHOLE_SCHOOL') {
            forMe = true;
          } else if (announce.target_mode === 'SELECTED_GRADE') {
            const divs = Array.isArray(announce.divisions) ? announce.divisions.map(String) : [];
            if (String(announce.grade) === String(config.grade) && divs.includes(String(config.division))) {
              forMe = true;
            }
          }

          if (forMe) {
            playQueue.current.push(announce);
            if (!isPlaying) {
              processQueue();
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setStatus('ONLINE');
        else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') setStatus('OFFLINE');
      });

    return () => { 
      supabase.removeChannel(channel); 
    };
  }, [isConfigured, isAudioUnlocked, config, isPlaying]);

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
        setCurrentAction('Broadcasting Announcement...');
        const audio = await generateTTS(safeStr(announce.content));
        await paPlayer.playPCM(audio);
      } else if (announce.type === 'audio') {
        setCurrentAction('Receiving Voice Message...');
        await paPlayer.playPCM(safeStr(announce.content));
      } else if (announce.type === 'anthem' || announce.type === 'vande') {
        const isAnthem = announce.type === 'anthem';
        const ritualUrl = RITUAL_SONGS[announce.type];
        
        // 1. Play Intro
        try {
          setCurrentAction('Preparing Ritual...');
          const introText = isAnthem 
            ? "Attention school. Please stand for the National Anthem." 
            : "Attention school. Playing Vande Mataram.";
          const introAudio = await generateTTS(introText);
          await paPlayer.playPCM(introAudio);
        } catch (e) { console.warn("Intro TTS failed", e); }

        // 2. Play Song
        setCurrentAction(isAnthem ? 'Playing National Anthem' : 'Playing Vande Mataram');
        await paPlayer.playURL(ritualUrl);
      }
    } catch (err) {
      console.error("PA SYSTEM Queue Error:", err);
    } finally {
      setCurrentAction('Transmission Ended');
      setTimeout(() => processQueue(), 1500);
    }
  };

  const unlockAudio = async () => {
    await paPlayer.resume();
    setIsAudioUnlocked(true);
  };

  const handleSaveConfig = () => {
    if (!config.grade || !config.division) return;
    localStorage.setItem('paSystem_receiverConfig', JSON.stringify(config));
    setIsConfigured(true);
  };

  const handleExit = () => {
    if (confirm("Are you sure you want to disconnect this terminal?")) {
      onExit();
    }
  };

  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-10 rounded-[3rem] shadow-2xl space-y-8 border border-slate-200">
          <div className="text-center">
            <div className="h-20 w-20 bg-blue-600 rounded-3xl flex items-center justify-center text-white text-4xl mx-auto mb-6 shadow-xl shadow-blue-100">
              <i className="fas fa-school"></i>
            </div>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight uppercase">Terminal Setup</h2>
            <p className="text-slate-500 mt-2 font-medium">Classroom receiver configuration</p>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Current Grade</label>
              <select 
                value={config.grade}
                onChange={(e) => setConfig({ ...config, grade: e.target.value, division: '' })}
                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-blue-300 outline-none font-bold text-slate-700 transition-all appearance-none"
              >
                <option value="">Choose Grade</option>
                {GRADES_LIST.map(g => <option key={g} value={g}>{safeStr(g)}</option>)}
              </select>
            </div>
            {config.grade && (
              <div className="space-y-2 animate-fade-in">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Division</label>
                <select 
                  value={config.division}
                  onChange={(e) => setConfig({ ...config, division: e.target.value })}
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-blue-300 outline-none font-bold text-slate-700 transition-all appearance-none"
                >
                  <option value="">Choose Division</option>
                  {(SCHOOL_HIERARCHY[config.grade] || []).map(d => <option key={d} value={d}>Division {safeStr(d)}</option>)}
                </select>
              </div>
            )}
            <button 
              disabled={!config.grade || !config.division}
              onClick={handleSaveConfig}
              className="w-full py-5 bg-blue-600 text-white rounded-2xl font-bold shadow-xl shadow-blue-200 active:scale-95 transition-all disabled:opacity-50 text-lg uppercase tracking-widest"
            >
              Secure Connection
            </button>
            <button onClick={onExit} className="w-full py-3 text-slate-400 font-bold hover:text-slate-600 transition-all text-xs uppercase tracking-widest">
              Go Back
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
          <div className="w-32 h-32 bg-blue-600 rounded-full flex items-center justify-center text-white text-4xl mx-auto shadow-2xl animate-pulse ring-8 ring-blue-900/50">
            <i className="fas fa-broadcast-tower"></i>
          </div>
          <div className="text-white">
            <h2 className="text-3xl font-black tracking-tight uppercase">PA SYSTEM READY</h2>
            <p className="text-slate-400 mt-4 font-medium italic">Station: {safeStr(config.grade)} - Div {safeStr(config.division)}</p>
          </div>
          <button 
            onClick={unlockAudio} 
            className="w-full py-5 bg-white text-slate-950 rounded-2xl font-black text-lg active:scale-95 transition-all uppercase tracking-[0.2em] shadow-2xl hover:bg-blue-50"
          >
            Activate Station
          </button>
          <button onClick={handleExit} className="text-slate-500 font-black uppercase text-xs tracking-widest hover:text-white transition-all">
            Exit System
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6 relative overflow-hidden">
      {/* Background Visualizer Effect */}
      <div className={`absolute inset-0 transition-opacity duration-1000 ${isPlaying ? 'opacity-30' : 'opacity-5'}`}>
        <div className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-600 via-transparent to-transparent animate-[spin_40s_linear_infinite]"></div>
      </div>

      <div className="absolute top-10 left-10 flex items-center gap-4 bg-white/5 p-4 rounded-3xl backdrop-blur-md border border-white/10">
        <div className="w-12 h-12 bg-white text-slate-950 rounded-2xl flex items-center justify-center font-black text-xl shadow-xl">PA</div>
        <div>
          <p className="font-bold text-lg tracking-tight">{safeStr(config.grade)} - {safeStr(config.division)}</p>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${status === 'ONLINE' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{safeStr(status)}</p>
          </div>
        </div>
      </div>

      <button 
        onClick={handleExit}
        className="absolute top-10 right-10 flex items-center gap-2 px-6 py-4 bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-500 rounded-2xl border border-white/10 transition-all font-black text-[10px] uppercase tracking-widest backdrop-blur-md"
      >
        <i className="fas fa-power-off"></i> Exit Station
      </button>

      <div className="z-10 text-center w-full max-w-4xl space-y-12">
        {isPlaying ? (
          <div className="animate-fade-in space-y-10">
            <div className="flex justify-center gap-4 h-48 items-end">
              {[...Array(16)].map((_, i) => (
                <div key={i} className="w-4 bg-blue-500 rounded-full animate-wave" style={{ animationDelay: `${i * 0.1}s`, height: `${30 + Math.random() * 70}%` }} />
              ))}
            </div>
            <div className="p-12 bg-white/5 border border-white/10 rounded-[4rem] backdrop-blur-3xl shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-blue-600/5 group-hover:bg-blue-600/10 transition-colors"></div>
              <p className="text-blue-400 font-black uppercase text-[10px] tracking-[0.4em] mb-6 relative">
                {currentAction || 'Live Audio Stream'}
              </p>
              <p className="text-2xl sm:text-3xl font-light italic leading-relaxed text-slate-100 relative">
                {lastAnnouncement?.type === 'text' 
                  ? `"${safeStr(lastAnnouncement.content)}"` 
                  : (lastAnnouncement?.type === 'anthem' || lastAnnouncement?.type === 'vande')
                    ? `National Ritual Performance In Progress...`
                    : "Receiving voice transmission..."}
              </p>
            </div>
          </div>
        ) : (
          <div className="opacity-10 flex flex-col items-center gap-8 py-20">
            <i className="fas fa-satellite-dish text-9xl animate-pulse"></i>
            <h2 className="text-2xl font-bold tracking-[0.8em] uppercase text-slate-400">Monitoring Station</h2>
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
