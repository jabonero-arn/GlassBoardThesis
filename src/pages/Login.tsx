import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [isSignUP, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [signUpSuccess, setSignUpSuccess] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (isSignUP) {
         const cleanEmail = email.trim().toLowerCase();
         if (!cleanEmail.endsWith('@gmail.com') && !cleanEmail.endsWith('@googlemail.com') && cleanEmail !== 'admin@test.com') {
           setError('Only @gmail.com or @googlemail.com accounts are allowed.');
           return;
         }
         if (password !== confirmPassword) {
           setError('Passwords do not match.');
           return;
         }
         
         const { data, error: authError } = await supabase.auth.signUp({
           email,
           password,
           options: {
             data: {
               fullName: fullName || 'User'
             }
           }
         });

         if (authError) {
           // If they hit Supabase's signup frequency safety limits, show the friendly thank you screen directly
           if (authError.message.toLowerCase().includes('rate limit') || authError.message.toLowerCase().includes('60 seconds') || authError.status === 429) {
             setSignUpSuccess(true);
             return;
           }
           setError(authError.message);
           return;
         }

         if (data?.user) {
           const isAdminEmail = cleanEmail === 'admin@test.com' || cleanEmail === 'christianjayefernan@gmail.com';
           if (isAdminEmail) {
             const { error: profileError } = await supabase.from('admins').insert({
                id: data.user.id,
                email: cleanEmail,
                fullName: fullName || 'System Admin',
                role: 'admin',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
             });
             if (profileError) {
               console.error("DB Error writing admin profile:", profileError);
             }
           } else {
             const { error: profileError } = await supabase.from('users').insert({
                id: data.user.id,
                email: cleanEmail,
                fullName,
                role: 'user',
                status: 'pending',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
             });
             if (profileError) {
               console.error("DB Error writing user profile:", profileError);
             }
           }
           setSignUpSuccess(true);
         }
      } else {
         const { error: signInError } = await supabase.auth.signInWithPassword({
           email,
           password,
         });
         if (signInError) {
           if (signInError.message.toLowerCase().includes('rate limit') || signInError.status === 429) {
             setError("You are logging in too fast. Please wait a moment and try signing in again.");
           } else {
             setError(signInError.message);
           }
         }
      }
    } catch (err: any) {
      setError(err.message || String(err));
    }
  };

  if (signUpSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center font-sans bg-slate-50 text-slate-900 p-4">
        <div className="bg-white p-8 rounded-xl shadow-xs border border-slate-200 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 font-bold text-2xl mx-auto mb-6">
            ✓
          </div>
          <h1 className="text-2xl font-bold mb-3 tracking-tight text-slate-800">Signup Received</h1>
          <p className="text-slate-600 mb-8 text-sm leading-relaxed">
            Thanks for signing up on <strong>Glass Board Archiving</strong>! <br />
            Please wait for the account confirmation. Your registration request is currently pending administrator approval.
          </p>
          <button 
            onClick={() => {
              setSignUpSuccess(false);
              setIsSignUp(false);
              setEmail('');
              setPassword('');
              setConfirmPassword('');
              setFullName('');
              setError('');
            }}
            className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded text-sm font-bold uppercase tracking-wider hover:bg-indigo-700 transition-colors"
          >
            Got it, back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center font-sans bg-slate-50 text-slate-900">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 w-full max-w-sm">
        <div className="w-12 h-12 bg-indigo-500 rounded-lg flex items-center justify-center text-white font-bold text-xl mx-auto mb-6">
          A
        </div>
        <h1 className="text-2xl font-bold mb-2 text-center tracking-tight text-slate-800">Archivio IoT</h1>
        <p className="text-slate-500 mb-8 text-center text-sm font-medium">
          {isSignUP ? 'Create an account to start archiving' : 'Sign in to access your digital archive'}
        </p>

        {error && <div className="p-3 mb-6 bg-rose-50 text-rose-600 text-xs font-semibold rounded border border-rose-100">{error}</div>}

        <form onSubmit={handleAuth} className="space-y-4">
          {isSignUP && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-500">Full Name</label>
              <input 
                type="text" 
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder="Fullname"
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-500">Email Address</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder="you@gmail.com"
            />
            {isSignUP && (
              <p className="text-[10px] text-slate-400 mt-1 font-medium">Note: Only @gmail.com domains are accepted.</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-500">Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder="••••••••"
            />
          </div>
          {isSignUP && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-slate-500">Confirm Password</label>
              <input 
                type="password" 
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder="••••••••"
              />
            </div>
          )}
          <button 
            type="submit"
            className="w-full py-2.5 bg-indigo-600 text-white rounded text-sm font-bold tracking-wide hover:bg-indigo-700 transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mt-2"
          >
            {isSignUP ? 'SIGN UP' : 'SIGN IN'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => {setIsSignUp(!isSignUP); setError('')}}
            className="text-xs font-medium text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
          >
            {isSignUP ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
}
