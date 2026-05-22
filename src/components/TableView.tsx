import React, { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { Pencil, Trash2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import type { Task, Section } from '../types';
import type { SortMode } from '../types';

interface Props {
  onEditTask: (task: Task) => void;
  onEditSection: (section: Section) => void;
}

interface FlatRow {
  kind: 'task';
  task: Task;
  sectionName: string;
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-200 rounded-full h-1.5 min-w-[60px]">
        <div
          className="bg-blue-500 h-1.5 rounded-full transition-all"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{value}%</span>
    </div>
  );
}

function DeleteConfirm({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-gray-600">Delete?</span>
      <button
        onClick={onConfirm}
        className="text-xs px-1.5 py-0.5 bg-red-500 text-white rounded hover:bg-red-600"
      >
        Yes
      </button>
      <button
        onClick={onCancel}
        className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
      >
        No
      </button>
    </div>
  );
}

const columnHelper = createColumnHelper<FlatRow>();

function flatColumns(
  onEdit: (task: Task) => void,
  onDelete: (id: string) => void,
  deletingId: string | null,
  setDeletingId: (id: string | null) => void
) {
  return [
    columnHelper.accessor('task', {
      id: 'text',
      header: 'Task Name',
      cell: (info) => (
        <span className="font-medium text-gray-800">{info.getValue().text}</span>
      ),
    }),
    columnHelper.accessor('sectionName', {
      header: 'Section',
      cell: (info) => (
        <span className="text-gray-500 text-sm">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor((row) => row.task.start, {
      id: 'start',
      header: 'Start',
      cell: (info) => <span className="text-sm text-gray-600">{info.getValue()}</span>,
    }),
    columnHelper.accessor((row) => row.task.end, {
      id: 'end',
      header: 'End',
      cell: (info) => <span className="text-sm text-gray-600">{info.getValue()}</span>,
    }),
    columnHelper.accessor((row) => row.task.progress, {
      id: 'progress',
      header: 'Progress',
      cell: (info) => <ProgressBar value={info.getValue()} />,
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: (info) => {
        const task = info.row.original.task;
        if (deletingId === task.id) {
          return (
            <DeleteConfirm
              onConfirm={() => { onDelete(task.id); setDeletingId(null); }}
              onCancel={() => setDeletingId(null)}
            />
          );
        }
        return (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onEdit(task)}
              className="p-1 text-gray-400 hover:text-blue-500 rounded transition-colors"
              title="Edit"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => setDeletingId(task.id)}
              className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
        );
      },
    }),
  ];
}

export function TableView({ onEditTask, onEditSection }: Props) {
  const { sections, tasks, deleteTask, deleteSection } = useStore();
  const [sortMode, setSortMode] = useState<SortMode>('Grouped');
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [deletingSectionId, setDeletingSectionId] = useState<string | null>(null);

  const sectionMap = new Map(sections.map((s) => [s.id, s.text]));
  const sortedSections = [...sections].sort((a, b) => a.order - b.order);

  const flatRows: FlatRow[] = [...tasks]
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .map((task) => ({
      kind: 'task' as const,
      task,
      sectionName: sectionMap.get(task.sectionId) ?? 'Unknown',
    }));

  const columns = flatColumns(onEditTask, deleteTask, deletingTaskId, setDeletingTaskId);

  const table = useReactTable({
    data: flatRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (sortMode === 'Flat') {
    return (
      <div className="flex flex-col h-full">
        <ViewToolbar sortMode={sortMode} onSort={setSortMode} />
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-gray-50 z-10">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => (
                    <th
                      key={h.id}
                      className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200"
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-100">
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="group hover:bg-blue-50/50 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-2.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
              {flatRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-sm">
                    No tasks yet. Add a section and then a task to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Grouped mode
  return (
    <div className="flex flex-col h-full">
      <ViewToolbar sortMode={sortMode} onSort={setSortMode} />
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200 w-[35%]">
                Task Name
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200">
                Start
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200">
                End
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200 w-[160px]">
                Progress
              </th>
              <th className="w-20 border-b border-gray-200" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedSections.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-400 text-sm">
                  No sections yet. Click "+ Add Section" to create one.
                </td>
              </tr>
            )}
            {sortedSections.map((section) => {
              const sectionTasks = [...tasks.filter((t) => t.sectionId === section.id)].sort(
                (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
              );
              return (
                <React.Fragment key={section.id}>
                  <tr className="bg-gray-50 group">
                    <td colSpan={4} className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-700 text-sm">{section.text}</span>
                        <span className="text-xs text-gray-400">({sectionTasks.length})</span>
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      {deletingSectionId === section.id ? (
                        <DeleteConfirm
                          onConfirm={() => { deleteSection(section.id); setDeletingSectionId(null); }}
                          onCancel={() => setDeletingSectionId(null)}
                        />
                      ) : (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => onEditSection(section)}
                            className="p-1 text-gray-400 hover:text-blue-500 rounded"
                            title="Edit section"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => setDeletingSectionId(section.id)}
                            className="p-1 text-gray-400 hover:text-red-500 rounded"
                            title="Delete section"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {sectionTasks.map((task) => (
                    <tr key={task.id} className="group hover:bg-blue-50/50 transition-colors">
                      <td className="px-4 py-2.5 pl-8">
                        <span className="font-medium text-gray-800">{task.text}</span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">{task.start}</td>
                      <td className="px-4 py-2.5 text-gray-600">{task.end}</td>
                      <td className="px-4 py-2.5">
                        <ProgressBar value={task.progress} />
                      </td>
                      <td className="px-2 py-2.5">
                        {deletingTaskId === task.id ? (
                          <DeleteConfirm
                            onConfirm={() => { deleteTask(task.id); setDeletingTaskId(null); }}
                            onCancel={() => setDeletingTaskId(null)}
                          />
                        ) : (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => onEditTask(task)}
                              className="p-1 text-gray-400 hover:text-blue-500 rounded"
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => setDeletingTaskId(task.id)}
                              className="p-1 text-gray-400 hover:text-red-500 rounded"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {sectionTasks.length === 0 && (
                    <tr>
                      <td colSpan={5} className="pl-8 px-4 py-2 text-sm text-gray-400 italic">
                        No tasks in this section.
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ViewToolbar({ sortMode, onSort }: { sortMode: SortMode; onSort: (m: SortMode) => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 bg-white shrink-0">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">View</span>
      <div className="flex rounded-lg border border-gray-200 overflow-hidden">
        {(['Grouped', 'Flat'] as SortMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => onSort(mode)}
            className={`px-3 py-1 text-sm transition-colors ${
              sortMode === mode
                ? 'bg-blue-600 text-white font-medium'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {mode}
          </button>
        ))}
      </div>
    </div>
  );
}
