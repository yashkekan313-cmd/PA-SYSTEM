
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
        alert('Verification email sent!');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-2xl border border-slate-100">
        <div className="text-center mb-8">
          <div className="h-16 w-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-3xl mx-auto mb-4"><i className="fas fa-shield-alt"></i></div>
          <h2 className="text-2xl font-bold text-slate-900">{isLogin ? 'Teacher Portal' : 'Register Admin'}</h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none" placeholder="Email" />
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none" placeholder="Password" />
          {error && <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100">{error}</div>}
          <button disabled={loading} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold active:scale-95 transition-all">{loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}</button>
        </form>
        <button onClick={() => setIsLogin(!isLogin)} className="w-full mt-6 text-sm font-semibold text-blue-600">{isLogin ? "Need an account? Sign Up" : "Already registered? Log In"}</button>
        <button onClick={onBack} className="w-full mt-4 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-all">Back to Main Screen</button>
      </div>
    </div>
  );
};

export default Auth;
