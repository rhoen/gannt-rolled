import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useStore } from '../store/useStore';
import type { Task, ZoomLevel } from '../types';

const TASK_ROW_H = 36;
const SECTION_ROW_H = 28;
const LEFT_PANEL_W = 260;
const TIME_HEADER_H = 48;
const BAR_PADDING = 6;

const ZOOM_PX_PER_DAY: Record<ZoomLevel, number> = {
  Day: 40,
  Week: 12,
  Month: 4,
  Quarter: 1.5,
};

function dateToDays(date: string) {
  return Math.floor(new Date(date).getTime() / 86400000);
}

function daysToDate(days: number): string {
  const d = new Date(days * 86400000);
  return d.toISOString().slice(0, 10);
}

function addDays(date: string, n: number): string {
  return daysToDate(dateToDays(date) + n);
}

function parseDate(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatMonth(d: Date) {
  return d.toLocaleString('default', { month: 'short' });
}

function formatMonthLong(d: Date) {
  return d.toLocaleString('default', { month: 'long' });
}

interface DragState {
  taskId: string;
  type: 'move' | 'left' | 'right';
  startX: number;
  origStart: string;
  origEnd: string;
  tooltip: { x: number; y: number; start: string; end: string } | null;
}

export function GanttView() {
  const { sections, tasks, updateTask } = useStore();
  const [zoom, setZoom] = useState<ZoomLevel>('Month');
  const rightRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [dragTooltip, setDragTooltip] = useState<{
    x: number; y: number; start: string; end: string
  } | null>(null);
  const [, forceUpdate] = useState(0);

  const pxPerDay = ZOOM_PX_PER_DAY[zoom];

  const sortedSections = [...sections].sort((a, b) => a.order - b.order);

  // Build row list
  const rows: Array<{ kind: 'section'; sectionId: string; label: string } | { kind: 'task'; task: Task }> = [];
  for (const sec of sortedSections) {
    rows.push({ kind: 'section', sectionId: sec.id, label: sec.text });
    const secTasks = [...tasks.filter((t) => t.sectionId === sec.id)].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    );
    for (const t of secTasks) {
      rows.push({ kind: 'task', task: t });
    }
  }

  // Project date range
  const allDates = tasks.flatMap((t) => [t.start, t.end]);
  const today = new Date().toISOString().slice(0, 10);
  allDates.push(today);

  const minDate = allDates.reduce((a, b) => (a < b ? a : b));
  const maxDate = allDates.reduce((a, b) => (a > b ? a : b));

  // Extend range a bit for padding
  const projectStart = addDays(minDate, -7);
  const projectEnd = addDays(maxDate, 14);

  const startDays = dateToDays(projectStart);
  const endDays = dateToDays(projectEnd);
  const totalDays = endDays - startDays + 1;
  const totalWidth = Math.max(totalDays * pxPerDay, 800);

  const totalHeight = rows.reduce(
    (h, r) => h + (r.kind === 'section' ? SECTION_ROW_H : TASK_ROW_H),
    0
  ) + TIME_HEADER_H;

  function dateToX(date: string) {
    return (dateToDays(date) - startDays) * pxPerDay;
  }

  // Sync vertical scroll
  function handleRightScroll() {
    if (leftRef.current && rightRef.current) {
      leftRef.current.scrollTop = rightRef.current.scrollTop;
    }
  }
  function handleLeftScroll() {
    if (leftRef.current && rightRef.current) {
      rightRef.current.scrollTop = leftRef.current.scrollTop;
    }
  }

  // Preserve scroll % on zoom change
  const prevZoomRef = useRef(zoom);
  const prevScrollRef = useRef(0);
  useEffect(() => {
    if (rightRef.current && prevZoomRef.current !== zoom) {
      const el = rightRef.current;
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll > 0) {
        el.scrollLeft = prevScrollRef.current * (el.scrollWidth - el.clientWidth);
      }
      prevZoomRef.current = zoom;
    }
  }, [zoom, totalWidth]);

  function handleZoomChange(z: ZoomLevel) {
    if (rightRef.current) {
      const el = rightRef.current;
      const maxScroll = el.scrollWidth - el.clientWidth;
      prevScrollRef.current = maxScroll > 0 ? el.scrollLeft / maxScroll : 0;
    }
    setZoom(z);
  }

  // Drag handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, taskId: string, type: DragState['type'], task: Task) => {
      e.preventDefault();
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (!svgRect) return;
      dragRef.current = {
        taskId,
        type,
        startX: e.clientX,
        origStart: task.start,
        origEnd: task.end,
        tooltip: null,
      };
    },
    []
  );

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const daysDelta = Math.round(dx / pxPerDay);
      const task = tasks.find((t) => t.id === drag.taskId);
      if (!task) return;

      let newStart = drag.origStart;
      let newEnd = drag.origEnd;

      if (drag.type === 'move') {
        newStart = addDays(drag.origStart, daysDelta);
        newEnd = addDays(drag.origEnd, daysDelta);
      } else if (drag.type === 'left') {
        newStart = addDays(drag.origStart, daysDelta);
        if (newStart >= drag.origEnd) newStart = addDays(drag.origEnd, -1);
      } else {
        newEnd = addDays(drag.origEnd, daysDelta);
        if (newEnd <= drag.origStart) newEnd = addDays(drag.origStart, 1);
      }

      const svgRect = svgRef.current?.getBoundingClientRect();
      const relX = svgRect ? e.clientX - svgRect.left : 0;
      const relY = svgRect ? e.clientY - svgRect.top : 0;
      dragRef.current!.tooltip = { x: relX, y: relY, start: newStart, end: newEnd };
      setDragTooltip({ x: relX, y: relY, start: newStart, end: newEnd });

      // Live preview via forceUpdate (we mutate a ref copy)
      dragRef.current!.origStart; // just touching ref
      forceUpdate((n) => n + 1);
    }

    function onMouseUp() {
      const drag = dragRef.current;
      if (!drag) return;
      const tt = drag.tooltip;
      if (tt) {
        updateTask(drag.taskId, { start: tt.start, end: tt.end });
      }
      dragRef.current = null;
      setDragTooltip(null);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [tasks, pxPerDay, updateTask]);

  // Build time axis ticks
  function buildTimeTicks() {
    const topLabels: Array<{ x: number; label: string; width: number }> = [];
    const bottomLabels: Array<{ x: number; label: string }> = [];

    const start = parseDate(projectStart);
    const end = parseDate(projectEnd);

    if (zoom === 'Month') {
      // Top: years, Bottom: months
      let cur = new Date(start.getFullYear(), start.getMonth(), 1);
      while (cur <= end) {
        const x = dateToX(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-01`);
        bottomLabels.push({ x, label: formatMonth(cur) });
        cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      }
      let yearCur = new Date(start.getFullYear(), 0, 1);
      while (yearCur <= end) {
        const x = dateToX(`${yearCur.getFullYear()}-01-01`);
        const nextYear = new Date(yearCur.getFullYear() + 1, 0, 1);
        const nextX = dateToX(`${nextYear.getFullYear()}-01-01`);
        topLabels.push({ x, label: String(yearCur.getFullYear()), width: nextX - x });
        yearCur = new Date(yearCur.getFullYear() + 1, 0, 1);
      }
    } else if (zoom === 'Quarter') {
      // Top: years, Bottom: Q1-Q4
      let yearCur = new Date(start.getFullYear(), 0, 1);
      while (yearCur <= end) {
        const x = dateToX(`${yearCur.getFullYear()}-01-01`);
        const nextX = dateToX(`${yearCur.getFullYear() + 1}-01-01`);
        topLabels.push({ x, label: String(yearCur.getFullYear()), width: nextX - x });
        yearCur = new Date(yearCur.getFullYear() + 1, 0, 1);
      }
      const quarters = [[0, 'Q1'], [3, 'Q2'], [6, 'Q3'], [9, 'Q4']] as const;
      let yCur = start.getFullYear();
      const yEnd = end.getFullYear() + 1;
      for (let y = yCur; y <= yEnd; y++) {
        for (const [m, label] of quarters) {
          const d = new Date(y, m, 1);
          if (d > end) break;
          const x = dateToX(`${y}-${String(m + 1).padStart(2, '0')}-01`);
          bottomLabels.push({ x, label });
        }
      }
    } else if (zoom === 'Week') {
      // Top: months, Bottom: week start dates
      let cur = new Date(start.getFullYear(), start.getMonth(), 1);
      while (cur <= end) {
        const x = dateToX(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-01`);
        const nextMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
        const nextX = dateToX(`${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`);
        topLabels.push({ x, label: formatMonthLong(cur), width: nextX - x });
        cur = nextMonth;
      }
      // Find first Monday before or on start
      let weekCur = new Date(start);
      const dow = weekCur.getDay();
      weekCur.setDate(weekCur.getDate() - (dow === 0 ? 6 : dow - 1));
      while (weekCur <= end) {
        const iso = weekCur.toISOString().slice(0, 10);
        const x = dateToX(iso);
        bottomLabels.push({ x, label: `${weekCur.getMonth() + 1}/${weekCur.getDate()}` });
        weekCur.setDate(weekCur.getDate() + 7);
      }
    } else {
      // Day zoom: Top: months, Bottom: day numbers
      let cur = new Date(start.getFullYear(), start.getMonth(), 1);
      while (cur <= end) {
        const x = dateToX(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-01`);
        const nextMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
        const nextX = dateToX(`${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`);
        topLabels.push({ x, label: formatMonthLong(cur), width: nextX - x });
        const daysInMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate();
        for (let d = 1; d <= daysInMonth; d++) {
          const dayStr = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const dx = dateToX(dayStr);
          bottomLabels.push({ x: dx, label: String(d) });
        }
        cur = nextMonth;
      }
    }

    return { topLabels, bottomLabels };
  }

  const { topLabels, bottomLabels } = buildTimeTicks();
  const todayX = dateToX(today);

  // Compute live preview positions during drag
  function getTaskBounds(task: Task): { x: number; width: number; start: string; end: string } {
    const drag = dragRef.current;
    if (drag && drag.taskId === task.id && drag.tooltip) {
      const { start, end } = drag.tooltip;
      const x = dateToX(start);
      const endX = dateToX(end) + pxPerDay;
      return { x, width: Math.max(endX - x, pxPerDay), start, end };
    }
    const x = dateToX(task.start);
    const endX = dateToX(task.end) + pxPerDay;
    return { x, width: Math.max(endX - x, pxPerDay), start: task.start, end: task.end };
  }

  // Build row Y positions
  function getRowY(rowIdx: number): number {
    let y = TIME_HEADER_H;
    for (let i = 0; i < rowIdx; i++) {
      y += rows[i].kind === 'section' ? SECTION_ROW_H : TASK_ROW_H;
    }
    return y;
  }

  const SECTION_COLORS = [
    '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444',
    '#06b6d4', '#ec4899', '#84cc16',
  ];

  function getSectionColor(sectionId: string): string {
    const idx = sortedSections.findIndex((s) => s.id === sectionId);
    return SECTION_COLORS[idx % SECTION_COLORS.length];
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Gantt toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 shrink-0">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Zoom</span>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {(['Day', 'Week', 'Month', 'Quarter'] as ZoomLevel[]).map((z) => (
            <button
              key={z}
              onClick={() => handleZoomChange(z)}
              className={`px-3 py-1 text-sm transition-colors ${
                zoom === z
                  ? 'bg-blue-600 text-white font-medium'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {z}
            </button>
          ))}
        </div>
      </div>

      {/* Main gantt area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        <div
          style={{ width: LEFT_PANEL_W, minWidth: LEFT_PANEL_W }}
          className="flex flex-col border-r border-gray-200 shrink-0"
        >
          {/* Header matching time axis height */}
          <div
            style={{ height: TIME_HEADER_H }}
            className="border-b border-gray-200 bg-gray-50 flex items-end px-3 pb-1.5 shrink-0"
          >
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Tasks</span>
          </div>
          {/* Rows */}
          <div
            ref={leftRef}
            className="flex-1 overflow-y-auto overflow-x-hidden"
            onScroll={handleLeftScroll}
            style={{ scrollbarWidth: 'none' }}
          >
            {rows.map((row) =>
              row.kind === 'section' ? (
                <div
                  key={`s-${row.sectionId}`}
                  style={{ height: SECTION_ROW_H }}
                  className="flex items-center px-3 bg-gray-50 border-b border-gray-100"
                >
                  <span className="text-xs font-semibold text-gray-600 truncate">{row.label}</span>
                </div>
              ) : (
                <div
                  key={`t-${row.task.id}`}
                  style={{ height: TASK_ROW_H }}
                  className="flex items-center px-3 pl-6 border-b border-gray-100 hover:bg-blue-50/40 transition-colors"
                >
                  <span className="text-sm text-gray-700 truncate">{row.task.text}</span>
                </div>
              )
            )}
            {rows.length === 0 && (
              <div className="px-3 py-6 text-sm text-gray-400 italic">No tasks</div>
            )}
          </div>
        </div>

        {/* Right scrollable panel */}
        <div
          ref={rightRef}
          className="flex-1 overflow-auto relative"
          onScroll={handleRightScroll}
        >
          <svg
            ref={svgRef}
            width={totalWidth}
            height={totalHeight}
            className="block select-none"
            style={{ cursor: dragRef.current ? 'grabbing' : 'default' }}
          >
            {/* Background stripes */}
            {rows.map((row, i) => {
              const y = getRowY(i);
              const h = row.kind === 'section' ? SECTION_ROW_H : TASK_ROW_H;
              return (
                <rect
                  key={i}
                  x={0}
                  y={y}
                  width={totalWidth}
                  height={h}
                  fill={row.kind === 'section' ? '#f9fafb' : i % 2 === 0 ? '#ffffff' : '#fafafa'}
                />
              );
            })}

            {/* Vertical day/week/month lines */}
            {bottomLabels.map((tick, i) => (
              <line
                key={i}
                x1={tick.x}
                y1={TIME_HEADER_H}
                x2={tick.x}
                y2={totalHeight}
                stroke="#e5e7eb"
                strokeWidth={0.5}
              />
            ))}

            {/* Time axis background */}
            <rect x={0} y={0} width={totalWidth} height={TIME_HEADER_H} fill="#f9fafb" />
            <line x1={0} y1={TIME_HEADER_H} x2={totalWidth} y2={TIME_HEADER_H} stroke="#e5e7eb" strokeWidth={1} />
            <line x1={0} y1={24} x2={totalWidth} y2={24} stroke="#e5e7eb" strokeWidth={0.5} />

            {/* Top axis labels */}
            {topLabels.map((tick, i) => (
              <g key={i}>
                <line x1={tick.x} y1={0} x2={tick.x} y2={24} stroke="#d1d5db" strokeWidth={1} />
                <text
                  x={tick.x + 6}
                  y={16}
                  fontSize={11}
                  fontWeight={600}
                  fill="#6b7280"
                  fontFamily="system-ui, sans-serif"
                >
                  {tick.label}
                </text>
              </g>
            ))}

            {/* Bottom axis labels */}
            {bottomLabels.map((tick, i) => (
              <text
                key={i}
                x={tick.x + (zoom === 'Day' ? 2 : 4)}
                y={42}
                fontSize={10}
                fill="#9ca3af"
                fontFamily="system-ui, sans-serif"
              >
                {tick.label}
              </text>
            ))}

            {/* Today marker */}
            {todayX >= 0 && todayX <= totalWidth && (
              <g>
                <line
                  x1={todayX}
                  y1={0}
                  x2={todayX}
                  y2={totalHeight}
                  stroke="#ef4444"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                />
                <rect x={todayX - 18} y={2} width={36} height={16} rx={3} fill="#ef4444" />
                <text
                  x={todayX}
                  y={14}
                  fontSize={9}
                  fontWeight={700}
                  fill="white"
                  textAnchor="middle"
                  fontFamily="system-ui, sans-serif"
                >
                  Today
                </text>
              </g>
            )}

            {/* Task bars */}
            {rows.map((row, rowIdx) => {
              if (row.kind !== 'task') return null;
              const task = row.task;
              const y = getRowY(rowIdx);
              const { x, width } = getTaskBounds(task);
              const barY = y + BAR_PADDING;
              const barH = TASK_ROW_H - BAR_PADDING * 2;
              const color = getSectionColor(task.sectionId);
              const progressW = (task.progress / 100) * (width - 4);
              const isDragging = dragRef.current?.taskId === task.id;
              const HANDLE_W = 6;

              return (
                <g key={task.id} style={{ cursor: 'grab' }}>
                  {/* Bar shadow */}
                  <rect
                    x={x + 1}
                    y={barY + 2}
                    width={width}
                    height={barH}
                    rx={4}
                    fill="rgba(0,0,0,0.08)"
                  />
                  {/* Bar background */}
                  <rect
                    x={x}
                    y={barY}
                    width={width}
                    height={barH}
                    rx={4}
                    fill={color}
                    fillOpacity={isDragging ? 0.9 : 0.75}
                    stroke={color}
                    strokeWidth={1}
                    onMouseDown={(e) => handleMouseDown(e, task.id, 'move', task)}
                    style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                  />
                  {/* Progress fill */}
                  {progressW > 0 && (
                    <rect
                      x={x + 2}
                      y={barY + 2}
                      width={Math.max(0, progressW - 2)}
                      height={barH - 4}
                      rx={3}
                      fill={color}
                      fillOpacity={1}
                      style={{ pointerEvents: 'none' }}
                    />
                  )}
                  {/* Task label */}
                  {width > 30 && (
                    <text
                      x={x + 8}
                      y={barY + barH / 2 + 4}
                      fontSize={11}
                      fill="white"
                      fontFamily="system-ui, sans-serif"
                      fontWeight={500}
                      style={{ pointerEvents: 'none' }}
                    >
                      <tspan>{task.text.length > Math.floor(width / 8) ? task.text.slice(0, Math.floor(width / 8)) + '…' : task.text}</tspan>
                    </text>
                  )}
                  {/* Left resize handle */}
                  <rect
                    x={x}
                    y={barY}
                    width={HANDLE_W}
                    height={barH}
                    rx={4}
                    fill={color}
                    fillOpacity={0.4}
                    style={{ cursor: 'ew-resize' }}
                    onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, task.id, 'left', task); }}
                  />
                  {/* Right resize handle */}
                  <rect
                    x={x + width - HANDLE_W}
                    y={barY}
                    width={HANDLE_W}
                    height={barH}
                    rx={4}
                    fill={color}
                    fillOpacity={0.4}
                    style={{ cursor: 'ew-resize' }}
                    onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, task.id, 'right', task); }}
                  />
                </g>
              );
            })}

            {/* Drag tooltip */}
            {dragTooltip && (
              <g style={{ pointerEvents: 'none' }}>
                <rect
                  x={dragTooltip.x + 10}
                  y={dragTooltip.y - 30}
                  width={160}
                  height={24}
                  rx={4}
                  fill="#1f2937"
                  fillOpacity={0.92}
                />
                <text
                  x={dragTooltip.x + 18}
                  y={dragTooltip.y - 13}
                  fontSize={11}
                  fill="white"
                  fontFamily="system-ui, sans-serif"
                >
                  {dragTooltip.start} → {dragTooltip.end}
                </text>
              </g>
            )}
          </svg>
        </div>
      </div>
    </div>
  );
}
