import { computed, signal } from '@angular/core';

export type PaginationController<T> = {
  page: ReturnType<typeof signal<number>>;
  pageSize: ReturnType<typeof signal<number>>;
  totalPages: ReturnType<typeof computed<number>>;
  paged: ReturnType<typeof computed<T[]>>;
  setPageSize: (size: number) => void;
  reset: () => void;
  prev: () => void;
  next: () => void;
};

export function createPagination<T>(opts: {
  source: () => readonly T[];
  pageSizes: readonly number[];
  initialPageSize?: number;
}): PaginationController<T> {
  const allowed = new Set<number>(opts.pageSizes as number[]);
  const initial = allowed.has(opts.initialPageSize ?? opts.pageSizes[0] ?? 10) ? (opts.initialPageSize ?? opts.pageSizes[0] ?? 10) : 10;

  const page = signal(1);
  const pageSize = signal(initial);

  const totalPages = computed(() => {
    const total = opts.source().length;
    const size = pageSize();
    const pages = Math.max(1, Math.ceil(total / size));

    // Mantém page sempre dentro do range
    if (page() > pages) page.set(pages);

    return pages;
  });

  const paged = computed(() => {
    const list = opts.source();
    const size = pageSize();
    const p = page();
    const start = (p - 1) * size;
    return list.slice(start, start + size) as T[];
  });

  function setPageSize(size: number) {
    const next = allowed.has(size) ? size : initial;
    pageSize.set(next);
    page.set(1);
  }

  function reset() {
    page.set(1);
  }

  function prev() {
    if (page() <= 1) return;
    page.set(page() - 1);
  }

  function next() {
    const max = totalPages();
    if (page() >= max) return;
    page.set(page() + 1);
  }

  return { page, pageSize, totalPages, paged, setPageSize, reset, prev, next };
}
