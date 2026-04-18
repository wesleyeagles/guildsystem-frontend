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
  imports: [CommonModule, FormsModule, UiModalComponent],
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

  createOpen = signal(false);
  saving = signal(false);
  createError = signal<string | null>(null);

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

  createConfirmDisabled() {
    return !this.form.title.trim() || !this.form.text.trim() || this.saving();
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
    this.createError.set(null);
    this.form = {
      title: '',
      text: '',
      tag: 'Sistema',
      isImportant: false,
    };
    this.createOpen.set(true);
  }

  closeCreate() {
    if (this.saving()) {
      return;
    }
    this.createOpen.set(false);
  }

  submitCreate() {
    if (this.createConfirmDisabled()) {
      return;
    }
    this.saving.set(true);
    this.createError.set(null);
    this.newsApi
      .create({
        title: this.form.title.trim(),
        text: this.form.text.trim(),
        tag: this.form.tag,
        isImportant: this.form.isImportant,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.createOpen.set(false);
          this.refreshList();
        },
        error: () => {
          this.saving.set(false);
          this.createError.set('Não foi possível criar a notícia. Verifique se você tem permissão.');
        },
      });
  }

  fmtDate(iso: string) {
    return fmtDatePtBR(iso);
  }

  trackById(_: number, p: NewsPostDto) {
    return p.id;
  }
}
