import { create } from 'zustand';
import type { Project, Section, Task } from '../types';

const today = () => new Date().toISOString().slice(0, 10);

localStorage.removeItem('gantt-app-storage');

function makeProject(name = 'My Project'): Project {
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: today(),
    updatedAt: today(),
  };
}

interface StoreState {
  project: Project;
  sections: Section[];
  tasks: Task[];

  setProjectName: (name: string) => void;

  addSection: (text: string) => void;
  updateSection: (id: string, text: string) => void;
  deleteSection: (id: string) => void;

  addTask: (task: Omit<Task, 'id' | 'order'>) => void;
  updateTask: (id: string, patch: Partial<Omit<Task, 'id'>>) => void;
  deleteTask: (id: string) => void;

  loadData: (data: { project: Project; sections: Section[]; tasks: Task[] }) => void;
  resetProject: () => Project;
}

export const useStore = create<StoreState>()((set) => ({
  project: makeProject(),
  sections: [],
  tasks: [],

  setProjectName: (name) =>
    set((s) => ({
      project: { ...s.project, name, updatedAt: today() },
    })),

  addSection: (text) =>
    set((s) => {
      const order = s.sections.length;
      return {
        sections: [...s.sections, { id: crypto.randomUUID(), text, order }],
        project: { ...s.project, updatedAt: today() },
      };
    }),

  updateSection: (id, text) =>
    set((s) => ({
      sections: s.sections.map((sec) => (sec.id === id ? { ...sec, text } : sec)),
      project: { ...s.project, updatedAt: today() },
    })),

  deleteSection: (id) =>
    set((s) => ({
      sections: s.sections.filter((sec) => sec.id !== id),
      tasks: s.tasks.filter((t) => t.sectionId !== id),
      project: { ...s.project, updatedAt: today() },
    })),

  addTask: (task) =>
    set((s) => {
      const sectionTasks = s.tasks.filter((t) => t.sectionId === task.sectionId);
      const order = sectionTasks.length;
      return {
        tasks: [...s.tasks, { ...task, id: crypto.randomUUID(), order }],
        project: { ...s.project, updatedAt: today() },
      };
    }),

  updateTask: (id, patch) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      project: { ...s.project, updatedAt: today() },
    })),

  deleteTask: (id) =>
    set((s) => ({
      tasks: s.tasks.filter((t) => t.id !== id),
      project: { ...s.project, updatedAt: today() },
    })),

  loadData: ({ project, sections, tasks }) =>
    set({ project, sections, tasks }),

  resetProject: () => {
    const project = makeProject();
    set({ project, sections: [], tasks: [] });
    return project;
  },
}));

export const selectSortedSections = (s: StoreState) =>
  [...s.sections].sort((a, b) => a.order - b.order);

export const selectTasksBySection = (sectionId: string) => (s: StoreState) =>
  [...s.tasks.filter((t) => t.sectionId === sectionId)].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );
