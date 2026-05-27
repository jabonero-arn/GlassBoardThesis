import { supabase } from './supabase';

export interface ActivityLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  details: string;
  timestamp: string;
}

// Write to custom event + local state + database if table exists
export async function logActivity(userId: string, userEmail: string, action: string, details: string) {
  const newLog: ActivityLog = {
    id: Math.random().toString(36).substring(2, 9),
    userId,
    userEmail,
    action,
    details,
    timestamp: new Date().toISOString()
  };

  // 1. Try to record in Supabase table
  try {
    const { error } = await supabase.from('activity_logs').insert({
      id: newLog.id,
      userId: newLog.userId,
      userEmail: newLog.userEmail,
      action: newLog.action,
      details: newLog.details,
      timestamp: newLog.timestamp,
      createdAt: newLog.timestamp // standard columns
    });
    
    if (error) {
      console.warn("Supabase activity log write skipped (database table might not exist yet):", error.message);
    }
  } catch (err) {
    console.warn("Remote action log skipped:", err);
  }

  // 2. Fallback / supplementary local log stream for robust local display
  try {
    const localLogsStr = localStorage.getItem('glassboard_activity_logs') || '[]';
    const localLogs: ActivityLog[] = JSON.parse(localLogsStr);
    
    // Add to front of log array and keep last 200 logs
    localLogs.unshift(newLog);
    if (localLogs.length > 200) {
      localLogs.pop();
    }
    
    localStorage.setItem('glassboard_activity_logs', JSON.stringify(localLogs));

    // Dispatch global custom event for reactive UI updates
    window.dispatchEvent(new CustomEvent('activity_logged', { detail: newLog }));
  } catch (err) {
    console.error("Local log write failed:", err);
  }

  return newLog;
}

// Read merged lists of activities
export async function getActivities(userId?: string): Promise<ActivityLog[]> {
  // Try remote first
  try {
    let query = supabase.from('activity_logs').select('*').order('timestamp', { ascending: false }).limit(60);
    if (userId) {
      query = query.eq('userId', userId);
    }
    const { data, error } = await query;
    if (data && !error && data.length > 0) {
      return data.map((d: any) => ({
        id: d.id,
        userId: d.userId,
        userEmail: d.userEmail,
        action: d.action,
        details: d.details,
        timestamp: d.timestamp || d.createdAt || new Date().toISOString()
      }));
    }
  } catch (e) {
    console.warn("Could not query activity_logs table:", e);
  }

  // Fallback to local storage (or if database not setup yet)
  try {
    const localLogsStr = localStorage.getItem('glassboard_activity_logs') || '[]';
    let logs: ActivityLog[] = JSON.parse(localLogsStr);
    if (userId) {
      logs = logs.filter(log => log.userId === userId);
    }
    return logs;
  } catch (err) {
    console.error("Read local logs error:", err);
    return [];
  }
}

export function clearLogs() {
  try {
    localStorage.removeItem('glassboard_activity_logs');
    window.dispatchEvent(new CustomEvent('activity_logged'));
  } catch (e) {
    console.error(e);
  }
}
