export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Section {
  id: string;
  text: string;
  order: number;
}

export interface Task {
  id: string;
  sectionId: string;
  text: string;
  start: string;
  end: string;
  progress: number;
  order: number;
}

export interface AppData {
  version: '1.0';
  project: Project;
  sections: Section[];
  tasks: Task[];
}

export type ZoomLevel = 'Day' | 'Week' | 'Month' | 'Quarter';
export type ViewTab = 'Table' | 'Gantt';
export type SortMode = 'Grouped' | 'Flat';
