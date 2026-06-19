import { useEffect, useState } from 'react';
import { Toolbar } from './components/Toolbar';
import { TableView } from './components/TableView';
import { GanttView } from './components/GanttView';
import { TaskModal } from './components/TaskModal';
import { SectionModal } from './components/SectionModal';
import { useStore } from './store/useStore';
import type { Task, Section, ViewTab } from './types';

export default function App() {
  const { sections, addTask, updateTask, addSection, updateSection } = useStore();
  const [tab, setTab] = useState<ViewTab>('Table');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('gantt-theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [taskModal, setTaskModal] = useState<{
    open: boolean;
    editing?: Task;
  }>({ open: false });

  const [sectionModal, setSectionModal] = useState<{
    open: boolean;
    editing?: Section;
  }>({ open: false });

  function handleSaveTask(data: Omit<Task, 'id' | 'order'>) {
    if (taskModal.editing) {
      updateTask(taskModal.editing.id, data);
    } else {
      addTask(data);
    }
  }

  function handleSaveSection(text: string) {
    if (sectionModal.editing) {
      updateSection(sectionModal.editing.id, text);
    } else {
      addSection(text);
    }
  }

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('gantt-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      <Toolbar
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode((value) => !value)}
        onAddSection={() => setSectionModal({ open: true })}
        onAddTask={() => setTaskModal({ open: true })}
      />

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 bg-white shrink-0 px-4 dark:border-gray-700 dark:bg-gray-900">
        {(['Table', 'Gantt'] as ViewTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* View area */}
      <div className="flex-1 overflow-hidden">
        {tab === 'Table' ? (
          <TableView
            onEditTask={(task) => setTaskModal({ open: true, editing: task })}
            onEditSection={(section) => setSectionModal({ open: true, editing: section })}
          />
        ) : (
          <GanttView />
        )}
      </div>

      {taskModal.open && (
        <TaskModal
          sections={sections}
          initial={taskModal.editing}
          onSave={handleSaveTask}
          onClose={() => setTaskModal({ open: false })}
        />
      )}

      {sectionModal.open && (
        <SectionModal
          initial={sectionModal.editing}
          onSave={handleSaveSection}
          onClose={() => setSectionModal({ open: false })}
        />
      )}
    </div>
  );
}
