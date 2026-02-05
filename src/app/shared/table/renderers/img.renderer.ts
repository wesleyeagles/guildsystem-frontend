import type { ICellRendererParams } from 'ag-grid-community';
import { joinUrl } from '../table.utils';

export const imgRenderer =
  <T>(baseUrl: string, rgbFromRow: (row: T) => string) =>
  (params: ICellRendererParams<T>) => {
    const row = params.data as T | null | undefined;
    const path = params.value as string | null | undefined;

    if (!path || !row) return '';

    const url = /^https?:\/\//i.test(path) ? path : joinUrl(baseUrl, path);
    const rgb = rgbFromRow(row);

    return `
      <div class="cell-center">
        <div class="img-frame" style="--rgb:${rgb}">
          <img src="${url}" class="img-icon" loading="lazy" />
        </div>
      </div>
    `;
  };
