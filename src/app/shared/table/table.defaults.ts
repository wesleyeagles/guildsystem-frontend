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
  backgroundColor: '#000000',
  browserColorScheme: 'light',
  foregroundColor: '#FFF',
  headerFontSize: 14,
});
