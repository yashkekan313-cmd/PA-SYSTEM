
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

  const safeStr = (val: any): string => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    return JSON.stringify(val);
  };

  useEffect(() => {
    fetchHistory();
    const channel = supabase.channel('announcements_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, () => {
        fetchHistory();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchHistory = async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) console.error("History fetch error:", error);
    if (data) setHistory(data);
  };

  const handleLogoutClick = async () => {
    await supabase.auth.signOut();
    onLogout();
  };

  const toggleRecording = async () => {
    if (isRecording) {
      setIsBroadcasting(true);
      try {
        const audioBase64 = await voiceRecorder.stop();
        if (audioBase64) {
          await sendAnnouncement('audio', audioBase64);
        }
      } finally {
        setIsRecording(false);
        setIsBroadcasting(false);
      }
    } else {
      await voiceRecorder.start();
      setIsRecording(true);
    }
  };

  const sendAnnouncement = async (announceType: string, content: string) => {
    if (targetMode === 'SELECTED_GRADE' && (!selectedGrade || selectedDivs.length === 0)) {
      alert('Please select grade and divisions.');
      return;
    }

    const newAnnounce = {
      type: announceType,
      content: safeStr(content),
      target_mode: targetMode,
      grade: targetMode === 'SELECTED_GRADE' ? safeStr(selectedGrade) : null,
      divisions: targetMode === 'SELECTED_GRADE' ? selectedDivs : null,
      created_by: user?.id
    };

    const { error } = await supabase.from('announcements').insert([newAnnounce]);
    
    if (error) {
      alert('Broadcast Error: ' + error.message);
    } else {
      setText('');
      // Local preview for admin (optional, can be disabled if distracting)
      if (announceType === 'text') {
        try {
          const audio = await generateTTS(content);
          paPlayer.playPCM(audio);
        } catch (e) {
          console.error("Local preview failed:", e);
        }
      }
    }
  };

  const handleTTSSubmit = async () => {
    if (!text.trim()) return;
    setIsBroadcasting(true);
    try {
      await sendAnnouncement('text', text);
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleRitual = async (ritualId: string) => {
    setIsBroadcasting(true);
    try {
      const ritualName = RITUALS.find(r => r.id === ritualId)?.name || 'Ritual';
      await sendAnnouncement(ritualId, `${ritualName} Initiation`);
    } finally {
      setIsBroadcasting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
      <header className="flex justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-blue-600 text-white rounded-3xl shadow-xl shadow-blue-100">
            <i className="fas fa-microphone-alt text-2xl"></i>
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">PA SYSTEM Console</h1>
            <p className="text-slate-400 text-xs font-bold tracking-widest">{safeStr(user?.email)}</p>
          </div>
        </div>
        <button onClick={handleLogoutClick} className="px-6 py-3 bg-slate-50 text-slate-600 hover:text-red-600 font-black rounded-2xl border border-slate-200 transition-all flex items-center gap-2 text-sm uppercase tracking-widest">
          <i className="fas fa-power-off"></i> Exit Console
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-8">STEP 1: SELECT AUDIENCE</h2>
            <div className="flex gap-4">
              <button 
                onClick={() => setTargetMode('WHOLE_SCHOOL')}
                className={`flex-1 py-5 rounded-[1.5rem] border-2 font-black transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-sm ${targetMode === 'WHOLE_SCHOOL' ? 'bg-blue-600 border-blue-600 text-white shadow-2xl shadow-blue-200' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'}`}
              >
                <i className="fas fa-broadcast-tower"></i> Whole School
              </button>
              <button 
                onClick={() => setTargetMode('SELECTED_GRADE')}
                className={`flex-1 py-5 rounded-[1.5rem] border-2 font-black transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-sm ${targetMode === 'SELECTED_GRADE' ? 'bg-blue-600 border-blue-600 text-white shadow-2xl shadow-blue-200' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'}`}
              >
                <i className="fas fa-users-class"></i> Targeted
              </button>
            </div>

            {targetMode === 'SELECTED_GRADE' && (
              <div className="mt-8 pt-8 border-t border-slate-50 space-y-8 animate-fade-in">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Choose Grade</label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                    {GRADES_LIST.map(g => (
                      <button 
                        key={g}
                        onClick={() => { setSelectedGrade(g); setSelectedDivs([]); }}
                        className={`p-4 rounded-2xl border-2 text-xs font-black transition-all ${selectedGrade === g ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'}`}
                      >
                        {safeStr(g)}
                      </button>
                    ))}
                  </div>
                </div>
                {selectedGrade && (
                  <div className="animate-fade-in">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Choose Divisions</label>
                    <div className="flex flex-wrap gap-3">
                      {SCHOOL_HIERARCHY[selectedGrade].map(div => (
                        <button
                          key={div}
                          onClick={() => setSelectedDivs(prev => prev.includes(div) ? prev.filter(d => d !== div) : [...prev, div])}
                          className={`w-14 h-14 rounded-2xl border-2 font-black flex items-center justify-center transition-all text-sm ${selectedDivs.includes(div) ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'}`}
                        >
                          {safeStr(div)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-8">STEP 2: COMPOSE MESSAGE</h2>
            <div className="flex bg-slate-50 p-1.5 rounded-[1.5rem] mb-8">
              <button onClick={() => setType('text')} className={`flex-1 py-4 rounded-[1.2rem] text-sm font-black uppercase tracking-widest transition-all ${type === 'text' ? 'bg-white shadow-md text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>Text-to-Speech</button>
              <button onClick={() => setType('audio')} className={`flex-1 py-4 rounded-[1.2rem] text-sm font-black uppercase tracking-widest transition-all ${type === 'audio' ? 'bg-white shadow-md text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>Live Audio</button>
            </div>

            {type === 'text' ? (
              <div className="space-y-6">
                <textarea 
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type the official school announcement..."
                  className="w-full h-48 p-8 rounded-[2rem] bg-slate-50 border-2 border-transparent focus:border-blue-100 focus:bg-white outline-none transition-all font-medium text-slate-700 text-xl leading-relaxed"
                />
                <button 
                  disabled={isBroadcasting || !text.trim()}
                  onClick={handleTTSSubmit}
                  className="w-full py-6 bg-blue-600 text-white rounded-[1.5rem] font-black shadow-2xl shadow-blue-200 active:scale-[0.98] disabled:opacity-50 transition-all text-lg uppercase tracking-[0.2em]"
                >
                  {isBroadcasting ? <i className="fas fa-satellite fa-spin"></i> : 'INITIATE BROADCAST'}
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 space-y-8">
                <button 
                  onClick={toggleRecording}
                  disabled={isBroadcasting}
                  className={`w-40 h-40 rounded-full flex items-center justify-center text-5xl shadow-2xl transition-all relative group ${isRecording ? 'bg-red-500 text-white ring-[12px] ring-red-100' : 'bg-blue-600 text-white ring-[12px] ring-blue-50 hover:bg-blue-700'}`}
                >
                  {isRecording ? <i className="fas fa-stop"></i> : <i className="fas fa-microphone"></i>}
                  {isRecording && <span className="absolute -inset-4 border-4 border-red-500 rounded-full animate-ping opacity-20"></span>}
                </button>
                <div className="text-center">
                  <p className="font-black text-2xl text-slate-800 tracking-tight uppercase">{isRecording ? 'Recording Live...' : 'Tap to Start Mic'}</p>
                  <p className="text-sm text-slate-400 font-bold mt-2 uppercase tracking-widest">Speak clearly into your microphone</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6">QUICK RITUALS</h2>
            <div className="grid grid-cols-1 gap-4">
              {RITUALS.map(ritual => (
                <button 
                  key={ritual.id}
                  onClick={() => handleRitual(ritual.id)}
                  disabled={isBroadcasting}
                  className="w-full bg-slate-50 p-6 rounded-[1.5rem] flex items-center gap-5 hover:bg-white border-2 border-transparent hover:border-blue-100 active:scale-95 transition-all group"
                >
                  <span className="text-4xl group-hover:scale-125 transition-transform">{safeStr(ritual.icon)}</span>
                  <div className="text-left">
                    <p className="font-black text-slate-800 text-sm uppercase tracking-widest">{safeStr(ritual.name)}</p>
                    <p className="text-[10px] text-slate-400 font-black uppercase mt-1">Real-time Ritual</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm h-[400px] flex flex-col">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6">TRANSMISSION LOGS</h2>
            <div className="overflow-y-auto space-y-4 flex-1 pr-2 scrollbar-hide">
              {history.map(item => (
                <div key={item.id} className="p-5 rounded-3xl bg-slate-50 border border-slate-100 text-xs">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-black uppercase text-[9px] text-blue-600 tracking-widest bg-blue-50 px-3 py-1 rounded-full">{safeStr(item.type)}</span>
                    <span className="text-slate-400 font-bold">{item.created_at ? new Date(item.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--'}</span>
                  </div>
                  <p className="font-bold text-slate-600 line-clamp-2 leading-relaxed italic">"{safeStr(item.content)}"</p>
                  <div className="mt-4 pt-3 border-t border-slate-200/50 text-[9px] text-slate-400 font-black uppercase tracking-widest flex items-center gap-2">
                    <i className="fas fa-bullseye text-blue-400"></i>
                    {item.target_mode === 'WHOLE_SCHOOL' ? 'WHOLE SCHOOL' : `${safeStr(item.grade)} (${Array.isArray(item.divisions) ? item.divisions.join(', ') : 'All'})`}
                  </div>
                </div>
              ))}
              {history.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4">
                   <i className="fas fa-history text-4xl opacity-20"></i>
                   <p className="text-[10px] font-black uppercase tracking-widest">No Transmissions</p>
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
