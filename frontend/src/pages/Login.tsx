import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { GraduationCap, Shield, User, ArrowRight, Loader2 } from 'lucide-react';

const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = (roleEmail: string) => {
    setEmail(roleEmail);
    setPassword('password123');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 relative overflow-hidden">
      {/* Background visual accents */}
      <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-primary-100/30 blur-3xl" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-accent-100/30 blur-3xl" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary-600 to-accent-500 flex items-center justify-center shadow-lg shadow-primary-200 mb-3">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold font-outfit tracking-tight text-slate-900">
            Academix
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Next-Generation Student Management
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-card rounded-2xl p-8 w-full border border-slate-200/60 shadow-xl">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Sign In to Portal</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs rounded font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 tracking-wider mb-1">
                Institutional Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@academix.edu"
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-slate-800 text-sm smooth-hover shadow-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 tracking-wider mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-slate-800 text-sm smooth-hover shadow-sm"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 shadow-md shadow-primary-200/50 hover:shadow-lg hover:shadow-primary-200/80 transition-all cursor-pointer"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Enter Dashboard
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Quick Demo Logins */}
        <div className="mt-8 text-center">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
            Quick-Login Demo Accounts
          </p>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => handleQuickLogin('admin@academix.edu')}
              className="py-3 px-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center gap-1.5 shadow-sm smooth-hover group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center group-hover:scale-105 smooth-hover">
                <Shield className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Admin</span>
            </button>
            
            <button
              onClick={() => handleQuickLogin('sarah.connor@academix.edu')}
              className="py-3 px-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center gap-1.5 shadow-sm smooth-hover group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 smooth-hover">
                <User className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Lecturer</span>
            </button>

            <button
              onClick={() => handleQuickLogin('emily.smith@academix.edu')}
              className="py-3 px-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center gap-1.5 shadow-sm smooth-hover group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 smooth-hover">
                <GraduationCap className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Student</span>
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-3 italic">
            Password: password123
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
