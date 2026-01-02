
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './services/supabase';
import Auth from './components/Auth';
import AdminDashboard from './components/AdminDashboard';
import ReceiverInterface from './components/ReceiverInterface';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [appMode, setAppMode] = useState<'ADMIN' | 'RECEIVER' | 'GLOBAL_RECEIVER' | null>(() => {
    return localStorage.getItem('paSystem_appMode') as any;
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSetMode = (mode: 'ADMIN' | 'RECEIVER' | 'GLOBAL_RECEIVER') => {
    setAppMode(mode);
    localStorage.setItem('paSystem_appMode', mode);
  };

  const clearMode = () => {
    setAppMode(null);
    localStorage.removeItem('paSystem_appMode');
    localStorage.removeItem('paSystem_receiverConfig');
  };

  if (!appMode) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full glass p-8 rounded-3xl shadow-xl text-center space-y-6">
          <div className="h-20 w-20 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-4xl mx-auto shadow-lg shadow-blue-200">
            <i className="fas fa-bullhorn"></i>
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">PA SYSTEM</h1>
            <p className="text-slate-500 mt-2 font-medium">Smart School Announcement System</p>
          </div>
          <div className="space-y-4 pt-4">
            <button 
              onClick={() => handleSetMode('ADMIN')}
              className="w-full py-4 px-6 bg-white border-2 border-slate-200 rounded-2xl font-bold text-slate-700 hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm flex items-center justify-center gap-3"
            >
              <i className="fas fa-user-tie text-blue-500"></i> Teacher / Admin Portal
            </button>
            <button 
              onClick={() => handleSetMode('RECEIVER')}
              className="w-full py-4 px-6 bg-white border-2 border-slate-200 rounded-2xl font-bold text-slate-700 hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm flex items-center justify-center gap-3"
            >
              <i className="fas fa-door-open text-blue-500"></i> Classroom Receiver
            </button>
            <button 
              onClick={() => handleSetMode('GLOBAL_RECEIVER')}
              className="w-full py-4 px-6 bg-white border-2 border-slate-200 rounded-2xl font-bold text-slate-700 hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm flex items-center justify-center gap-3"
            >
              <i className="fas fa-broadcast-tower text-blue-500"></i> Whole School Receiver
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-slate-50">
        <Routes>
          <Route 
            path="/" 
            element={
              appMode === 'ADMIN' ? (
                session ? <AdminDashboard user={session.user} onLogout={clearMode} /> : <Auth onBack={clearMode} />
              ) : (
                <ReceiverInterface 
                  onExit={clearMode} 
                  isGlobalMode={appMode === 'GLOBAL_RECEIVER'} 
                />
              )
            } 
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
