
import React, { useState } from 'react';
// Changed User to UserProfile from types.ts
import { UserProfile } from '../types';
// Changed non-existent GRADES and DIVISIONS to GRADES_LIST and SCHOOL_HIERARCHY
import { GRADES_LIST, SCHOOL_HIERARCHY } from '../constants';

// Local interface for the login data structure
interface LoginUser {
  role: 'ADMIN' | 'RECEIVER';
  grade?: string;
  division?: string;
}

interface LoginProps {
  onLogin: (user: LoginUser) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [role, setRole] = useState<'ADMIN' | 'RECEIVER'>('ADMIN');
  // Initialize grade with the first available grade string from constants
  const [grade, setGrade] = useState<string>(GRADES_LIST[0]);
  const [division, setDivision] = useState<string>('A');
  const [pin, setPin] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (role === 'ADMIN' && pin !== '1234') {
      alert('Invalid Admin PIN (Hint: 1234)');
      return;
    }
    onLogin({ role, grade, division });
  };

  // Get current divisions for the selected grade
  const currentDivisions = SCHOOL_HIERARCHY[grade] || [];

  return (
    <div className="flex items-center justify-center min-h-screen px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
        <div>
          <div className="mx-auto h-16 w-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-3xl mb-6">
            <i className="fas fa-bullhorn"></i>
          </div>
          <h2 className="text-center text-3xl font-extrabold text-slate-900">
            EduEcho
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600">
            Smart School PA Announcement System
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button
              type="button"
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${role === 'ADMIN' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-600'}`}
              onClick={() => setRole('ADMIN')}
            >
              Admin
            </button>
            <button
              type="button"
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${role === 'RECEIVER' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-600'}`}
              onClick={() => setRole('RECEIVER')}
            >
              Class Receiver
            </button>
          </div>

          <div className="space-y-4">
            {role === 'ADMIN' ? (
              <div>
                <label className="block text-sm font-medium text-slate-700">Admin PIN</label>
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter 1234"
                  required
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Grade</label>
                  <select
                    value={grade}
                    onChange={(e) => {
                      const newGrade = e.target.value;
                      setGrade(newGrade);
                      // Update division when grade changes to stay within valid options
                      if (SCHOOL_HIERARCHY[newGrade] && SCHOOL_HIERARCHY[newGrade].length > 0) {
                        setDivision(SCHOOL_HIERARCHY[newGrade][0]);
                      }
                    }}
                    className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {GRADES_LIST.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Division</label>
                  <select
                    value={division}
                    onChange={(e) => setDivision(e.target.value)}
                    className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {currentDivisions.map(d => <option key={d} value={d}>Div {d}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors shadow-lg shadow-blue-200"
          >
            Log In to {role === 'ADMIN' ? 'Dashboard' : 'Receiver'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
