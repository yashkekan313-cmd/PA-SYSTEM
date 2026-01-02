
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Announcement, TargetMode } from '../types';
import { SCHOOL_HIERARCHY, RITUALS, GRADES_LIST } from '../constants';
import { generateTTS } from '../services/geminiService';
import { voiceRecorder, paPlayer } from '../services/audioService';

interface AdminDashboardProps {
  user: any;
  onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout }) => {
  const [type, setType] = useState<'text' | 'audio'>('text');
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [targetMode, setTargetMode] = useState<TargetMode>('WHOLE_SCHOOL');
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [selectedDivs, setSelectedDivs] = useState<string[]>([]);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [history, setHistory] = useState<Announcement[]>([]);

  useEffect(() => {
    fetchHistory();
    const channel = supabase.channel('announcements_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, () => fetchHistory())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchHistory = async () => {
    const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(10);
    if (data) setHistory(data);
  };

  const toggleRecording = async () => {
    if (isRecording) {
      setIsBroadcasting(true);
      try {
        const audioBase64 = await voiceRecorder.stop();
        if (audioBase64) {
          await sendAnnouncement('audio', audioBase64);
          // Local preview for admin
          await paPlayer.playVoice(audioBase64);
        }
      } catch (e) {
        console.error("PA SYSTEM: Mic stop failed", e);
      } finally {
        setIsRecording(false);
        setIsBroadcasting(false);
      }
    } else {
      try {
        await voiceRecorder.start();
        setIsRecording(true);
      } catch (e) {
        alert("Microphone access is required for live audio broadcasting.");
      }
    }
  };

  const sendAnnouncement = async (announceType: string, content: string) => {
    if (targetMode === 'SELECTED_GRADE' && (!selectedGrade || selectedDivs.length === 0)) {
      alert('Please select grade and divisions for targeted announcement.');
      return;
    }

    const newAnnounce = {
      type: announceType,
      content: content,
      target_mode: targetMode,
      grade: targetMode === 'SELECTED_GRADE' ? selectedGrade : null,
      divisions: targetMode === 'SELECTED_GRADE' ? selectedDivs : null,
      created_by: user?.id
    };

    const { error } = await supabase.from('announcements').insert([newAnnounce]);
    if (error) {
      alert('Broadcast Error: ' + error.message);
    } else {
      setText('');
    }
  };

  const handleTTSSubmit = async () => {
    if (!text.trim()) return;
    setIsBroadcasting(true);
    try {
      await sendAnnouncement('text', text);
      // Local preview to confirm for the admin
      const audio = await generateTTS(text);
      if (audio) await paPlayer.playPCM(audio);
    } catch (e) {
      console.error("PA SYSTEM: TTS Local Preview Failed", e);
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleRitual = async (ritualId: string) => {
    if (isBroadcasting) return;
    setIsBroadcasting(true);
    try {
      const ritual = RITUALS.find(r => r.id === ritualId);
      await sendAnnouncement(ritualId, ritual?.name || 'Ritual');
    } finally {
      setIsBroadcasting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 animate-fade-in font-inter">
      <header className="flex justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div className="flex items-center gap-5">
          <div className="p-5 bg-blue-600 text-white rounded-[1.5rem] shadow-xl shadow-blue-100">
            <i className="fas fa-bullhorn text-2xl"></i>
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">PA Console</h1>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{user?.email}</p>
          </div>
        </div>
        <button onClick={onLogout} className="px-8 py-4 bg-slate-50 text-slate-600 hover:text-red-600 font-black rounded-2xl border border-slate-200 transition-all flex items-center gap-3 text-xs uppercase tracking-widest group">
          <i className="fas fa-sign-out-alt group-hover:-translate-x-1 transition-transform"></i> Exit Console
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-8">STEP 1: TARGETING</h2>
            <div className="flex gap-4">
              <button onClick={() => setTargetMode('WHOLE_SCHOOL')} className={`flex-1 py-6 rounded-3xl border-2 font-black transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs ${targetMode === 'WHOLE_SCHOOL' ? 'bg-blue-600 border-blue-600 text-white shadow-2xl shadow-blue-100' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'}`}>
                <i className="fas fa-broadcast-tower"></i> Whole School
              </button>
              <button onClick={() => setTargetMode('SELECTED_GRADE')} className={`flex-1 py-6 rounded-3xl border-2 font-black transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs ${targetMode === 'SELECTED_GRADE' ? 'bg-blue-600 border-blue-600 text-white shadow-2xl shadow-blue-100' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'}`}>
                <i className="fas fa-users-class"></i> Targeted Classes
              </button>
            </div>

            {targetMode === 'SELECTED_GRADE' && (
              <div className="mt-10 pt-10 border-t border-slate-50 space-y-8 animate-fade-in">
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                  {GRADES_LIST.map(g => (
                    <button key={g} onClick={() => { setSelectedGrade(g); setSelectedDivs([]); }} className={`p-4 rounded-2xl border-2 text-[10px] font-black transition-all uppercase tracking-tighter ${selectedGrade === g ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'}`}>
                      {g}
                    </button>
                  ))}
                </div>
                {selectedGrade && (
                  <div className="flex flex-wrap gap-3 animate-fade-in">
                    {SCHOOL_HIERARCHY[selectedGrade].map(div => (
                      <button key={div} onClick={() => setSelectedDivs(prev => prev.includes(div) ? prev.filter(d => d !== div) : [...prev, div])} className={`w-14 h-14 rounded-2xl border-2 font-black flex items-center justify-center transition-all text-sm ${selectedDivs.includes(div) ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'}`}>
                        {div}
                      </button>
                    ))}
                    <button onClick={() => setSelectedDivs(SCHOOL_HIERARCHY[selectedGrade])} className="px-6 h-14 rounded-2xl border-2 border-slate-100 text-slate-400 font-black text-xs uppercase tracking-widest hover:border-slate-300 transition-all">All Divs</button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-8">STEP 2: BROADCAST MODE</h2>
            <div className="flex bg-slate-50 p-1.5 rounded-[1.8rem] mb-8">
              <button onClick={() => setType('text')} className={`flex-1 py-4 rounded-[1.4rem] text-xs font-black uppercase tracking-widest transition-all ${type === 'text' ? 'bg-white shadow-md text-blue-600' : 'text-slate-400'}`}>AI TTS</button>
              <button onClick={() => setType('audio')} className={`flex-1 py-4 rounded-[1.4rem] text-xs font-black uppercase tracking-widest transition-all ${type === 'audio' ? 'bg-white shadow-md text-blue-600' : 'text-slate-400'}`}>LIVE MIC</button>
            </div>

            {type === 'text' ? (
              <div className="space-y-6">
                <textarea 
                  value={text} 
                  onChange={(e) => setText(e.target.value)} 
                  placeholder="Draft school announcement..." 
                  className="w-full h-44 p-8 rounded-[2.5rem] bg-slate-50 border-2 border-transparent focus:bg-white focus:border-blue-50 outline-none font-medium text-slate-700 text-xl leading-relaxed transition-all" 
                />
                <button 
                  disabled={isBroadcasting || !text.trim()} 
                  onClick={handleTTSSubmit} 
                  className="w-full py-6 bg-blue-600 text-white rounded-[1.5rem] font-black shadow-2xl shadow-blue-100 disabled:opacity-50 text-lg uppercase tracking-[0.2em] transition-all active:scale-95"
                >
                  {isBroadcasting ? <i className="fas fa-spinner fa-spin mr-3"></i> : <i className="fas fa-broadcast-tower mr-3"></i>} 
                  {isBroadcasting ? 'Broadcasting...' : 'Launch Broadcast'}
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 space-y-8">
                <button 
                  onClick={toggleRecording} 
                  disabled={isBroadcasting} 
                  className={`w-40 h-40 rounded-full flex items-center justify-center text-5xl shadow-2xl transition-all relative group ${isRecording ? 'bg-red-500 text-white ring-[16px] ring-red-50' : 'bg-blue-600 text-white ring-[16px] ring-blue-50 hover:bg-blue-700'}`}
                >
                  {isRecording ? <i className="fas fa-stop"></i> : <i className="fas fa-microphone"></i>}
                  {isRecording && <span className="absolute -inset-6 border-4 border-red-500/20 rounded-full animate-ping"></span>}
                </button>
                <div className="text-center">
                  <p className="font-black text-2xl text-slate-800 uppercase tracking-tighter">{isRecording ? 'Capturing Live Audio...' : 'Tap to Start Mic'}</p>
                  <p className="text-xs text-slate-400 font-bold mt-2 uppercase tracking-widest">Hold to speak, tap again to finish</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6">QUICK RITUALS</h2>
            <div className="grid grid-cols-1 gap-4">
              {RITUALS.map(ritual => (
                <button 
                  key={ritual.id} 
                  onClick={() => handleRitual(ritual.id)} 
                  disabled={isBroadcasting} 
                  className="w-full bg-slate-50 p-6 rounded-[2rem] flex items-center gap-5 hover:bg-white border-2 border-transparent hover:border-blue-100 transition-all group active:scale-95"
                >
                  <div className="h-14 w-14 bg-white rounded-2xl flex items-center justify-center text-3xl shadow-sm group-hover:scale-110 transition-transform">
                    {ritual.icon}
                  </div>
                  <div className="text-left">
                    <p className="font-black text-slate-800 text-xs uppercase tracking-widest">{ritual.name}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Full School Trigger</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm h-[380px] flex flex-col">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6">LIVE LOGS</h2>
            <div className="overflow-y-auto space-y-4 flex-1 pr-2 custom-scrollbar">
              {history.map(item => (
                <div key={item.id} className="p-5 rounded-[1.8rem] bg-slate-50 border border-slate-100">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-black uppercase text-[8px] text-blue-600 tracking-widest bg-blue-50 px-3 py-1 rounded-full">{item.type}</span>
                    <span className="text-slate-400 font-bold text-[9px]">{new Date(item.created_at || '').toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                  <p className="text-[11px] font-medium text-slate-700 line-clamp-2 italic">"{item.content}"</p>
                </div>
              ))}
              {history.length === 0 && (
                <div className="h-full flex items-center justify-center text-slate-300 opacity-50 uppercase text-[10px] font-black tracking-widest">
                  No History
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
