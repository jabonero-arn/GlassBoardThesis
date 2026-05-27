import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { Folder, Trash2, Users, LayoutDashboard, LogOut, Aperture, History, Bell, Trash, X, Check, ArrowRight, ShieldAlert, Laptop, Eye, Menu } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { getActivities, logActivity, ActivityLog, clearLogs } from '../lib/logger';

interface LayoutProps {
  user: User;
  role: string | null;
  fullName?: string | null;
}

export default function Layout({ user, role, fullName }: LayoutProps) {
  const navigate = useNavigate();
  const [logsOpen, setLogsOpen] = useState(window.innerWidth > 1024);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchLogs = async () => {
    const data = await getActivities();
    setLogs(data);
  };

  useEffect(() => {
    fetchLogs();

    const handleLogged = () => {
      fetchLogs();
      if (!logsOpen) {
        setUnreadCount(prev => prev + 1);
      }
    };

    window.addEventListener('activity_logged', handleLogged);

    // Also listen to supabase changes for real-time multiplayer notification logs
    const channel = supabase.channel('activity-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs' }, () => {
        fetchLogs();
      })
      .subscribe();

    return () => {
      window.removeEventListener('activity_logged', handleLogged);
      supabase.removeChannel(channel);
    };
  }, [logsOpen]);

  const handleSignOut = () => {
    supabase.auth.signOut();
    navigate('/');
  };

  const handleClearLogs = () => {
    clearLogs();
    setLogs([]);
    setUnreadCount(0);
  };

  const getLogIcon = (action: string) => {
    switch (action) {
      case 'create_folder': return <Folder className="w-3.5 h-3.5 text-emerald-500" />;
      case 'delete_folder': return <Trash2 className="w-3.5 h-3.5 text-amber-500" />;
      case 'restore_folder': return <Folder className="w-3.5 h-3.5 text-teal-500" />;
      case 'upload_image': return <ArrowRight className="w-3.5 h-3.5 text-blue-500" />;
      case 'delete_image': return <Trash2 className="w-3.5 h-3.5 text-rose-500" />;
      case 'restore_image': return <ArrowRight className="w-3.5 h-3.5 text-emerald-500" />;
      case 'capture_image_request': return <Eye className="w-3.5 h-3.5 text-purple-500" />;
      case 'approve_user': return <Check className="w-3.5 h-3.5 text-emerald-500 font-bold" />;
      case 'reject_user': return <X className="w-3.5 h-3.5 text-rose-500" />;
      case 'add_device': return <Laptop className="w-3.5 h-3.5 text-indigo-500" />;
      case 'remove_device': return <ShieldAlert className="w-3.5 h-3.5 text-red-500" />;
      default: return <Bell className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  const NavItem = ({ to, icon: Icon, label }: { to: string, icon: any, label: string }) => (
    <NavLink 
      to={to} 
      onClick={() => setSidebarOpen(false)}
      className={({ isActive }) => 
        cn("flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
        isActive ? "bg-indigo-600 text-white font-medium" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200")
      }
    >
      <Icon className="w-5 h-5 opacity-80" />
      {label}
    </NavLink>
  );

  const getInitials = () => {
    if (fullName) {
      const parts = fullName.trim().split(' ');
      if (parts.length > 1) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return fullName.substring(0, 2).toUpperCase();
    }
    return user.email ? user.email.substring(0, 2).toUpperCase() : 'U';
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col md:flex-row h-screen overflow-hidden relative">
      {/* Mobile backdrop for Sidebar */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 md:hidden" 
          onClick={() => setSidebarOpen(false)} 
        />
      )}

      {/* Responsive Sidebar Drawer */}
      <aside className={cn(
        "w-64 bg-slate-900 flex flex-col border-r border-slate-800 h-screen shrink-0 transition-transform duration-300 ease-in-out z-50",
        "fixed md:sticky top-0 left-0",
        sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-500 rounded flex items-center justify-center text-white font-bold">
              <Aperture className="w-5 h-5" />
            </div>
            <span className="text-white font-semibold tracking-tight text-lg">Archivio IoT</span>
          </div>
          {/* Close button for mobile menu */}
          <button 
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 md:hidden rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Close Menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="flex-1 px-4 space-y-1">
          <div className="text-slate-500 text-[10px] uppercase font-bold tracking-widest px-3 mb-2 mt-4">Menu</div>
          <div className="space-y-1">
            {role === 'user' && (
              <>
                <NavItem to="/dashboard" icon={Folder} label="Main Archives" />
                <NavItem to="/trash" icon={Trash2} label="Trash / Bin" />
              </>
            )}
            {role === 'admin' && (
              <NavItem to="/admin" icon={Users} label="Administration" />
            )}
            
            {/* Real-time notification logs toggle button */}
            <button 
              onClick={() => { setLogsOpen(!logsOpen); setUnreadCount(0); setSidebarOpen(false); }}
              className={cn(
                "flex w-full items-center justify-between px-3 py-2 rounded-md text-sm transition-colors text-left mt-1",
                logsOpen ? "bg-slate-800 text-slate-100 font-medium" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              )}
            >
              <span className="flex items-center gap-3">
                <History className="w-5 h-5 opacity-80" />
                System Logs
              </span>
              {unreadCount > 0 ? (
                <span className="bg-indigo-500 text-white font-bold rounded-full text-[10px] px-2 py-0.5 animate-pulse">
                  {unreadCount}
                </span>
              ) : (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              )}
            </button>
          </div>
        </nav>
        
        <div className="p-4 border-t border-slate-800 flex flex-col gap-2">
           <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs text-white uppercase">
              {getInitials()}
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-xs font-semibold text-slate-200 capitalize truncate">{fullName || `${role} User`}</span>
              <span className="text-[10px] text-slate-500 truncate">{user.email}</span>
            </div>
          </div>
          <button 
            onClick={() => { handleSignOut(); setSidebarOpen(false); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-md transition-colors mt-2"
          >
            <LogOut className="w-4 h-4 opacity-80" />
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        {/* Mobile Header Top Navigation */}
        <header className="flex md:hidden h-14 bg-slate-900 border-b border-slate-800 items-center justify-between px-4 text-white flex-shrink-0 z-30 select-none">
          <button 
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 text-slate-400 hover:text-white transition-colors"
            id="btn-mobile-sidebar-toggle"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-indigo-500 rounded flex items-center justify-center text-white">
              <Aperture className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold tracking-tight text-sm">Archivio IoT</span>
          </div>

          <button 
            onClick={() => { setLogsOpen(!logsOpen); setUnreadCount(0); }}
            className="p-2 -mr-2 text-slate-400 hover:text-white transition-colors relative"
            id="btn-mobile-logs-toggle"
          >
            <History className="w-5 h-5" />
            {unreadCount > 0 ? (
              <span className="absolute top-1 right-1 bg-indigo-500 text-white font-bold rounded-full text-[8px] w-4 h-4 flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            ) : (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            )}
          </button>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <Outlet />
          </div>

          {/* Real-time Notification Side Panel */}
          {logsOpen && (
            <>
              {/* Mobile backdrop for Logs */}
              <div 
                className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-35 md:hidden" 
                onClick={() => setLogsOpen(false)} 
              />
              <div className="w-80 max-w-[85vw] md:max-w-none border-l border-slate-200 bg-white flex flex-col h-screen md:h-full fixed md:relative right-0 top-0 z-40 shadow-xl md:shadow-none animate-in slide-in-from-right duration-200">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 select-none">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">System Live Logs</h3>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {logs.length > 0 && (
                      <button 
                        onClick={handleClearLogs}
                        title="Clear system notification logs"
                        className="p-1 rounded text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button 
                      onClick={() => setLogsOpen(false)}
                      className="p-1 md:hidden rounded text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                      title="Close panel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                  {logs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4">
                      <History className="w-8 h-8 text-slate-300 stroke-[1.5] mb-2" />
                      <p className="text-xs text-slate-400 font-medium">No system events logged</p>
                      <p className="text-[10px] text-slate-400 mt-1 max-w-[180px]">Actions like uploads, captures and deletes appear stream here.</p>
                    </div>
                  ) : (
                    logs.map((log) => {
                      const agoSeconds = Math.max(0, Math.floor((new Date().getTime() - new Date(log.timestamp).getTime()) / 1000));
                      let displayTime = 'Just now';
                      if (agoSeconds >= 3600) {
                        displayTime = `${Math.floor(agoSeconds / 3600)}h ago`;
                      } else if (agoSeconds >= 60) {
                        displayTime = `${Math.floor(agoSeconds / 60)}m ago`;
                      } else if (agoSeconds > 2) {
                        displayTime = `${agoSeconds}s ago`;
                      }

                      return (
                        <div key={log.id} className="flex gap-2.5 items-start text-xs border-b border-slate-100 pb-2.5 last:border-0 last:pb-0 animate-in fade-in slide-in-from-bottom-2 duration-200">
                          <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                            {getLogIcon(log.action)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-slate-700 leading-normal break-words font-medium">
                              {log.details}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-400 font-mono">
                              <span className="truncate max-w-[120px]" title={log.userEmail}>{log.userEmail.split('@')[0]}</span>
                              <span>•</span>
                              <span>{displayTime}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
