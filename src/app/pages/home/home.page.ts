import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../auth/auth.service';
import { NewsApi, NEWS_POST_TAGS, type NewsPostDto, type NewsPostTag } from '../../api/news.api';
import { UiModalComponent } from '../../ui/modal/ui-modal.component';
import { UiConfirmDialogComponent } from '../../ui/modal/ui-confirm-dialog.component';

function parseTime(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function fmtDatePtBR(iso: string) {
  const ms = parseTime(iso);
  if (!ms) {
    return '—';
  }
  const d = new Date(ms);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

@Component({
  standalone: true,
  selector: 'app-home-page',
  imports: [CommonModule, FormsModule, UiModalComponent, UiConfirmDialogComponent],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage implements OnInit {
  private newsApi = inject(NewsApi);
  private auth = inject(AuthService);

  posts = signal<NewsPostDto[]>([]);
  loading = signal(false);
  loadError = signal<string | null>(null);

  newsModalOpen = signal(false);
  newsModalMode = signal<'create' | 'edit'>('create');
  editingId = signal<number | null>(null);

  saving = signal(false);
  modalError = signal<string | null>(null);

  deleteConfirmOpen = signal(false);
  pendingDeleteId = signal<number | null>(null);
  deleting = signal(false);
  deleteError = signal<string | null>(null);

  tagOptions = NEWS_POST_TAGS;

  form = {
    title: '',
    text: '',
    tag: 'Sistema' as NewsPostTag,
    isImportant: false,
  };

  readonly canCreateNews = computed(() => {
    const s = this.auth.userSig()?.scope;
    return s === 'admin' || s === 'root';
  });

  readonly sorted = computed(() => {
    return [...this.posts()].sort((a, b) => (parseTime(b.createdAt) ?? 0) - (parseTime(a.createdAt) ?? 0));
  });

  modalConfirmDisabled() {
    return !this.form.title.trim() || !this.form.text.trim() || this.saving();
  }

  modalTitle() {
    return this.newsModalMode() === 'edit' ? 'Editar notícia' : 'Nova notícia';
  }

  modalConfirmText() {
    return this.newsModalMode() === 'edit' ? 'Salvar' : 'Publicar';
  }

  ngOnInit() {
    this.refreshList();
  }

  refreshList() {
    const hadPosts = this.posts().length > 0;
    if (!hadPosts) {
      this.loading.set(true);
    }
    this.loadError.set(null);
    this.newsApi.list().subscribe({
      next: (rows) => {
        this.posts.set(rows);
        if (!hadPosts) {
          this.loading.set(false);
        }
      },
      error: () => {
        this.loadError.set('Não foi possível carregar as notícias.');
        if (!hadPosts) {
          this.loading.set(false);
        }
      },
    });
  }

  openCreate() {
    this.modalError.set(null);
    this.newsModalMode.set('create');
    this.editingId.set(null);
    this.form = {
      title: '',
      text: '',
      tag: 'Sistema',
      isImportant: false,
    };
    this.newsModalOpen.set(true);
  }

  openEdit(p: NewsPostDto) {
    this.modalError.set(null);
    this.newsModalMode.set('edit');
    this.editingId.set(p.id);
    this.form = {
      title: p.title,
      text: p.text,
      tag: p.tag,
      isImportant: p.isImportant,
    };
    this.newsModalOpen.set(true);
  }

  closeNewsModal() {
    if (this.saving()) {
      return;
    }
    this.newsModalOpen.set(false);
  }

  submitNewsModal() {
    if (this.modalConfirmDisabled()) {
      return;
    }
    const body = {
      title: this.form.title.trim(),
      text: this.form.text.trim(),
      tag: this.form.tag,
      isImportant: this.form.isImportant,
    };
    this.saving.set(true);
    this.modalError.set(null);

    const mode = this.newsModalMode();
    if (mode === 'create') {
      this.newsApi.create(body).subscribe({
        next: () => {
          this.saving.set(false);
          this.newsModalOpen.set(false);
          this.refreshList();
        },
        error: () => {
          this.saving.set(false);
          this.modalError.set('Não foi possível criar a notícia. Verifique se você tem permissão.');
        },
      });
      return;
    }

    const id = this.editingId();
    if (id == null) {
      this.saving.set(false);
      return;
    }
    this.newsApi.update(id, body).subscribe({
      next: () => {
        this.saving.set(false);
        this.newsModalOpen.set(false);
        this.refreshList();
      },
      error: () => {
        this.saving.set(false);
        this.modalError.set('Não foi possível salvar a notícia. Verifique se você tem permissão.');
      },
    });
  }

  openDeleteConfirm(p: NewsPostDto) {
    this.deleteError.set(null);
    this.pendingDeleteId.set(p.id);
    this.deleteConfirmOpen.set(true);
  }

  closeDeleteConfirm() {
    if (this.deleting()) {
      return;
    }
    this.deleteError.set(null);
    this.pendingDeleteId.set(null);
    this.deleteConfirmOpen.set(false);
  }

  confirmDelete() {
    const id = this.pendingDeleteId();
    if (id == null) {
      return;
    }
    this.deleting.set(true);
    this.newsApi.remove(id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.pendingDeleteId.set(null);
        this.deleteConfirmOpen.set(false);
        this.refreshList();
      },
      error: () => {
        this.deleting.set(false);
        this.deleteError.set('Não foi possível excluir. Verifique se você tem permissão.');
      },
    });
  }

  deleteConfirmMessage() {
    return this.deleteError() ?? 'Deseja excluir esta notícia? Esta ação não pode ser desfeita.';
  }

  fmtDate(iso: string) {
    return fmtDatePtBR(iso);
  }

  trackById(_: number, p: NewsPostDto) {
    return p.id;
  }
}
