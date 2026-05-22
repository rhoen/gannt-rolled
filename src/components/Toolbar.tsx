import React, { useRef, useState } from 'react';
import { Download, Upload, Plus, FilePlus } from 'lucide-react';
import { useStore } from '../store/useStore';
import type { AppData } from '../types';

interface Props {
  onAddSection: () => void;
  onAddTask: () => void;
}

export function Toolbar({ onAddSection, onAddTask }: Props) {
  const { project, sections, tasks, setProjectName, loadData, resetProject } = useStore();
  const [editing, setEditing] = useState(false);
  const [nameVal, setNameVal] = useState(project.name);
  const fileRef = useRef<HTMLInputElement>(null);

  function commitName() {
    setEditing(false);
    const trimmed = nameVal.trim();
    if (trimmed && trimmed !== project.name) setProjectName(trimmed);
    else setNameVal(project.name);
  }

  function handleDownload() {
    const data: AppData = { version: '1.0', project, sections, tasks };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, '_')}_tasks.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const hasTasks = tasks.length > 0 || sections.length > 0;
    if (hasTasks && !confirm('This will replace your current project. Continue?')) {
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as AppData;
        if (!data.project || !Array.isArray(data.sections) || !Array.isArray(data.tasks)) {
          alert('Invalid file format.');
          return;
        }
        loadData({ project: data.project, sections: data.sections, tasks: data.tasks });
      } catch {
        alert('Could not parse file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleNewProject() {
    const hasTasks = tasks.length > 0 || sections.length > 0;
    if (hasTasks && !confirm('This will clear the current project. Continue?')) return;
    resetProject();
    setNameVal('My Project');
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200 shrink-0">
      {editing ? (
        <input
          autoFocus
          className="text-lg font-semibold text-gray-900 border-b-2 border-blue-500 outline-none bg-transparent min-w-0 flex-1 max-w-xs"
          value={nameVal}
          onChange={(e) => setNameVal(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitName();
            if (e.key === 'Escape') { setEditing(false); setNameVal(project.name); }
          }}
        />
      ) : (
        <button
          className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors cursor-pointer border-b-2 border-transparent hover:border-blue-300"
          onClick={() => { setEditing(true); setNameVal(project.name); }}
          title="Click to rename project"
        >
          {project.name}
        </button>
      )}

      <div className="flex-1" />

      <button
        onClick={onAddSection}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
      >
        <Plus size={15} />
        Add Section
      </button>
      <button
        onClick={onAddTask}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
      >
        <Plus size={15} />
        Add Task
      </button>

      <div className="w-px h-6 bg-gray-200 mx-1" />

      <button
        onClick={handleDownload}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        title="Download JSON"
      >
        <Download size={15} />
        Download
      </button>
      <button
        onClick={() => fileRef.current?.click()}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        title="Upload JSON"
      >
        <Upload size={15} />
        Upload
      </button>
      <button
        onClick={handleNewProject}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        title="New project"
      >
        <FilePlus size={15} />
        New
      </button>

      <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleUpload} />
    </div>
  );
}
