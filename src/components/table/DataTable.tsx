import {
  flexRender, getCoreRowModel, getFacetedUniqueValues, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable,
  type ColumnDef, type ColumnFiltersState, type FilterFn, type Row, type RowData, type SortingState, type VisibilityState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Columns3, Download, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DateRangeFilter, periodeLabel, rangeFor, type DateRange } from './DateRangeFilter';
import { useToast } from '@/components/ui/Toast';
import { exportXlsx } from './exportXlsx';
import { nf } from '@/lib/format';
import { Money } from '@/components/ui/Money';

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> extends ColMeta {}
}

/** Info tambahan per kolom, dibaca DataTable. */
export interface ColMeta {
  label?: string;              // nama kolom untuk filter/export bila header bukan teks
  align?: 'left' | 'right' | 'center';
  filter?: 'select';           // tampilkan dropdown filter dari nilai unik kolom
  filterLabel?: (v: unknown) => string;
  total?: boolean;             // jumlahkan di baris total (kolom angka)
  money?: boolean;             // format total sebagai rupiah
  exportValue?: (row: any) => unknown; // nilai untuk Excel (default: getValue)
  noExport?: boolean;
  hideOnCard?: boolean;        // jangan tampilkan di kartu mobile
  className?: string;
}

interface Props<T> {
  data: T[];
  columns: ColumnDef<T, any>[];
  title: string;               // dipakai untuk nama file export
  storageKey: string;          // mengingat jumlah baris, kolom tampil, rentang tanggal
  dateField?: keyof T & string; // kolom tanggal untuk filter rentang tanggal
  loading?: boolean;
  toolbar?: ReactNode;         // tombol tambahan (mis. Tambah)
  onRowClick?: (row: T) => void;
  emptyText?: string;
  initialSort?: SortingState;
  canExport?: boolean;
  searchPlaceholder?: string;
  cardTitle?: (row: T) => ReactNode; // judul kartu di HP
  exportTitle?: string;        // judul di baris atas file Excel (default: title)
  exportSubtitle?: string;     // mis. periode laporan
}

const PAGE_SIZES = [10, 25, 50, 100, 0]; // 0 = semua

const globalContains: FilterFn<any> = (row, _id, value) => {
  const q = String(value || '').toLowerCase().trim();
  if (!q) return true;
  return row.getAllCells().some((c) => {
    const v = c.getValue();
    return v != null && typeof v !== 'object' && String(v).toLowerCase().includes(q);
  });
};

const equalsFilter: FilterFn<any> = (row, id, value) => value === undefined || value === '' || String(row.getValue(id)) === String(value);

function load<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem('dt:' + key); return v ? { ...fallback, ...JSON.parse(v) } : fallback; } catch { return fallback; }
}

export function DataTable<T>({
  data, columns, title, storageKey, dateField, loading, toolbar, onRowClick, emptyText = 'Belum ada data.', initialSort = [], canExport = true,
  searchPlaceholder = 'Cari…', cardTitle, exportTitle, exportSubtitle,
}: Props<T>) {
  const toast = useToast();
  const saved = useMemo(() => load(storageKey, { pageSize: 25, visibility: {} as VisibilityState, preset: 'semua' as DateRange['preset'] }), [storageKey]);
  const [search, setSearch] = useState('');
  const [sorting, setSorting] = useState<SortingState>(initialSort);
  const [filters, setFilters] = useState<ColumnFiltersState>([]);
  const [visibility, setVisibility] = useState<VisibilityState>(saved.visibility);
  const [range, setRange] = useState<DateRange>(() => rangeFor(saved.preset === 'custom' ? 'semua' : saved.preset));
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: saved.pageSize || 25 });
  const [colMenu, setColMenu] = useState(false);
  const colRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { localStorage.setItem('dt:' + storageKey, JSON.stringify({ pageSize: pagination.pageSize, visibility, preset: range.preset })); } catch { /* abaikan */ }
  }, [storageKey, pagination.pageSize, visibility, range.preset]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (colRef.current && !colRef.current.contains(e.target as Node)) setColMenu(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // filter rentang tanggal dilakukan sebelum tabel supaya total & export ikut
  const rows = useMemo(() => {
    if (!dateField || (!range.from && !range.to)) return data;
    return data.filter((r) => {
      const v = String((r as any)[dateField] || '').slice(0, 10);
      if (!v) return false;
      return (!range.from || v >= range.from) && (!range.to || v <= range.to);
    });
  }, [data, dateField, range]);

  const cols = useMemo(() => columns.map((c) => ({ filterFn: equalsFilter, ...c })), [columns]);

  const table = useReactTable({
    data: rows,
    columns: cols,
    state: { globalFilter: search, sorting, columnFilters: filters, columnVisibility: visibility, pagination: pagination.pageSize ? pagination : { pageIndex: 0, pageSize: Math.max(rows.length, 1) } },
    onGlobalFilterChange: setSearch,
    onSortingChange: setSorting,
    onColumnFiltersChange: (u) => { setFilters(u); setPagination((p) => ({ ...p, pageIndex: 0 })); },
    onColumnVisibilityChange: setVisibility,
    onPaginationChange: (u) => setPagination((p) => {
      const n = typeof u === 'function' ? u(p.pageSize ? p : { pageIndex: 0, pageSize: Math.max(rows.length, 1) }) : u;
      return { pageIndex: n.pageIndex, pageSize: p.pageSize };
    }),
    globalFilterFn: globalContains,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    autoResetPageIndex: false,
  });

  useEffect(() => setPagination((p) => ({ ...p, pageIndex: 0 })), [search, range]);

  const filtered = table.getPrePaginationRowModel().rows;
  const pageRows = table.getRowModel().rows;
  const leafCols = table.getVisibleLeafColumns();
  const hasTotal = leafCols.some((c) => (c.columnDef.meta as ColMeta)?.total);
  const metaOf = (c: { columnDef: { meta?: unknown } }) => (c.columnDef.meta || {}) as ColMeta;
  const labelOf = (c: any) => metaOf(c).label || (typeof c.columnDef.header === 'string' ? c.columnDef.header : c.id);
  const selectCols = table.getAllLeafColumns().filter((c) => metaOf(c).filter === 'select');
  const activeFilters = filters.length + (search ? 1 : 0) + (range.from || range.to ? 1 : 0);
  const pageCount = table.getPageCount();
  const pi = pagination.pageSize ? pagination.pageIndex : 0;
  const start = filtered.length ? pi * (pagination.pageSize || filtered.length) + 1 : 0;
  const end = pagination.pageSize ? Math.min(filtered.length, (pi + 1) * pagination.pageSize) : filtered.length;

  const totals = (id: string) => filtered.reduce((a, r) => a + (Number(r.getValue(id)) || 0), 0);

  const doExport = () => {
    const exportCols = table.getVisibleLeafColumns().filter((c) => !metaOf(c).noExport);
    const out = filtered.map((r: Row<T>) => {
      const o: Record<string, unknown> = {};
      exportCols.forEach((c) => {
        const m = metaOf(c);
        const v = r.getValue(c.id);
        o[labelOf(c)] = m.exportValue ? m.exportValue(r.original) : m.filterLabel && v != null && v !== '' ? m.filterLabel(v) : v;
      });
      return o;
    });
    const suffix = range.from || range.to ? `${range.from || 'awal'}_sd_${range.to || 'akhir'}` : new Date().toISOString().slice(0, 10);
    const filt = [
      ...filters.map((f) => { const col = table.getColumn(f.id); if (!col) return ''; const m = metaOf(col); return `${labelOf(col)}: ${m.filterLabel ? m.filterLabel(f.value) : String(f.value)}`; }),
      search ? `pencarian "${search}"` : '',
    ].filter(Boolean);
    const subtitle = [exportSubtitle || periodeLabel(range.from, range.to), filt.length ? `Filter: ${filt.join(', ')}` : ''].filter(Boolean).join(' · ');
    const tot: Record<string, unknown> | undefined = hasTotal ? Object.fromEntries(exportCols.map((c, i) => [labelOf(c), metaOf(c).total ? totals(c.id) : i === 0 ? `Total (${filtered.length})` : ''])) : undefined;
    exportXlsx(out, `${title.replace(/\s+/g, '_')}_${suffix}.xlsx`, title, {
      title: exportTitle || title, subtitle, totals: tot,
      money: exportCols.filter((c) => metaOf(c).money).map((c) => labelOf(c)),
    }).catch((e) => toast('Gagal export: ' + ((e as Error)?.message || e), 'err'));
  };

  const resetAll = () => { setSearch(''); setFilters([]); setRange(rangeFor('semua')); };

  return (
    <div className="card overflow-hidden">
      {/* toolbar */}
      <div className="flex flex-col gap-3 border-b border-line p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input id={`${storageKey}-search`} className="input pl-9" placeholder={searchPlaceholder} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {dateField && <DateRangeFilter value={range} onChange={setRange} id={`${storageKey}-range`} />}
          <div className="relative" ref={colRef}>
            <button className="btn" onClick={() => setColMenu((o) => !o)} aria-expanded={colMenu} title="Pilih kolom"><Columns3 size={16} /><span className="hidden sm:inline">Kolom</span></button>
            {colMenu && (
              <div className="absolute right-0 z-20 mt-2 max-h-72 w-56 overflow-y-auto rounded-xl border border-line bg-surface p-2 shadow-xl">
                {table.getAllLeafColumns().filter((c) => c.getCanHide()).map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-sunk">
                    <input type="checkbox" className="accent-[rgb(var(--brand))]" checked={c.getIsVisible()} onChange={c.getToggleVisibilityHandler()} />{labelOf(c)}
                  </label>
                ))}
              </div>
            )}
          </div>
          {canExport && <button className="btn btn-excel" onClick={doExport} disabled={!filtered.length} title="Export ke Excel sesuai filter"><Download size={16} /><span className="hidden sm:inline">Excel</span></button>}
          {toolbar}
        </div>
        {(selectCols.length > 0 || activeFilters > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            {selectCols.map((c) => {
              const m = metaOf(c);
              const opts = Array.from(c.getFacetedUniqueValues().keys()).filter((v) => v !== '' && v != null).sort((a, b) => String(m.filterLabel ? m.filterLabel(a) : a).localeCompare(String(m.filterLabel ? m.filterLabel(b) : b)));
              const val = (c.getFilterValue() as string) ?? '';
              return (
                <select key={c.id} id={`${storageKey}-f-${c.id}`} aria-label={`Filter ${labelOf(c)}`} value={val} onChange={(e) => c.setFilterValue(e.target.value === '' ? undefined : e.target.value)}
                  className={`input w-auto py-1.5 text-xs ${val !== '' ? 'border-brand text-brand' : ''}`}>
                  <option value="">{labelOf(c)}: semua</option>
                  {opts.map((o) => <option key={String(o)} value={String(o)}>{m.filterLabel ? m.filterLabel(o) : String(o)}</option>)}
                </select>
              );
            })}
            {activeFilters > 0 && <button className="btn btn-ghost btn-sm" onClick={resetAll}><X size={14} />Hapus filter</button>}
          </div>
        )}
      </div>

      {/* tabel (tablet & desktop) */}
      <div className="hidden overflow-x-auto md:block">
        <table className="tbl w-full border-collapse text-[13px]">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const m = metaOf(h.column);
                  const sort = h.column.getIsSorted();
                  return (
                    <th key={h.id} className={`whitespace-nowrap border-b border-line bg-sunk px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted ${m.align === 'right' ? 'text-right' : m.align === 'center' ? 'text-center' : 'text-left'}`}>
                      {h.isPlaceholder ? null : h.column.getCanSort() ? (
                        <button className={`inline-flex items-center gap-1 uppercase hover:text-ink ${m.align === 'right' ? 'flex-row-reverse' : ''}`} onClick={h.column.getToggleSortingHandler()}>
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sort === 'asc' ? <ArrowUp size={12} /> : sort === 'desc' ? <ArrowDown size={12} /> : <ArrowUpDown size={12} className="opacity-30" />}
                        </button>
                      ) : flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading && <tr><td colSpan={leafCols.length} className="px-3 py-10 text-center text-muted">Memuat data…</td></tr>}
            {!loading && !pageRows.length && <tr><td colSpan={leafCols.length} className="px-3 py-10 text-center text-muted">{activeFilters ? 'Tidak ada data yang cocok dengan filter.' : emptyText}</td></tr>}
            {!loading && pageRows.map((r) => (
              <tr key={r.id} onClick={onRowClick ? () => onRowClick(r.original) : undefined} className={`border-b border-line last:border-0 ${onRowClick ? 'cursor-pointer hover:bg-sunk' : ''}`}>
                {r.getVisibleCells().map((c) => {
                  const m = metaOf(c.column);
                  const out = flexRender(c.column.columnDef.cell, c.getContext());
                  const v = c.getValue();
                  const empty = !(typeof v === 'number' && v !== 0); // sel kosong/nol tidak diberi "Rp"
                  return <td key={c.id} className={`px-3 py-2.5 align-top ${m.align === 'right' ? 'num text-right' : m.align === 'center' ? 'text-center' : ''} ${m.className || ''}`}>{m.money && !empty ? <Money>{out}</Money> : out}</td>;
                })}
              </tr>
            ))}
          </tbody>
          {hasTotal && !loading && filtered.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-ink/80 bg-sunk/60 font-bold">
                {leafCols.map((c, i) => {
                  const m = metaOf(c);
                  return <td key={c.id} className={`px-3 py-2.5 ${m.align === 'right' ? 'num text-right' : ''}`}>{m.total ? (m.money ? <Money v={totals(c.id)} /> : nf(totals(c.id))) : i === 0 ? `Total (${filtered.length})` : ''}</td>;
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* kartu (HP) */}
      <div className="divide-y divide-line md:hidden">
        {loading && <div className="p-6 text-center text-sm text-muted">Memuat data…</div>}
        {!loading && !pageRows.length && <div className="p-6 text-center text-sm text-muted">{activeFilters ? 'Tidak ada data yang cocok dengan filter.' : emptyText}</div>}
        {!loading && pageRows.map((r) => {
          const cells = r.getVisibleCells();
          const [first, ...rest] = cells;
          return (
            <div key={r.id} className={`p-4 ${onRowClick ? 'cursor-pointer active:bg-sunk' : ''}`} onClick={onRowClick ? () => onRowClick(r.original) : undefined}>
              <div className="mb-2 font-bold">{cardTitle ? cardTitle(r.original) : flexRender(first.column.columnDef.cell, first.getContext())}</div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
                {(cardTitle ? cells : rest).filter((c) => !metaOf(c.column).hideOnCard).map((c) => (
                  <div key={c.id} className="contents">
                    <dt className="text-muted">{labelOf(c.column)}</dt>
                    <dd className={`min-w-0 text-right ${metaOf(c.column).align === 'right' ? 'num' : ''}`}>{metaOf(c.column).money && typeof c.getValue() === 'number' && c.getValue() !== 0 ? <>Rp&nbsp;{flexRender(c.column.columnDef.cell, c.getContext())}</> : flexRender(c.column.columnDef.cell, c.getContext())}</dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        })}
        {hasTotal && !loading && filtered.length > 0 && (
          <div className="bg-sunk/60 p-4 text-[13px] font-bold">
            {leafCols.filter((c) => metaOf(c).total).map((c) => (
              <div key={c.id} className="flex justify-between"><span>Total {labelOf(c)}</span><span className="num">{metaOf(c).money ? 'Rp ' : ''}{nf(totals(c.id))}</span></div>
            ))}
          </div>
        )}
      </div>

      {/* pagination */}
      <div className="flex flex-col gap-3 border-t border-line px-3 py-3 text-[13px] sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="flex items-center gap-2 text-muted">
          <span>Tampilkan</span>
          <select id={`${storageKey}-pagesize`} aria-label="Jumlah baris" className="input w-auto py-1 text-[13px]" value={pagination.pageSize}
            onChange={(e) => setPagination({ pageIndex: 0, pageSize: Number(e.target.value) })}>
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n || 'Semua'}</option>)}
          </select>
          <span className="num">{start}–{end} dari {nf(filtered.length)}{filtered.length !== data.length ? ` (total ${nf(data.length)})` : ''}</span>
        </div>
        {pagination.pageSize > 0 && pageCount > 1 && (
          <div className="flex items-center gap-1">
            <button className="btn btn-sm px-2" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()} aria-label="Halaman pertama"><ChevronsLeft size={15} /></button>
            <button className="btn btn-sm px-2" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Sebelumnya"><ChevronLeft size={15} /></button>
            <span className="num px-2 text-muted">Hal. {pi + 1} / {pageCount}</span>
            <button className="btn btn-sm px-2" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Berikutnya"><ChevronRight size={15} /></button>
            <button className="btn btn-sm px-2" onClick={() => table.setPageIndex(pageCount - 1)} disabled={!table.getCanNextPage()} aria-label="Halaman terakhir"><ChevronsRight size={15} /></button>
          </div>
        )}
      </div>
    </div>
  );
}
