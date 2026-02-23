import { themeQuartz, type ColDef } from 'ag-grid-community';

export const DEFAULT_COL_DEF: ColDef = {
  resizable: false,
  sortable: true,
  cellStyle: {
    display: 'flex',
    alignItems: 'center',
  },
};

export const DEFAULT_TABLE_THEME = themeQuartz.withParams({
  accentColor: '#00FEFF',
  backgroundColor: 'hsl(222 25% 11%)',
  browserColorScheme: 'dark',
  foregroundColor: '#E2E8F0',
  headerFontSize: 13,
});
