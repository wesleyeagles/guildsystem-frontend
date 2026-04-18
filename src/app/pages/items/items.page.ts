import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ItemsStore } from './items.store';
import { ItemsApi, ITEM_CATEGORIES, type ItemCategory, type ItemDto } from '../../api/items.api';
import { ItemsToolbarComponent, ItemsToolbarFilters } from './ui/items-toolbar.component';
import { ItemsGridComponent } from './ui/items-grid.component';
import { ItemModalComponent, ItemModalResult } from './ui/item-modal/item-modal.component';
import { ItemsEditorService } from './data/items-editor.service';

type ItemGroup = { category: ItemCategory; items: ItemDto[] };

function groupByCategory(items: ItemDto[]): ItemGroup[] {
  const map = new Map<ItemCategory, ItemDto[]>();
  for (const cat of ITEM_CATEGORIES) map.set(cat, []);

  for (const it of items) {
    const arr = map.get(it.category);
    if (arr) arr.push(it);
    else map.set(it.category, [it]);
  }

  return ITEM_CATEGORIES.map((cat) => ({
    category: cat,
    items: (map.get(cat) ?? []).slice().sort((a, b) => b.id - a.id),
  })).filter((g) => g.items.length > 0);
}

@Component({
  standalone: true,
  selector: 'app-items-page',
  imports: [CommonModule, ItemsToolbarComponent, ItemsGridComponent, ItemModalComponent],
  templateUrl: './items.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemsPage {
  store = inject(ItemsStore);
  api = inject(ItemsApi);
  private editor = inject(ItemsEditorService);

  groups = computed(() => groupByCategory(this.store.items()));

  // modal state
  modalOpen = signal(false);
  modalMode = signal<'create' | 'edit'>('create');
  modalItem = signal<ItemDto | null>(null);

  ITEM_CATEGORIES = ITEM_CATEGORIES;

  isAdmin = signal(true);

  constructor() {
    void this.store.load();
  }

  // toolbar handlers
  onFiltersChange(f: ItemsToolbarFilters) {
    this.store.setQuery(
      {
        q: f.q?.trim() ? f.q.trim() : null,
        category: f.category ?? null,
        page: 1,
      },
      true,
    );
    void this.store.load();
  }

  onClearFilters() {
    this.store.resetFilters();
    void this.store.load();
  }

  onPrevPage() {
    const cur = this.store.query().page ?? 1;
    if (cur <= 1) return;
    this.store.setPage(cur - 1);
    void this.store.load();
  }

  onNextPage() {
    const cur = this.store.query().page ?? 1;
    const max = this.store.totalPages();
    if (cur >= max) return;
    this.store.setPage(cur + 1);
    void this.store.load();
  }

  // grid handlers
  onCreateClick() {
    this.modalMode.set('create');
    this.modalItem.set(null);
    this.modalOpen.set(true);
  }

  onEditClick(item: ItemDto) {
    this.modalMode.set('edit');
    this.modalItem.set(item);
    this.modalOpen.set(true);
  }

  async onDeleteClick(item: ItemDto) {
    const ok = confirm(`Deletar item #${item.id} (${item.name})?`);
    if (!ok) return;
    await this.store.remove(item.id);
    void this.store.load();
  }

  // modal handlers
  onModalClose() {
    this.modalOpen.set(false);
  }

  async onModalSave(result: ItemModalResult) {
    if (this.store.action() !== 'idle') return;

    // ✅ Centraliza no editor: ele faz upload (se tiver) e depois create/update
    if (result.mode === 'create') {
      const created = await this.editor.saveFromModal(result);
      // store já recebe via socket também; mas garantimos refresh
      void created;
      this.modalOpen.set(false);
      void this.store.load();
      return;
    }

    const updated = await this.editor.saveFromModal(result);
    void updated;
    this.modalOpen.set(false);
    void this.store.load();
  }

  img(it: ItemDto) {
    return this.api.resolveImageUrl(it.imagePath);
  }
}
