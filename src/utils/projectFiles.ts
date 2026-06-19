import type { AppData } from '../types';

const DB_NAME = 'gantt-project-files';
const DB_VERSION = 1;
const STORE_NAME = 'recent-projects';

export interface RecentProjectFile {
  id: string;
  name: string;
  fileName: string;
  updatedAt: string;
}

interface RecentProjectFileRecord extends RecentProjectFile {
  handle: FileSystemFileHandle;
}

interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: FilePickerAcceptType[];
}

interface OpenFilePickerOptions {
  multiple?: boolean;
  types?: FilePickerAcceptType[];
}

interface PermissionedFileSystemFileHandle extends FileSystemFileHandle {
  requestPermission: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
}

declare global {
  interface Window {
    showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
    showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>;
  }
}

const filePickerTypes = [
  {
    description: 'Gantt project JSON',
    accept: { 'application/json': ['.json'] },
  },
];

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | undefined> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = callback(store);
    let result: T | undefined;

    if (request) {
      request.onsuccess = () => {
        result = request.result;
      };
      request.onerror = () => reject(request.error);
    }

    transaction.oncomplete = () => {
      db.close();
      resolve(result);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

export function supportsFileSystemAccess() {
  return Boolean(window.showSaveFilePicker && window.showOpenFilePicker && window.indexedDB);
}

export async function getRecentProjectFiles(): Promise<RecentProjectFile[]> {
  const records = await withStore<RecentProjectFileRecord[]>('readonly', (store) => store.getAll());
  return (records ?? [])
    .map(({ id, name, fileName, updatedAt }) => ({ id, name, fileName, updatedAt }))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function saveProjectFile(data: AppData): Promise<RecentProjectFile> {
  if (!window.showSaveFilePicker) {
    throw new Error('File System Access API is not available in this browser.');
  }

  const handle = await window.showSaveFilePicker({
    suggestedName: `${data.project.name.replace(/\s+/g, '_')}_tasks.json`,
    types: filePickerTypes,
  });

  await writeProjectToHandle(handle, data);
  return rememberProjectFile(handle, data.project.name);
}

export async function openProjectFile(): Promise<{ data: AppData; recent: RecentProjectFile }> {
  if (!window.showOpenFilePicker) {
    throw new Error('File System Access API is not available in this browser.');
  }

  const [handle] = await window.showOpenFilePicker({
    multiple: false,
    types: filePickerTypes,
  });
  const data = await readProjectFromHandle(handle);
  const recent = await rememberProjectFile(handle, data.project.name);

  return { data, recent };
}

export async function openRecentProjectFile(id: string): Promise<AppData> {
  const record = await withStore<RecentProjectFileRecord>('readonly', (store) => store.get(id));
  if (!record) throw new Error('That saved project is no longer in the recent project list.');

  const permission = await (record.handle as PermissionedFileSystemFileHandle).requestPermission({
    mode: 'readwrite',
  });
  if (permission !== 'granted') {
    throw new Error('Permission was not granted for that project file.');
  }

  return readProjectFromHandle(record.handle);
}

export async function writeRecentProjectFile(id: string, data: AppData): Promise<RecentProjectFile> {
  const record = await withStore<RecentProjectFileRecord>('readonly', (store) => store.get(id));
  if (!record) throw new Error('That saved project is no longer in the recent project list.');

  const permission = await (record.handle as PermissionedFileSystemFileHandle).requestPermission({
    mode: 'readwrite',
  });
  if (permission !== 'granted') {
    throw new Error('Permission was not granted for that project file.');
  }

  await writeProjectToHandle(record.handle, data);
  return rememberProjectFile(record.handle, data.project.name);
}

async function rememberProjectFile(
  handle: FileSystemFileHandle,
  projectName: string
): Promise<RecentProjectFile> {
  const record: RecentProjectFileRecord = {
    id: crypto.randomUUID(),
    name: projectName,
    fileName: handle.name,
    updatedAt: new Date().toISOString(),
    handle,
  };

  const existing = await withStore<RecentProjectFileRecord[]>('readonly', (store) => store.getAll());
  let matching: RecentProjectFileRecord | undefined;
  for (const item of existing ?? []) {
    if (await item.handle.isSameEntry(handle)) {
      matching = item;
      break;
    }
  }
  const saved = matching ? { ...record, id: matching.id } : record;

  await withStore('readwrite', (store) => {
    store.put(saved);
  });

  const { id, name, fileName, updatedAt } = saved;
  return { id, name, fileName, updatedAt };
}

async function writeProjectToHandle(handle: FileSystemFileHandle, data: AppData) {
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

async function readProjectFromHandle(handle: FileSystemFileHandle): Promise<AppData> {
  const file = await handle.getFile();
  const data = JSON.parse(await file.text()) as AppData;

  if (!data.project || !Array.isArray(data.sections) || !Array.isArray(data.tasks)) {
    throw new Error('Invalid file format.');
  }

  return data;
}
