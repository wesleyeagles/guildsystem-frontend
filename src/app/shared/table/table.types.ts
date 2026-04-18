import type { ColDef, GridOptions, IRowNode } from 'ag-grid-community';

export interface ChipFilterConfig<T> {
  id: string;
  label?: string;
  allLabel?: string;
  options: string[];
  getValue: (row: T) => string;
  rgbByOption?: (opt: string) => string;
  optionFilter?: (opt: string) => boolean;
}

export interface ExternalFilterConfig<T> {
  isPresent: (state: DataTableState) => boolean;
  doesPass: (row: T, state: DataTableState, node: IRowNode<T>) => boolean;
}

export interface DataTableState {
  quickFilterText: string;
  selectedByFilter: Record<string, Set<string>>;
}

export interface DataTableConfig<T> {
  id?: string;

  colDefs: ColDef<T>[];

  theme?: any;
  defaultColDef?: ColDef<T>;
  rowHeight?: number;

  quickFilterPlaceholder?: string;

  chipFilters?: ChipFilterConfig<T>[];

  chipFilter?: Omit<ChipFilterConfig<T>, 'id'>;

  externalFilter?: ExternalFilterConfig<T>;

  gridOptions?: GridOptions<T>;

  ui?: {
    showSearch?: boolean;
    showChips?: boolean;
    showPager?: boolean;
  };

  pagination?: {
    enabled?: boolean;
    autoPageSize?: boolean;
    pageSize?: number;
  };
}
