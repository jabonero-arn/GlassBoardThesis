import React from 'react';
import { ShieldAlert, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = true,
  onConfirm,
  onCancel
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex gap-4 items-start">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isDestructive ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600'}`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-slate-900 pr-6 relative">
                {title}
                <button 
                  onClick={onCancel}
                  className="absolute right-0 top-0 text-slate-400 hover:text-slate-600 p-0.5 rounded-md transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                {message}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 mt-6 pt-4 border-t border-slate-100 font-sans">
            <button
              type="button"
              onClick={onCancel}
              className="px-3.5 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 rounded text-xs font-semibold text-slate-600 transition-colors cursor-pointer"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={`px-3.5 py-1.5 rounded text-xs font-semibold text-white transition-colors shadow-xs cursor-pointer ${isDestructive ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
