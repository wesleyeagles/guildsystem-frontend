import type { ColDef, GridOptions, IRowNode } from 'ag-grid-community';

export interface ChipFilterConfig<T> {
  /** id único do grupo de chips (ex: 'grade', 'race', 'class') */
  id: string;

  /** label opcional exibido antes do grupo (ex: 'Grade', 'Raça') */
  label?: string;

  /** texto do botão “Todos” */
  allLabel?: string; // default: 'Todos'

  /** opções exibidas como chips */
  options: string[];

  /** extrai o valor do item que será comparado com a seleção */
  getValue: (row: T) => string;

  /** cor opcional por opção (RGB "r, g, b") */
  rgbByOption?: (opt: string) => string;

  /** filtra opções exibidas */
  optionFilter?: (opt: string) => boolean;
}

export interface ExternalFilterConfig<T> {
  isPresent: (state: DataTableState) => boolean;
  doesPass: (row: T, state: DataTableState, node: IRowNode<T>) => boolean;
}

export interface DataTableState {
  quickFilterText: string;
  /** seleções por grupo de chips */
  selectedByFilter: Record<string, Set<string>>;
}

export interface DataTableConfig<T> {
  id?: string;

  colDefs: ColDef<T>[];

  theme?: any;
  defaultColDef?: ColDef<T>;
  rowHeight?: number;

  quickFilterPlaceholder?: string;

  /** novo: múltiplos grupos de chips */
  chipFilters?: ChipFilterConfig<T>[];

  /**
   * legado (se você já tinha isso). Ainda suportado:
   * será convertido internamente em chipFilters:[{id:'default',...}]
   */
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
  };
}
