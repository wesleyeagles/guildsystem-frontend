// src/app/pages/items/ui/image-picker.component.ts
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { ItemsCatalogApi, type CatalogItemDto, type CatalogType } from '../../../../api/items-catalog.api';

type PageState = {
  cursor: string | null;
  nextCursor: string | null;
  items: CatalogItemDto[];
};

@Component({
  standalone: true,
  selector: 'app-image-picker',
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './image-picker.component.scss',
  templateUrl: './image-picker.component.html',
})
export class ImagePickerComponent {
  private catalog = inject(ItemsCatalogApi);

  @Input() label = 'Imagem';
  @Input() disabled = false;
  @Input() currentPath: string | null = null;

  @Output() pickedPath = new EventEmitter<string | null>();
  @Output() pickedFile = new EventEmitter<File>();

  open = signal(false);
  tab = signal<'library' | 'upload'>('library');

  catalogType: CatalogType = 'weapon';
  q = '';

  loading = signal(false);
  error = signal<string | null>(null);

  private fileSig = signal<File | null>(null);
  private fileUrlSig = signal<string | null>(null);

  private pagesSig = signal<PageState[]>([]);
  private pageIndexSig = signal(0);

  pageIndex() {
    return this.pageIndexSig();
  }

  pageItems() {
    const pages = this.pagesSig();
    const idx = this.pageIndexSig();
    return pages[idx]?.items ?? [];
  }

  currentFile() {
    return this.fileSig();
  }

  ngOnInit() {
    this.resetAndLoad();
  }

  close() {
    this.open.set(false);
  }

  clear() {
    this.setFile(null);
    this.pickedPath.emit(null);
    this.close();
  }

  previewUrl(): string | null {
    const fUrl = this.fileUrlSig();
    if (fUrl) return fUrl;
    return this.catalog.resolveImageUrl(this.currentPath);
  }

  img(path: string | null): string | null {
    return this.catalog.resolveImageUrl(path);
  }

  trackKey(it: CatalogItemDto) {
    return `${it.itemType}:${it.itemId}`;
  }

  resetAndLoad() {
    this.pagesSig.set([]);
    this.pageIndexSig.set(0);
    void this.loadPage(0, null);
  }

  canNextPage() {
    const pages = this.pagesSig();
    const idx = this.pageIndexSig();
    const cur = pages[idx];
    if (!cur) return false;
    if (!cur.nextCursor) return false;
    return true;
  }

  prevPage() {
    const idx = this.pageIndexSig();
    if (idx <= 0) return;
    this.pageIndexSig.set(idx - 1);
  }

  async nextPage() {
    const idx = this.pageIndexSig();
    const pages = this.pagesSig();
    const cur = pages[idx];
    if (!cur?.nextCursor) return;

    const nextIdx = idx + 1;
    if (pages[nextIdx]) {
      this.pageIndexSig.set(nextIdx);
      return;
    }

    await this.loadPage(nextIdx, cur.nextCursor);
    this.pageIndexSig.set(nextIdx);
  }

  private async loadPage(index: number, cursor: string | null) {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(null);

    try {
      const res = await firstValueFrom(
        this.catalog.search({
          type: this.catalogType,
          q: this.q || null,
          limit: 40,
          cursor,
        }),
      );

      const items = Array.isArray(res.items) ? res.items : [];
      const nextCursor = res.nextCursor ?? null;

      const pages = this.pagesSig().slice();
      pages[index] = { cursor, nextCursor, items };
      this.pagesSig.set(pages);
    } catch (e: any) {
      const msg = e?.error?.message || e?.message || 'Falha ao carregar catálogo';
      this.error.set(String(msg));
      const pages = this.pagesSig().slice();
      pages[index] = { cursor, nextCursor: null, items: [] };
      this.pagesSig.set(pages);
    } finally {
      this.loading.set(false);
    }
  }

  pickPath(path: string | null) {
    if (!path) return;
    this.setFile(null);
    this.pickedPath.emit(path);
    this.close();
  }

  onFileChange(ev: any) {
    const file: File | null = ev?.target?.files?.[0] ?? null;
    if (!file) return;
    this.setFile(file);
    this.pickedFile.emit(file);
  }

  private setFile(file: File | null) {
    const prevUrl = this.fileUrlSig();
    if (prevUrl) URL.revokeObjectURL(prevUrl);

    this.fileSig.set(file);

    if (file) this.fileUrlSig.set(URL.createObjectURL(file));
    else this.fileUrlSig.set(null);
  }
}
