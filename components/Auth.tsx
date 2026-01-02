
import React, { useState } from 'react';
import { supabase } from '../services/supabase';

interface AuthProps {
  onBack: () => void;
}

const Auth: React.FC<AuthProps> = ({ onBack }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Admin account created! Check your email to verify.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-100 font-inter">
      <div className="max-w-md w-full bg-white p-10 rounded-[3rem] shadow-2xl border border-white">
        <div className="text-center mb-10">
          <div className="h-20 w-20 bg-blue-600 rounded-3xl flex items-center justify-center text-white text-4xl mx-auto mb-6 shadow-xl shadow-blue-100">
            <i className="fas fa-shield-alt"></i>
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">{isLogin ? 'PA Console Login' : 'Register Admin'}</h2>
          <p className="text-slate-400 mt-2 text-xs font-bold uppercase tracking-widest">Authorized Personnel Only</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-blue-100 outline-none font-bold text-slate-700" placeholder="admin@school.edu" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-blue-100 outline-none font-bold text-slate-700" placeholder="••••••••" />
          </div>
          {error && <div className="p-4 bg-red-50 text-red-600 text-xs font-bold rounded-xl border border-red-100">{error}</div>}
          <button disabled={loading} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black active:scale-95 transition-all shadow-xl shadow-blue-100 uppercase tracking-widest mt-4">
            {loading ? <i className="fas fa-spinner fa-spin"></i> : (isLogin ? 'Secure Sign In' : 'Create Admin Profile')}
          </button>
        </form>
        <button onClick={() => setIsLogin(!isLogin)} className="w-full mt-8 text-xs font-black text-blue-600 uppercase tracking-widest hover:text-blue-700 transition-all">
          {isLogin ? "Need access? Request Credentials" : "Already registered? Sign In"}
        </button>
        <button onClick={onBack} className="w-full mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-all flex items-center justify-center gap-2">
          <i className="fas fa-arrow-left"></i> Return to Main Screen
        </button>
      </div>
    </div>
  );
};

export default Auth;
