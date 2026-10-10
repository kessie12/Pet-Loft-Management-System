import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

export const ShopEntryModal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog ref={dialog} aria-labelledby={titleId} onCancel={onClose}
      className="m-auto w-[calc(100%-2rem)] max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 bg-white text-slate-900 shadow-2xl backdrop:bg-black/60">
      <div className="flex justify-between items-center gap-4 mb-5">
        <h2 id={titleId} className="text-xl font-black">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Close form" className="p-2 rounded-lg hover:bg-slate-100 cursor-pointer"><X className="w-5 h-5" /></button>
      </div>
      {children}
    </dialog>
  );
};

