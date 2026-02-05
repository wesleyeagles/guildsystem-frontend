import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import {
  GridApi,
  GridReadyEvent,
  type GridOptions,
  type IRowNode,
} from 'ag-grid-community';
import { AgGridAngular } from 'ag-grid-angular';

import { DEFAULT_COL_DEF, DEFAULT_TABLE_THEME } from './table.defaults';
import type { ChipFilterConfig, DataTableConfig, DataTableState } from './table.types';

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule, AgGridAngular],
  templateUrl: './data-table.component.html',
  styleUrls: ['./data-table.component.scss'],
})
export class DataTableComponent<T> {
  @Input({ required: true }) rowData: T[] = [];
  @Input({ required: true }) config!: DataTableConfig<T>;

  private gridApi!: GridApi<T>;
  gridReady = false;

  state: DataTableState = {
    quickFilterText: '',
    selectedByFilter: {},
  };

  pageIndex = 0;
  totalPages = 1;
  rowRangeText = '';
  pageSizeComputed = 0;

  get theme() {
    return this.config?.theme ?? DEFAULT_TABLE_THEME;
  }

  get defaultColDef() {
    return this.config?.defaultColDef ?? DEFAULT_COL_DEF;
  }

  get rowHeight() {
    return this.config?.rowHeight ?? 65;
  }

  get showSearch() {
    return this.config?.ui?.showSearch ?? true;
  }

  get showPager() {
    return this.config?.ui?.showPager ?? true;
  }

  get showChips() {
    const flag = this.config?.ui?.showChips;
    if (flag === false) return false;
    return this.normalizedChipFilters.length > 0;
  }

  get paginationEnabled() {
    return this.config?.pagination?.enabled ?? true;
  }

  get paginationAutoPageSize() {
    return this.config?.pagination?.autoPageSize ?? true;
  }

  /** ✅ FIX: context aplicado direto no ag-grid, desde o começo */
  get gridContext(): any {
    return this.config?.gridOptions?.context ?? {};
  }

  // --- chips: normaliza (novo/legado)
  get normalizedChipFilters(): ChipFilterConfig<T>[] {
    const cfg = this.config;
    if (!cfg) return [];

    if (Array.isArray(cfg.chipFilters) && cfg.chipFilters.length) return cfg.chipFilters;

    if (cfg.chipFilter) {
      return [
        {
          id: 'default',
          ...cfg.chipFilter,
        },
      ];
    }

    return [];
  }

  private ensureSet(filterId: string): Set<string> {
    const map = this.state.selectedByFilter;
    if (!map[filterId]) map[filterId] = new Set<string>();
    return map[filterId];
  }

  chipOptions(filter: ChipFilterConfig<T>) {
    const list = filter.options ?? [];
    return filter.optionFilter ? list.filter(filter.optionFilter) : list;
  }

  toggleChip(filterId: string, opt: string) {
    const set = this.ensureSet(filterId);
    if (set.has(opt)) set.delete(opt);
    else set.add(opt);

    this.gridApi?.onFilterChanged();
    this.gridApi?.paginationGoToFirstPage();
    this.syncPagination();
  }

  clearChips(filterId: string) {
    this.ensureSet(filterId).clear();

    this.gridApi?.onFilterChanged();
    this.gridApi?.paginationGoToFirstPage();
    this.syncPagination();
  }

  isChipActive(filterId: string, opt: string) {
    return this.ensureSet(filterId).has(opt);
  }

  isAllActive(filterId: string) {
    return this.ensureSet(filterId).size === 0;
  }

  chipRgb(filter: ChipFilterConfig<T>, opt: string) {
    return filter.rgbByOption?.(opt) ?? '148, 163, 184';
  }

  // --- external filter (ag-grid)
  isExternalFilterPresent = () => {
    const cfg = this.config;
    if (!cfg) return false;

    if (cfg.externalFilter) return cfg.externalFilter.isPresent(this.state);

    // default: se houver qualquer seleção em qualquer grupo
    return this.normalizedChipFilters.some((f) => this.ensureSet(f.id).size > 0);
  };

  doesExternalFilterPass = (node: IRowNode<T>) => {
    const row = node.data as T | null | undefined;
    if (!row) return true;

    const cfg = this.config;
    if (!cfg) return true;

    if (cfg.externalFilter) return cfg.externalFilter.doesPass(row, this.state, node);

    // default: AND entre filtros
    for (const f of this.normalizedChipFilters) {
      const selected = this.ensureSet(f.id);
      if (selected.size === 0) continue;

      const value = f.getValue(row) ?? 'Unknown';
      if (!selected.has(value)) return false;
    }

    return true;
  };

  // --- quick filter
  onQuickFilter(text: string) {
    this.state.quickFilterText = text;
    if (!this.gridApi) return;

    this.gridApi.setGridOption('quickFilterText', text);
    this.gridApi.paginationGoToFirstPage();
    this.syncPagination();
  }

  // --- grid lifecycle
  onGridReady(ev: GridReadyEvent<T>) {
    this.gridApi = ev.api;
    this.gridReady = true;

    this.gridApi.setGridOption('pagination', this.paginationEnabled);
    this.gridApi.setGridOption('paginationAutoPageSize', this.paginationAutoPageSize);
    this.gridApi.setGridOption('suppressPaginationPanel', true);

    this.gridApi.setGridOption('rowSelection', undefined);
    this.gridApi.setGridOption('suppressRowClickSelection', true);
    this.gridApi.setGridOption('rowMultiSelectWithClick', false);
    this.gridApi.setGridOption('suppressCellFocus', true);

    this.gridApi.setGridOption('overlayNoRowsTemplate', 'Nenhum registro encontrado');

    // ✅ aplica gridOptions, mas NÃO tenta setar context por aqui
    const go = this.config?.gridOptions as GridOptions<T> | undefined;
    const userOnGridReady = go?.onGridReady;

    if (go) {
      const { context, onGridReady, ...rest } = go;
      Object.entries(rest).forEach(([k, v]) => {
        // @ts-expect-error
        this.gridApi.setGridOption(k, v);
      });
    }

    this.syncPagination();

    this.gridApi.addEventListener('paginationChanged', () => this.syncPagination());
    this.gridApi.addEventListener('gridSizeChanged', () => this.syncPagination());
    this.gridApi.addEventListener('modelUpdated', () => this.syncPagination());


    // ✅ mantém compat com quem usa (EventsAdminPage)
    userOnGridReady?.(ev as any);
  }

  syncPagination() {
    if (!this.gridApi) return;

    const totalRows = this.gridApi.getDisplayedRowCount();
    this.pageIndex = this.gridApi.paginationGetCurrentPage();
    this.totalPages = Math.max(1, this.gridApi.paginationGetTotalPages());
    this.pageSizeComputed = this.gridApi.paginationGetPageSize();

    if (totalRows === 0) {
      this.rowRangeText = '0 de 0';
      return;
    }

    const start = this.pageIndex * this.pageSizeComputed + 1;
    const end = Math.min((this.pageIndex + 1) * this.pageSizeComputed, totalRows);
    this.rowRangeText = `${start}–${end} de ${totalRows}`;
  }

  goPrev() {
    this.gridApi.paginationGoToPreviousPage();
  }

  goNext() {
    this.gridApi.paginationGoToNextPage();
  }
}
