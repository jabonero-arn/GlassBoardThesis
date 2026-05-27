/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import UserDashboard from './pages/UserDashboard';
import FolderView from './pages/FolderView';
import TrashBin from './pages/TrashBin';
import Layout from './components/Layout';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user || null;
      setUser(currentUser);
      if (currentUser) {
        fetchProfile(currentUser);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user || null;
      setUser(currentUser);
      setError(null);
      if (currentUser) {
        await fetchProfile(currentUser);
      } else {
        setRole(null);
        setStatus(null);
        setFullName(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (currentUser: User) => {
    try {
      const { data: adminDoc, error: adminErr } = await supabase
        .from('admins')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (adminDoc && !adminErr) {
        setRole(adminDoc.role || 'admin');
        setStatus('approved'); // Admins are inherently approved
        setFullName(adminDoc.fullName || 'Administrator');
      } else {
        const { data: userDoc, error: userErr } = await supabase
          .from('users')
          .select('*')
          .eq('id', currentUser.id)
          .maybeSingle();

        if (userDoc && !userErr) {
          setRole(userDoc.role || 'user');
          setStatus(userDoc.status);
          setFullName(userDoc.fullName || 'User');
        } else {
          // Handle case where user is in Auth but not Firestore/database
          // Auto-create profile row in DB
          const isAdminEmail = currentUser.email === 'admin@test.com' || currentUser.email === 'christianjayefernan@gmail.com';
          if (isAdminEmail) {
            const { error: insertErr } = await supabase.from('admins').insert({
              id: currentUser.id,
              email: currentUser.email,
              fullName: 'System Admin',
              role: 'admin',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
            if (!insertErr) {
              setRole('admin');
              setStatus('approved');
              setFullName('System Admin');
              return;
            }
          }

          const { error: insertErr } = await supabase.from('users').insert({
            id: currentUser.id,
            email: currentUser.email,
            fullName: currentUser.user_metadata?.fullName || 'User',
            role: 'user',
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });

          if (!insertErr) {
            setRole('user');
            setStatus('pending');
            setFullName(currentUser.user_metadata?.fullName || 'User');
          } else {
            // Fallback: Just treat them as a pending user without crashing
            setRole('user');
            setStatus('pending');
            setFullName('User');
          }
        }
      }
    } catch (err: any) {
      console.error("Error fetching user data, falling back to guest/pending:", err);
      // Fallback: Don't show blocking red screen, let them see Pending layout or sign out gracefully
      setRole('user');
      setStatus('pending');
      setFullName('User');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center font-sans text-gray-500">Loading...</div>;
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center font-sans bg-slate-50 text-slate-800 p-8">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-rose-200 w-full max-w-md text-center">
          <h2 className="text-xl font-bold mb-3 text-rose-600 tracking-tight">Database Connection Error</h2>
          <p className="text-slate-500 mb-8 text-sm">{error}</p>
          <button onClick={() => { supabase.auth.signOut(); setError(null); }} className="w-full px-4 py-2 bg-indigo-600 text-white rounded text-sm font-bold uppercase tracking-wider hover:bg-indigo-700 transition-colors">
            Sign out and retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={
          !user ? <Login /> : 
          role === 'admin' ? <Navigate to="/admin" /> : 
          status === 'pending' ? <PendingApproval /> :
          (role === 'user' && status === 'approved') ? <Navigate to="/dashboard" /> :
          <div className="min-h-screen flex items-center justify-center">Unknown Role/Status</div>
        } />
        
        {user && status === 'approved' && role === 'user' && (
          <Route element={<Layout user={user} role={role} fullName={fullName} />}>
            <Route path="/dashboard" element={<UserDashboard user={user} />} />
            <Route path="/dashboard/folder/:folderId" element={<FolderView user={user} />} />
            <Route path="/trash" element={<TrashBin user={user} />} />
          </Route>
        )}

        {user && role === 'admin' && (
          <Route element={<Layout user={user} role={role} fullName={fullName} />}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>
        )}

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

function PendingApproval() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center font-sans bg-gray-50 text-gray-800 p-4">
      <div className="bg-white p-8 rounded-xl shadow-xs border border-gray-100 max-w-md text-center">
        <div className="w-16 h-16 bg-yellow-50 rounded-full flex items-center justify-center text-yellow-600 font-bold text-2xl mx-auto mb-6">
          🕒
        </div>
        <h2 className="text-2xl font-bold mb-3 text-slate-800 tracking-tight">Account Pending</h2>
        <p className="text-slate-500 mb-8 text-sm leading-relaxed">
          Thanks for signing up on <strong>Glass Board Archiving</strong>! <br />
          Please wait for the account confirmation. Your account is currently pending administrator approval.
        </p>
        <button 
          onClick={() => supabase.auth.signOut()} 
          className="w-full px-4 py-2 bg-indigo-600 text-white rounded text-sm font-bold uppercase tracking-wider hover:bg-indigo-700 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

