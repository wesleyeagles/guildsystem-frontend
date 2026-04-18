import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../auth/auth.service';
import { NewsApi, NEWS_POST_TAGS, type NewsPostDto, type NewsPostTag } from '../../api/news.api';
import { UiModalComponent } from '../../ui/modal/ui-modal.component';
import { UiConfirmDialogComponent } from '../../ui/modal/ui-confirm-dialog.component';
import { LucideAngularModule, Pencil, Trash2 } from 'lucide-angular';
import { QuillEditorComponent } from 'ngx-quill';
import { SafeNewsHtmlPipe } from '../../pipes/safe-news-html.pipe';

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

/** Abertura do servidor RF Reuleaux: 25/04/2026 06:00 (horário de Brasília). */
const SERVER_OPEN_TARGET_MS = new Date('2026-04-25T06:00:00-03:00').getTime();

interface LaunchCountdownParts {
  expired: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function computeLaunchCountdown(nowMs: number): LaunchCountdownParts {
  const diff = SERVER_OPEN_TARGET_MS - nowMs;
  if (diff <= 0) {
    return { expired: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
  }
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { expired: false, days, hours, minutes, seconds };
}

function newsBodyHasVisibleText(html: string): boolean {
  const plain = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > 0;
}

@Component({
  standalone: true,
  selector: 'app-home-page',
  imports: [CommonModule, FormsModule, UiModalComponent, UiConfirmDialogComponent, LucideAngularModule, QuillEditorComponent, SafeNewsHtmlPipe],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage implements OnInit, OnDestroy {
  private newsApi = inject(NewsApi);
  private auth = inject(AuthService);

  private launchCountdownTimer: ReturnType<typeof setInterval> | null = null;

  launchCountdown = signal<LaunchCountdownParts>(computeLaunchCountdown(Date.now()));

  readonly PencilIcon = Pencil;
  readonly TrashIcon = Trash2;

  readonly quillModules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      [{ align: [] }],
      ['blockquote'],
      ['link'],
      ['clean'],
    ],
  };

  readonly quillEditorStyles = { minHeight: '200px' };

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
    return !this.form.title.trim() || !newsBodyHasVisibleText(this.form.text) || this.saving();
  }

  modalTitle() {
    return this.newsModalMode() === 'edit' ? 'Editar notícia' : 'Nova notícia';
  }

  modalConfirmText() {
    return this.newsModalMode() === 'edit' ? 'Salvar' : 'Publicar';
  }

  ngOnInit() {
    this.refreshList();
    this.tickLaunchCountdown();
    this.launchCountdownTimer = setInterval(() => {
      this.tickLaunchCountdown();
    }, 1000);
  }

  ngOnDestroy() {
    if (this.launchCountdownTimer != null) {
      clearInterval(this.launchCountdownTimer);
      this.launchCountdownTimer = null;
    }
  }

  private tickLaunchCountdown() {
    this.launchCountdown.set(computeLaunchCountdown(Date.now()));
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
      text: typeof this.form.text === 'string' ? this.form.text.trim() : String(this.form.text ?? '').trim(),
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

  formatCountdownUnit(n: number): string {
    const s = String(Math.max(0, n));
    return s.length > 2 ? s : s.padStart(2, '0');
  }

  launchCountdownLine(): string {
    const c = this.launchCountdown();
    if (c.expired) {
      return 'O servidor já está aberto.';
    }
    return `${c.days} ${c.days === 1 ? 'dia' : 'dias'} ${c.hours} ${c.hours === 1 ? 'hora' : 'horas'} ${c.minutes} ${c.minutes === 1 ? 'minuto' : 'minutos'} e ${c.seconds} ${c.seconds === 1 ? 'segundo' : 'segundos'}`;
  }
}
