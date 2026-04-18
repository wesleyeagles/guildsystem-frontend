import { themeQuartz, type ColDef } from 'ag-grid-community';

export const DEFAULT_COL_DEF: ColDef = {
  resizable: false,
  sortable: true,
  cellStyle: {
    display: 'flex',
    alignItems: 'center',
  },
};

/** Alinhado a `styles.css` (--surface, --surface-2, --text) — evita o “azulado” do Quartz padrão. */
export const DEFAULT_TABLE_THEME = themeQuartz.withParams({
  accentColor: '#c9a227',
  backgroundColor: '#16130f',
  chromeBackgroundColor: '#1e1a15',
  dataBackgroundColor: '#16130f',
  browserColorScheme: 'dark',
  foregroundColor: '#f5efe6',
  headerBackgroundColor: '#1e1a15',
  headerTextColor: '#e8dfd2',
  headerFontSize: 13,
});
