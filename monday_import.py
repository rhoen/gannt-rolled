#!/usr/bin/env python3
"""
monday_import.py  —  Convert a Monday.com XLSX or CSV export into the
Gantt Tracker JSON format so it can be opened directly in the app.

Usage
-----
  # XLSX (standard Monday.com board export)
  python monday_import.py 126_North_Ave_1779470664.xlsx

  # CSV (Monday.com "Export to CSV" – flat layout with a Group column)
  python monday_import.py board_export.csv

  # Custom output path
  python monday_import.py input.xlsx -o my_project.json

Requirements
------------
  pip install openpyxl          (for .xlsx files)
  openpyxl is already in .venv if you set it up with:
    python3 -m venv .venv && .venv/bin/pip install openpyxl

Status → progress mapping
--------------------------
  Done / Completed / Archived   → 100
  Working on it / In Progress   →  50
  Stuck                         →  25
  Not Started / (blank)         →   0
"""

import argparse
import csv
import json
import sys
import uuid
from datetime import date, datetime
from pathlib import Path

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

STATUS_PROGRESS: dict[str, int] = {
    "done":            100,
    "completed":       100,
    "archived":        100,
    "working on it":    50,
    "in progress":      50,
    "stuck":            25,
    "not started":       0,
}


def today_str() -> str:
    return date.today().isoformat()


def to_date_str(val) -> str | None:
    """Return YYYY-MM-DD string or None for any date-like value."""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.date().isoformat()
    if isinstance(val, date):
        return val.isoformat()
    s = str(val).strip()
    if not s:
        return None
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%Y/%m/%d", "%m-%d-%Y"):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            pass
    return None


def status_to_progress(val) -> int:
    if not val:
        return 0
    return STATUS_PROGRESS.get(str(val).strip().lower(), 0)


def make_task(text, section_id, start, end, progress, order) -> dict:
    fallback = today_str()
    start = start or fallback
    end   = end   or start
    if start > end:
        start, end = end, start
    return {
        "id":        str(uuid.uuid4()),
        "sectionId": section_id,
        "text":      text,
        "start":     start,
        "end":       end,
        "progress":  progress,
        "order":     order,
    }


def make_section(text, order) -> dict:
    return {"id": str(uuid.uuid4()), "text": text, "order": order}


def build_output(project_name: str, sections: list, tasks: list) -> dict:
    t = today_str()
    return {
        "version": "1.0",
        "project": {
            "id":        str(uuid.uuid4()),
            "name":      project_name,
            "createdAt": t,
            "updatedAt": t,
        },
        "sections": sections,
        "tasks":    tasks,
    }


# ---------------------------------------------------------------------------
# XLSX parser  (standard Monday.com "Export to Excel" layout)
#
# Layout pattern:
#   Row 0:  Board name  (e.g. "126 North Ave")
#   Row 1:  Monday boilerplate description — skipped
#   Row 2:  empty
#   Row N:  Section name  (col 0 has text; status + timeline cols are empty)
#   Row N+1: Column header  (col 0 == "Name")
#   Row …:  Task rows
#   Row …:  Summary row   (col 0 is empty; skip)
#   Row …:  empty  → end of section
#   … repeats …
# ---------------------------------------------------------------------------

def parse_xlsx(path: str):
    try:
        import openpyxl
    except ImportError:
        sys.exit(
            "openpyxl is required for .xlsx files.\n"
            "Install it into the local venv:\n"
            "  python3 -m venv .venv && .venv/bin/pip install openpyxl\n"
            "Then run with:  .venv/bin/python monday_import.py ..."
        )

    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb.active
    rows = [tuple(c.value for c in row) for row in ws.iter_rows()]

    # Project name: first non-empty cell of row 0
    project_name = Path(path).stem.replace("_", " ")
    for cell in rows[0]:
        if cell and str(cell).strip():
            project_name = str(cell).strip()
            break

    # Default column positions (will be updated when we see a header row)
    col_status = 3
    col_ts     = 7   # Timeline - Start
    col_te     = 8   # Timeline - End

    def get(row, idx):
        return row[idx] if idx < len(row) else None

    sections:      list[dict] = []
    tasks:         list[dict] = []
    current_sec:   dict | None = None
    in_tasks:      bool = False
    sec_order:     int  = 0
    task_order:    dict[str, int] = {}

    # Skip rows 0 and 1 (project name + Monday boilerplate)
    for row in rows[2:]:
        name_val = get(row, 0)
        name_str = str(name_val).strip() if name_val else ""

        # Empty row — leave task mode, stay in current section context
        if not any(v for v in row):
            in_tasks = False
            continue

        # Column header row (first cell == "Name") — enter task mode
        # Also use it to re-detect column positions in case they vary
        if name_str.lower() == "name":
            for ci, cell in enumerate(row):
                label = str(cell).strip().lower() if cell else ""
                if label == "status":
                    col_status = ci
                elif label == "timeline - start":
                    col_ts = ci
                elif label == "timeline - end":
                    col_te = ci
            in_tasks = True
            continue

        # Summary / totals row: col 0 is empty but other cols have content — skip
        if not name_str:
            continue

        if not in_tasks:
            # Section header row
            sec = make_section(name_str, sec_order)
            sections.append(sec)
            current_sec = sec
            task_order[sec["id"]] = 0
            sec_order += 1
        else:
            # Task row
            if not current_sec:
                continue

            start_str = to_date_str(get(row, col_ts))
            end_str   = to_date_str(get(row, col_te))

            # Skip tasks with no timeline data at all
            if not start_str and not end_str:
                continue

            progress  = status_to_progress(get(row, col_status))
            sec_id    = current_sec["id"]
            t_order   = task_order[sec_id]

            tasks.append(make_task(name_str, sec_id, start_str, end_str, progress, t_order))
            task_order[sec_id] += 1

    return project_name, sections, tasks


# ---------------------------------------------------------------------------
# CSV parser
#
# Monday.com CSV exports come in two flavours:
#
#   A) Flat export  — has a "Group" column that names the section.
#      Headers on row 0: Name, Group, Owner, Status, …, Timeline - Start, …
#
#   B) Same layout as XLSX  — no "Group" column; section name rows embedded.
#      We detect which flavour we have from the header row.
# ---------------------------------------------------------------------------

def parse_csv(path: str):
    with open(path, newline="", encoding="utf-8-sig") as f:
        raw = list(csv.reader(f))

    if not raw:
        sys.exit("CSV file is empty.")

    # Detect flavour from header row (first non-empty row)
    header_row_idx = next(
        (i for i, r in enumerate(raw) if any(c.strip() for c in r)), None
    )
    if header_row_idx is None:
        sys.exit("CSV has no content.")

    header = [c.strip() for c in raw[header_row_idx]]
    has_group_col = any(h.lower() in ("group", "board group") for h in header)

    if has_group_col:
        return _parse_csv_flat(raw, header_row_idx, Path(path).stem)
    else:
        # Treat like XLSX row layout (rows as tuples of str)
        str_rows = [tuple(c for c in r) for r in raw]
        return parse_xlsx.__wrapped__(str_rows, Path(path).stem) if False else \
               _parse_csv_like_xlsx(raw, Path(path).stem)


def _parse_csv_like_xlsx(rows: list[list[str]], source_name: str):
    """CSV that mirrors the XLSX section-header layout."""
    project_name = source_name.replace("_", " ")
    for cell in rows[0]:
        if cell.strip():
            project_name = cell.strip()
            break

    col_status = 3
    col_ts     = 7
    col_te     = 8

    def get(row, idx):
        return row[idx].strip() if idx < len(row) else ""

    sections:   list[dict] = []
    tasks:      list[dict] = []
    current_sec: dict | None = None
    in_tasks:   bool = False
    sec_order:  int  = 0
    task_order: dict[str, int] = {}

    for row in rows[2:]:
        name_str = get(row, 0)

        if not any(c.strip() for c in row):
            in_tasks = False
            continue

        if name_str.lower() == "name":
            for ci, cell in enumerate(row):
                label = cell.strip().lower()
                if label == "status":               col_status = ci
                elif label == "timeline - start":   col_ts     = ci
                elif label == "timeline - end":     col_te     = ci
            in_tasks = True
            continue

        if not name_str:
            continue

        if not in_tasks:
            sec = make_section(name_str, sec_order)
            sections.append(sec)
            current_sec = sec
            task_order[sec["id"]] = 0
            sec_order += 1
        else:
            if not current_sec:
                continue
            start_str = to_date_str(get(row, col_ts))
            end_str   = to_date_str(get(row, col_te))
            if not start_str and not end_str:
                continue
            progress = status_to_progress(get(row, col_status))
            sec_id   = current_sec["id"]
            tasks.append(make_task(name_str, sec_id, start_str, end_str, progress, task_order[sec_id]))
            task_order[sec_id] += 1

    return project_name, sections, tasks


def _parse_csv_flat(rows: list[list[str]], header_idx: int, source_name: str):
    """CSV with a flat Group column (Monday.com direct CSV export)."""
    header = [c.strip() for c in rows[header_idx]]

    def find_col(*names: str) -> int | None:
        for n in names:
            for i, h in enumerate(header):
                if h.strip().lower() == n.lower():
                    return i
        return None

    i_name   = find_col("Name", "Task Name", "Item")
    i_group  = find_col("Group", "Board Group")
    i_status = find_col("Status")
    i_ts     = find_col("Timeline - Start", "Start", "Start Date")
    i_te     = find_col("Timeline - End", "End", "End Date", "Due Date")

    if i_name is None:
        sys.exit("CSV: could not find a 'Name' column in: " + str(header))

    project_name = source_name.replace("_", " ")
    sections_map: dict[str, dict] = {}
    tasks:        list[dict]      = []
    sec_order:    int              = 0
    task_order:   dict[str, int]  = {}

    def get(row, idx):
        return row[idx].strip() if idx is not None and idx < len(row) else ""

    for row in rows[header_idx + 1:]:
        if not any(c.strip() for c in row):
            continue

        name_str = get(row, i_name)
        if not name_str:
            continue

        group_str = get(row, i_group) or "General"
        if group_str not in sections_map:
            sec = make_section(group_str, sec_order)
            sections_map[group_str] = sec
            task_order[sec["id"]] = 0
            sec_order += 1

        sec    = sections_map[group_str]
        sec_id = sec["id"]

        start_str = to_date_str(get(row, i_ts))
        end_str   = to_date_str(get(row, i_te))
        if not start_str and not end_str:
            continue

        progress = status_to_progress(get(row, i_status))
        tasks.append(make_task(name_str, sec_id, start_str, end_str, progress, task_order[sec_id]))
        task_order[sec_id] += 1

    return project_name, list(sections_map.values()), tasks


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Convert a Monday.com XLSX/CSV export to Gantt Tracker JSON.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("input",  help="Path to .xlsx or .csv file")
    parser.add_argument("-o", "--output", help="Output .json path (default: same name as input)")
    args = parser.parse_args()

    src = Path(args.input)
    if not src.exists():
        sys.exit(f"File not found: {src}")

    ext = src.suffix.lower()
    if ext == ".xlsx":
        project_name, sections, tasks = parse_xlsx(str(src))
    elif ext == ".csv":
        project_name, sections, tasks = parse_csv(str(src))
    else:
        sys.exit(f"Unsupported extension '{ext}'. Provide a .xlsx or .csv file.")

    # Warn about skipped tasks (those with no timeline)
    out_path = Path(args.output) if args.output else src.with_suffix(".json")
    data = build_output(project_name, sections, tasks)
    out_path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    sec_word  = "section" if len(sections) == 1 else "sections"
    task_word = "task"    if len(tasks)    == 1 else "tasks"
    print(f"✓  {len(sections)} {sec_word}, {len(tasks)} {task_word}  →  {out_path}")


if __name__ == "__main__":
    main()
