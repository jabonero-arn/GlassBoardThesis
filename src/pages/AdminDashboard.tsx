import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Check, X, Trash2, Plus, MonitorSmartphone } from 'lucide-react';
import { logActivity } from '../lib/logger';
import ConfirmModal from '../components/ConfirmModal';

export default function AdminDashboard() {
  const [users, setUsers] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [adminUser, setAdminUser] = useState<any>(null);
  const [removeDeviceId, setRemoveDeviceId] = useState<string | null>(null);

  const fetchAdminData = async () => {
    try {
      const { data: usersData, error: usersErr } = await supabase.from('users').select('*');
      if (usersData && !usersErr) {
        setUsers(usersData);
      } else if (usersErr) {
        console.error("Error users query:", usersErr);
      }

      const { data: devicesData, error: devicesErr } = await supabase.from('devices').select('*');
      if (devicesData && !devicesErr) {
        setDevices(devicesData);
      } else if (devicesErr) {
        console.error("Error devices query:", devicesErr);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setAdminUser(user);
    });

    fetchAdminData();

    const usersChannel = supabase.channel('admin-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        fetchAdminData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, () => {
        fetchAdminData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(usersChannel);
    };
  }, []);

  const handleApprove = async (userId: string) => {
    const target = users.find(u => u.id === userId);
    const { error } = await supabase.from('users').update({ status: 'approved', updatedAt: new Date().toISOString() }).eq('id', userId);
    if (!error) {
      if (adminUser) {
        logActivity(adminUser.id, adminUser.email || 'admin', 'approve_user', `Approved user registration for '${target?.fullName || target?.email || 'Anonymous user'}'`);
      }
      fetchAdminData();
    }
  };

  const handleReject = async (userId: string) => {
    const target = users.find(u => u.id === userId);
    const { error } = await supabase.from('users').update({ status: 'rejected', updatedAt: new Date().toISOString() }).eq('id', userId);
    if (!error) {
      if (adminUser) {
        logActivity(adminUser.id, adminUser.email || 'admin', 'reject_user', `Rejected user registration for '${target?.fullName || target?.email || 'Anonymous user'}'`);
      }
      fetchAdminData();
    }
  };

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeviceName.trim()) return;
    const { error } = await supabase.from('devices').insert({
      name: newDeviceName.trim(),
      status: 'online',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    if (!error) {
      if (adminUser) {
        logActivity(adminUser.id, adminUser.email || 'admin', 'add_device', `Registered new physical IoT device '${newDeviceName.trim()}'`);
      }
      setNewDeviceName('');
      fetchAdminData();
    }
  };

  const handleRemoveDeviceClick = (deviceId: string) => {
    setRemoveDeviceId(deviceId);
  };

  const handleConfirmRemoveDevice = async () => {
    if (!removeDeviceId) return;
    const target = devices.find(d => d.id === removeDeviceId);
    const { error } = await supabase.from('devices').delete().eq('id', removeDeviceId);
    if (!error) {
      if (adminUser) {
        logActivity(adminUser.id, adminUser.email || 'admin', 'remove_device', `Deregistered physical IoT device '${target?.name || 'Device'}'`);
      }
      fetchAdminData();
    }
    setRemoveDeviceId(null);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span>Administration</span>
            <span>/</span>
            <span className="text-slate-900 font-medium">Dashboard</span>
          </div>
        </div>
      </header>

      <div className="flex-1 p-8 overflow-auto">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          
          {/* User Management */}
          <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 flex flex-col">
            <div className="mb-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pending Approvals</h3>
              <p className="text-[10px] text-slate-500 mt-1">Review account access requests</p>
            </div>
            <div className="space-y-3 overflow-y-auto max-h-[500px]">
              {users.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-sm">No users found</div>
              ) : users.map(user => (
                <div key={user.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-800">{user.email}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider mt-0.5 ${user.status === 'pending' ? 'text-amber-500' : user.status === 'approved' ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {user.status}
                    </span>
                  </div>
                  {user.status === 'pending' && (
                    <div className="flex gap-1">
                      <button onClick={() => handleApprove(user.id)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors" title="Approve">
                        <Check className="w-5 h-5" />
                      </button>
                      <button onClick={() => handleReject(user.id)} className="p-1 text-rose-600 hover:bg-rose-50 rounded transition-colors" title="Reject">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Device Management */}
          <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 flex flex-col">
            <div className="mb-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Hardware Devices</h3>
              <p className="text-[10px] text-slate-500 mt-1">Manage connected Raspberry Pi cameras</p>
            </div>
            
            <div className="mb-4">
              <form onSubmit={handleAddDevice} className="flex gap-2">
                <input 
                  type="text" 
                  value={newDeviceName}
                  onChange={e => setNewDeviceName(e.target.value)}
                  placeholder="e.g. LED Glass Board 1" 
                  className="flex-1 text-sm px-3 py-1.5 border border-slate-200 rounded bg-slate-50 text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400"
                />
                <button disabled={!newDeviceName.trim()} type="submit" className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-bold shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </button>
              </form>
            </div>

            <div className="space-y-3 overflow-y-auto flex-1 h-[400px]">
               {devices.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-sm">No devices connected</div>
              ) : devices.map(device => (
                <div key={device.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 group">
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg ${device.status === 'online' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>
                      <MonitorSmartphone className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-800">{device.name}</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-slate-500 capitalize">{device.status}</span>
                        <span className="text-[10px] text-slate-300">•</span>
                        <span className="font-mono bg-slate-200/50 text-slate-600 px-1 py-0.2 rounded text-[9px] select-all cursor-pointer" title="Double click to copy Device UUID ID">
                          {device.id}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleRemoveDeviceClick(device.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                    title="Remove Device"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>

        </div>
      </div>

      <ConfirmModal 
        isOpen={removeDeviceId !== null}
        title="Deregister Hardware Device"
        message="Are you sure you want to remove this Raspberry Pi device from the system? Users will no longer be able to select it for triggered captures."
        confirmLabel="Remove Device"
        cancelLabel="Keep Device"
        isDestructive={true}
        onConfirm={handleConfirmRemoveDevice}
        onCancel={() => setRemoveDeviceId(null)}
      />
    </div>
  );
}
