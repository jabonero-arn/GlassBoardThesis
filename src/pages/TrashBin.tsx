import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Folder as FolderIcon, Image as ImageIcon, RotateCcw, Trash2 } from 'lucide-react';
import { logActivity } from '../lib/logger';
import ConfirmModal from '../components/ConfirmModal';

export default function TrashBin({ user }: { user: User }) {
  const [deletedFolders, setDeletedFolders] = useState<any[]>([]);
  const [deletedImages, setDeletedImages] = useState<any[]>([]);
  const [deleteFolderForeverId, setDeleteFolderForeverId] = useState<string | null>(null);
  const [deleteImageForeverId, setDeleteImageForeverId] = useState<string | null>(null);

  const fetchDeleted = async () => {
    try {
      const { data: fData, error: fError } = await supabase
        .from('folders')
        .select('*')
        .eq('userId', user.id)
        .eq('isDeleted', true);

      if (fData && !fError) {
        setDeletedFolders(fData);
      }

      const { data: iData, error: iError } = await supabase
        .from('images')
        .select('*')
        .eq('userId', user.id)
        .eq('isDeleted', true);

      if (iData && !iError) {
        setDeletedImages(iData);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDeleted();

    const channel = supabase.channel('trash-sync')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        fetchDeleted();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id]);

  const restoreFolder = async (id: string) => {
    const target = deletedFolders.find(f => f.id === id);
    const { error } = await supabase.from('folders')
      .update({ isDeleted: false, updatedAt: new Date().toISOString() })
      .eq('id', id);
    if (!error) {
      logActivity(user.id, user.email || 'user', 'restore_folder', `Restored folder '${target?.name || 'Archive'}' from trash`);
      fetchDeleted();
    }
  };
  
  const restoreImage = async (id: string) => {
    const { error } = await supabase.from('images')
      .update({ isDeleted: false, updatedAt: new Date().toISOString() })
      .eq('id', id);
    if (!error) {
      logActivity(user.id, user.email || 'user', 'restore_image', `Restored an archived image from trash`);
      fetchDeleted();
    }
  };

  const deleteFolderForeverClick = (id: string) => {
    setDeleteFolderForeverId(id);
  };

  const handleConfirmDeleteFolderForever = async () => {
    if (!deleteFolderForeverId) return;
    const target = deletedFolders.find(f => f.id === deleteFolderForeverId);
    const { error } = await supabase.from('folders').delete().eq('id', deleteFolderForeverId);
    if (!error) {
      logActivity(user.id, user.email || 'user', 'delete_folder', `Permanently deleted folder '${target?.name || 'Archive'}' from database`);
      fetchDeleted();
    }
    setDeleteFolderForeverId(null);
  };

  const deleteImageForeverClick = (id: string) => {
    setDeleteImageForeverId(id);
  };

  const handleConfirmDeleteImageForever = async () => {
    if (!deleteImageForeverId) return;
    const itemToDelete = deletedImages.find(img => img.id === deleteImageForeverId);
    if (itemToDelete?.imageUrl) {
      try {
        const urlParts = itemToDelete.imageUrl.split('/storage/v1/object/public/glassboard/');
        if (urlParts.length > 1) {
          const storagePath = decodeURIComponent(urlParts[1]);
          await supabase.storage.from('glassboard').remove([storagePath]);
        }
      } catch (err) {
        console.error("Storage clean up failed", err);
      }
    }
    const { error } = await supabase.from('images').delete().eq('id', deleteImageForeverId);
    if (!error) {
      logActivity(user.id, user.email || 'user', 'delete_image', `Permanently purged archived image from cloud storage`);
      fetchDeleted();
    }
    setDeleteImageForeverId(null);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span>Archives</span>
            <span>/</span>
            <span className="text-slate-900 font-medium">Trash Bin</span>
          </div>
        </div>
      </header>

      <div className="flex-1 p-8 overflow-auto space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Deleted Items</h2>
        </div>

        {deletedFolders.length === 0 && deletedImages.length === 0 && (
           <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
             <Trash2 className="w-8 h-8 text-slate-300 mx-auto mb-3" />
             <p className="text-slate-500 text-sm">Trash is empty.</p>
           </div>
        )}

        {deletedFolders.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-slate-900 mb-4 tracking-tight">Folders</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {deletedFolders.map(folder => (
                <div key={folder.id} className="bg-white border border-slate-200 opacity-75 hover:opacity-100 rounded-lg p-4 flex items-center justify-between shadow-sm transition-opacity">
                  <div className="flex items-center gap-3">
                    <FolderIcon className="w-5 h-5 text-indigo-400" />
                    <span className="font-medium text-sm text-slate-700 truncate">{folder.name}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                    <button onClick={() => restoreFolder(folder.id)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer" title="Restore">
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteFolderForeverClick(folder.id)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer" title="Delete Forever">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {deletedImages.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-slate-900 mb-4 tracking-tight">Images</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {deletedImages.map(img => (
                <div key={img.id} className="group relative aspect-square bg-slate-200 rounded-lg overflow-hidden border border-slate-200 opacity-80 hover:opacity-100 transition-opacity">
                  {img.imageUrl ? (
                    <img src={img.imageUrl} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                      <ImageIcon className="w-8 h-8 opacity-20 mb-1" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-indigo-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button onClick={() => restoreImage(img.id)} className="p-1.5 bg-white rounded-full text-indigo-600 shadow-lg cursor-pointer animate-scale-in" title="Restore">
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteImageForeverClick(img.id)} className="p-1.5 bg-white rounded-full text-rose-600 shadow-lg cursor-pointer animate-scale-in" title="Delete Forever">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Permanent Folder Delete Confirmation */}
      <ConfirmModal 
        isOpen={deleteFolderForeverId !== null}
        title="Permanently Delete Folder"
        message="Are you sure you want to permanently delete this folder from the database? This action is IRREVERSIBLE. Images linked to this folder will remain in storage but will lose their folder association."
        confirmLabel="Delete Forever"
        cancelLabel="Keep in Trash"
        isDestructive={true}
        onConfirm={handleConfirmDeleteFolderForever}
        onCancel={() => setDeleteFolderForeverId(null)}
      />

      {/* Permanent Image Delete Confirmation */}
      <ConfirmModal 
        isOpen={deleteImageForeverId !== null}
        title="Permanently Delete Image"
        message="Are you sure you want to permanently delete this archived capture from both your database and Cloud Storage? This action is completely IRREVERSIBLE and cannot be undone."
        confirmLabel="Purge Forever"
        cancelLabel="Keep in Trash"
        isDestructive={true}
        onConfirm={handleConfirmDeleteImageForever}
        onCancel={() => setDeleteImageForeverId(null)}
      />
    </div>
  );
}
