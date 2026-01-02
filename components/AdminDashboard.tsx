
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
        if (audioBase64) await sendAnnouncement('audio', audioBase64);
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
      alert('Select grade and divisions.');
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
    if (error) alert('Error: ' + error.message);
    else setText('');
  };

  const handleTTSSubmit = async () => {
    if (!text.trim()) return;
    setIsBroadcasting(true);
    try {
      await sendAnnouncement('text', text);
      // Local preview
      const audio = await generateTTS(text);
      await paPlayer.playPCM(audio);
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleRitual = async (ritualId: string) => {
    setIsBroadcasting(true);
    try {
      const ritual = RITUALS.find(r => r.id === ritualId);
      await sendAnnouncement(ritualId, ritual?.name || '');
    } finally {
      setIsBroadcasting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
      <header className="flex justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-blue-600 text-white rounded-3xl shadow-xl shadow-blue-100"><i className="fas fa-microphone-alt text-2xl"></i></div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">PA Console</h1>
            <p className="text-slate-400 text-xs font-bold tracking-widest">{user?.email}</p>
          </div>
        </div>
        <button onClick={onLogout} className="px-6 py-3 bg-slate-50 text-slate-600 hover:text-red-600 font-black rounded-2xl border border-slate-200 transition-all flex items-center gap-2 text-sm uppercase tracking-widest">
          <i className="fas fa-power-off"></i> Exit Console
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-8">STEP 1: TARGET AUDIENCE</h2>
            <div className="flex gap-4">
              <button onClick={() => setTargetMode('WHOLE_SCHOOL')} className={`flex-1 py-5 rounded-[1.5rem] border-2 font-black transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-sm ${targetMode === 'WHOLE_SCHOOL' ? 'bg-blue-600 border-blue-600 text-white shadow-2xl' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'}`}>
                <i className="fas fa-broadcast-tower"></i> Whole School
              </button>
              <button onClick={() => setTargetMode('SELECTED_GRADE')} className={`flex-1 py-5 rounded-[1.5rem] border-2 font-black transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-sm ${targetMode === 'SELECTED_GRADE' ? 'bg-blue-600 border-blue-600 text-white shadow-2xl' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'}`}>
                <i className="fas fa-users-class"></i> Targeted Class
              </button>
            </div>

            {targetMode === 'SELECTED_GRADE' && (
              <div className="mt-8 pt-8 border-t border-slate-50 space-y-8 animate-fade-in">
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                  {GRADES_LIST.map(g => (
                    <button key={g} onClick={() => { setSelectedGrade(g); setSelectedDivs([]); }} className={`p-4 rounded-2xl border-2 text-[10px] font-black transition-all ${selectedGrade === g ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-slate-50 border-transparent text-slate-500'}`}>{g}</button>
                  ))}
                </div>
                {selectedGrade && (
                  <div className="flex flex-wrap gap-3 animate-fade-in">
                    {SCHOOL_HIERARCHY[selectedGrade].map(div => (
                      <button key={div} onClick={() => setSelectedDivs(prev => prev.includes(div) ? prev.filter(d => d !== div) : [...prev, div])} className={`w-12 h-12 rounded-2xl border-2 font-black flex items-center justify-center transition-all text-sm ${selectedDivs.includes(div) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-100 text-slate-400'}`}>{div}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-8">STEP 2: BROADCAST MODE</h2>
            <div className="flex bg-slate-50 p-1.5 rounded-[1.5rem] mb-8">
              <button onClick={() => setType('text')} className={`flex-1 py-4 rounded-[1.2rem] text-sm font-black uppercase tracking-widest transition-all ${type === 'text' ? 'bg-white shadow-md text-blue-600' : 'text-slate-400'}`}>AI TTS</button>
              <button onClick={() => setType('audio')} className={`flex-1 py-4 rounded-[1.2rem] text-sm font-black uppercase tracking-widest transition-all ${type === 'audio' ? 'bg-white shadow-md text-blue-600' : 'text-slate-400'}`}>LIVE MIC</button>
            </div>

            {type === 'text' ? (
              <div className="space-y-6">
                <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Type school announcement..." className="w-full h-40 p-8 rounded-[2rem] bg-slate-50 border-2 border-transparent focus:bg-white outline-none font-medium text-slate-700 text-xl" />
                <button disabled={isBroadcasting || !text.trim()} onClick={handleTTSSubmit} className="w-full py-6 bg-blue-600 text-white rounded-[1.5rem] font-black shadow-2xl disabled:opacity-50 text-lg uppercase tracking-widest">
                  {isBroadcasting ? <i className="fas fa-spinner fa-spin"></i> : 'BROADCAST NOW'}
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 space-y-6">
                <button onClick={toggleRecording} disabled={isBroadcasting} className={`w-32 h-32 rounded-full flex items-center justify-center text-4xl shadow-2xl transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse ring-8 ring-red-100' : 'bg-blue-600 text-white ring-8 ring-blue-50'}`}>
                  {isRecording ? <i className="fas fa-stop"></i> : <i className="fas fa-microphone"></i>}
                </button>
                <p className="font-black text-xl text-slate-800 uppercase">{isRecording ? 'RECORDING...' : 'TAP TO RECORD'}</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6">QUICK RITUALS</h2>
            <div className="grid grid-cols-1 gap-4">
              {RITUALS.map(ritual => (
                <button key={ritual.id} onClick={() => handleRitual(ritual.id)} disabled={isBroadcasting} className="w-full bg-slate-50 p-6 rounded-[1.5rem] flex items-center gap-5 hover:bg-white border-2 border-transparent hover:border-blue-100 transition-all group">
                  <span className="text-4xl group-hover:scale-125 transition-transform">{ritual.icon}</span>
                  <p className="font-black text-slate-800 text-xs uppercase tracking-widest">{ritual.name}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
