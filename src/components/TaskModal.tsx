import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Task, Section } from '../types';

interface Props {
  sections: Section[];
  initial?: Task;
  defaultSectionId?: string;
  onSave: (data: Omit<Task, 'id' | 'order'>) => void;
  onClose: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export function TaskModal({ sections, initial, defaultSectionId, onSave, onClose }: Props) {
  const [text, setText] = useState(initial?.text ?? '');
  const [sectionId, setSectionId] = useState(
    initial?.sectionId ?? defaultSectionId ?? sections[0]?.id ?? ''
  );
  const [start, setStart] = useState(initial?.start ?? today());
  const [end, setEnd] = useState(initial?.end ?? today());
  const [progress, setProgress] = useState(initial?.progress ?? 0);
  const [error, setError] = useState('');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) { setError('Task name is required.'); return; }
    if (!sectionId) { setError('Select a section.'); return; }
    if (start > end) { setError('Start must be on or before end.'); return; }
    onSave({ text: text.trim(), sectionId, start, end, progress });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">
            {initial ? 'Edit Task' : 'Add Task'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Task Name</label>
            <input
              autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter task name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
            >
              {sections.length === 0 && (
                <option value="">No sections — add one first</option>
              )}
              {sections.map((s) => (
                <option key={s.id} value={s.id}>{s.text}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Progress: {progress}%
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              {initial ? 'Save' : 'Add Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
