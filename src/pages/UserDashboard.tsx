import React, { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Folder as FolderIcon, Plus, MoreVertical, Trash2, Search, X } from 'lucide-react';
import { logActivity } from '../lib/logger';
import ConfirmModal from '../components/ConfirmModal';

interface Props { user: User }

export default function UserDashboard({ user }: Props) {
  const navigate = useNavigate();
  const [folders, setFolders] = useState<any[]>([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);

  const fetchFolders = async () => {
    try {
      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .eq('userId', user.id)
        .eq('isDeleted', false);

      if (error) {
        console.error("Error fetching folders:", error);
      } else if (data) {
        const sorted = [...data].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setFolders(sorted);
      }
    } catch (err) {
      console.error("Query exception:", err);
    }
  };

  useEffect(() => {
    fetchFolders();

    const folderChannel = supabase.channel('folders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'folders' }, () => {
        fetchFolders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(folderChannel);
    };
  }, [user.id]);

  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    
    const { error } = await supabase.from('folders').insert({
      name: newFolderName.trim(),
      userId: user.id,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    if (error) {
      alert("Error creating folder: " + error.message);
    } else {
      // Log notification activity
      logActivity(user.id, user.email || 'user', 'create_folder', `Created folder '${newFolderName.trim()}'`);
      setNewFolderName('');
      setIsCreateModalOpen(false);
      fetchFolders();
    }
  };

  const handleDeleteFolderClick = (e: React.MouseEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteFolderId(folderId);
  };

  const handleConfirmDeleteFolder = async () => {
    if (!deleteFolderId) return;
    const targetFolder = folders.find(f => f.id === deleteFolderId);
    const { error } = await supabase
      .from('folders')
      .update({ isDeleted: true, updatedAt: new Date().toISOString() })
      .eq('id', deleteFolderId);
      
    if (error) {
      alert("Error deleting folder: " + error.message);
    } else {
      // Log notification activity
      logActivity(user.id, user.email || 'user', 'delete_folder', `Moved folder '${targetFolder?.name || 'Unknown'}' to trash`);
      fetchFolders();
    }
    setDeleteFolderId(null);
  };

  const filteredFolders = folders.filter(folder => 
    folder.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span>Archives</span>
            <span>/</span>
            <span className="text-slate-900 font-medium">Main</span>
          </div>
        </div>
      </header>
      
      <div className="flex-1 p-4 sm:p-8 overflow-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-800 animate-fade-in">Archive Contents</h2>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Search Input replaces New Folder Name in main list view */}
            <div className="relative flex-1 sm:w-64">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input 
                type="text" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search folders..." 
                className="w-full text-sm bg-white pl-9 pr-9 py-1.5 border border-slate-200 rounded text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400 shadow-xs"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button 
              onClick={() => {
                setNewFolderName('');
                setIsCreateModalOpen(true);
              }} 
              className="px-3.5 py-1.5 bg-indigo-600 rounded text-xs font-semibold text-white hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-xs shrink-0"
              id="btn-new-folder"
            >
              <Plus className="w-4 h-4" /> New Folder
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredFolders.map(folder => (
            <div 
              key={folder.id} 
              onClick={() => navigate(`/dashboard/folder/${folder.id}`)} 
              className="group block p-4 bg-white border border-slate-200 rounded-lg flex flex-col gap-3 shadow-sm hover:border-indigo-300 transition-colors cursor-pointer text-left h-full"
            >
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded flex items-center justify-center">
                  <FolderIcon className="w-6 h-6" />
                </div>
                <button 
                  onClick={(e) => handleDeleteFolderClick(e, folder.id)}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-rose-50 rounded-md transition-all opacity-80 sm:opacity-0 group-hover:opacity-100 cursor-pointer"
                  title="Move to Trash"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900 group-hover:text-indigo-600 truncate">{folder.name}</div>
                <div className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter mt-1">
                  {folder.createdAt ? new Date(folder.createdAt).toLocaleDateString() : 'Just now'}
                </div>
              </div>
            </div>
          ))}
          {filteredFolders.length === 0 && (
            <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
              <p className="text-slate-500 text-sm">
                {searchQuery ? `No folders match "${searchQuery}"` : "No folders created yet."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Confirm Folder Delete Modal */}
      <ConfirmModal 
        isOpen={deleteFolderId !== null}
        title="Move Folder to Trash"
        message="Are you sure you want to move this folder to the trash? All archived captures inside will remain inside the folder, but the folder will be hidden from this main list view."
        confirmLabel="Move to Trash"
        cancelLabel="Keep Folder"
        isDestructive={true}
        onConfirm={handleConfirmDeleteFolder}
        onCancel={() => setDeleteFolderId(null)}
      />

      {/* Create Folder Modal Popup Overlay */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all animate-fade-in">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 w-full max-w-sm mx-auto flex flex-col gap-4 animate-scale-in">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Create New Folder</h3>
                <p className="text-xs text-slate-500 mt-1">Organize your captures with a new archive folder.</p>
              </div>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleCreateFolderSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Folder Name</label>
                <input 
                  type="text" 
                  autoFocus
                  required
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  placeholder="e.g. Science Labs, Ledger Pages" 
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-slate-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 rounded text-xs font-semibold text-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={!newFolderName.trim()}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 rounded text-xs font-semibold transition-colors shadow-xs"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
