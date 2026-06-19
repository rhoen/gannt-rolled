import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Upload, Plus, FilePlus, Moon, Sun, FolderOpen } from 'lucide-react';
import { useStore } from '../store/useStore';
import type { AppData } from '../types';
import {
  getRecentProjectFiles,
  openProjectFile,
  openRecentProjectFile,
  saveProjectFile,
  supportsFileSystemAccess,
  type RecentProjectFile,
  writeRecentProjectFile,
} from '../utils/projectFiles';

interface Props {
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onAddSection: () => void;
  onAddTask: () => void;
}

export function Toolbar({ isDarkMode, onToggleDarkMode, onAddSection, onAddTask }: Props) {
  const { project, sections, tasks, setProjectName, loadData, resetProject } = useStore();
  const [editing, setEditing] = useState(false);
  const [nameVal, setNameVal] = useState(project.name);
  const [recentFiles, setRecentFiles] = useState<RecentProjectFile[]>([]);
  const [recentId, setRecentId] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const canUseFileSystem = supportsFileSystemAccess();

  const refreshRecentFiles = useCallback(async () => {
    setRecentFiles(await getRecentProjectFiles());
  }, []);

  useEffect(() => {
    if (!canUseFileSystem) return;
    void getRecentProjectFiles().then(setRecentFiles);
  }, [canUseFileSystem]);

  useEffect(() => {
    if (!canUseFileSystem || !recentId) return;

    const timeout = window.setTimeout(() => {
      const data: AppData = { version: '1.0', project, sections, tasks };
      void writeRecentProjectFile(recentId, data)
        .then((recent) => {
          setRecentId(recent.id);
          return refreshRecentFiles();
        })
        .catch((error) => {
          alert(error instanceof Error ? error.message : 'Could not update project file.');
          setRecentId('');
        });
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [canUseFileSystem, project, recentId, refreshRecentFiles, sections, tasks]);

  function commitName() {
    setEditing(false);
    const trimmed = nameVal.trim();
    if (trimmed && trimmed !== project.name) setProjectName(trimmed);
    else setNameVal(project.name);
  }

  async function handleDownload() {
    const data: AppData = { version: '1.0', project, sections, tasks };
    if (canUseFileSystem) {
      try {
        const recent = recentId
          ? await writeRecentProjectFile(recentId, data)
          : await saveProjectFile(data);
        setRecentId(recent.id);
        await refreshRecentFiles();
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        alert(error instanceof Error ? error.message : 'Could not save project file.');
        return;
      }
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, '_')}_tasks.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleOpenFile() {
    if (!canUseFileSystem) {
      fileRef.current?.click();
      return;
    }

    try {
      const { data, recent } = await openProjectFile();
      loadData({ project: data.project, sections: data.sections, tasks: data.tasks });
      setNameVal(data.project.name);
      setRecentId(recent.id);
      await refreshRecentFiles();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      alert(error instanceof Error ? error.message : 'Could not open project file.');
    }
  }

  async function handleRecentChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    if (!id) return;

    try {
      const data = await openRecentProjectFile(id);
      loadData({ project: data.project, sections: data.sections, tasks: data.tasks });
      setNameVal(data.project.name);
      setRecentId(id);
      await refreshRecentFiles();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Could not open recent project file.');
    }
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as AppData;
        if (!data.project || !Array.isArray(data.sections) || !Array.isArray(data.tasks)) {
          alert('Invalid file format.');
          return;
        }
        loadData({ project: data.project, sections: data.sections, tasks: data.tasks });
        setNameVal(data.project.name);
      } catch {
        alert('Could not parse file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function handleNewProject() {
    const newProject = resetProject();
    setNameVal(newProject.name);
    setRecentId('');

    if (!canUseFileSystem) return;

    try {
      const data: AppData = { version: '1.0', project: newProject, sections: [], tasks: [] };
      const recent = await saveProjectFile(data);
      setRecentId(recent.id);
      await refreshRecentFiles();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      alert(error instanceof Error ? error.message : 'Could not save new project file.');
    }
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200 shrink-0 dark:bg-gray-900 dark:border-gray-700">
      {editing ? (
        <input
          autoFocus
          className="text-lg font-semibold text-gray-900 border-b-2 border-blue-500 outline-none bg-transparent min-w-0 flex-1 max-w-xs dark:text-gray-100"
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
          className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors cursor-pointer border-b-2 border-transparent hover:border-blue-300 dark:text-gray-100 dark:hover:text-blue-400"
          onClick={() => { setEditing(true); setNameVal(project.name); }}
          title="Click to rename project"
        >
          {project.name}
        </button>
      )}

      <div className="flex-1" />

      <button
        onClick={onAddSection}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors dark:text-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
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

      <div className="w-px h-6 bg-gray-200 mx-1 dark:bg-gray-700" />

      <button
        onClick={onToggleDarkMode}
        className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors dark:text-gray-300 dark:hover:bg-gray-800"
        title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
      </button>

      <button
        onClick={handleDownload}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors dark:text-gray-300 dark:hover:bg-gray-800"
        title={canUseFileSystem ? 'Save project file' : 'Download JSON'}
      >
        <Download size={15} />
        Save
      </button>
      <button
        onClick={handleOpenFile}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors dark:text-gray-300 dark:hover:bg-gray-800"
        title={canUseFileSystem ? 'Open project file' : 'Upload JSON'}
      >
        {canUseFileSystem ? <FolderOpen size={15} /> : <Upload size={15} />}
        Open
      </button>
      {canUseFileSystem && (
        <select
          value={recentId}
          onChange={handleRecentChange}
          className="max-w-56 px-2 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg outline-none hover:bg-gray-50 focus:border-blue-500 disabled:text-gray-400 dark:text-gray-300 dark:bg-gray-900 dark:border-gray-700 dark:hover:bg-gray-800"
          title="Open a saved project"
          disabled={recentFiles.length === 0}
        >
          <option value="">Recent projects</option>
          {recentFiles.map((file) => (
            <option key={file.id} value={file.id}>
              {file.name} ({file.fileName})
            </option>
          ))}
        </select>
      )}
      <button
        onClick={handleNewProject}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors dark:text-gray-300 dark:hover:bg-gray-800"
        title="New project"
      >
        <FilePlus size={15} />
        New
      </button>

      <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleUpload} />
    </div>
  );
}
