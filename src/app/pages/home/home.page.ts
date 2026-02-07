import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

type NewsTag = 'Anúncio' | 'Patch' | 'Evento' | 'Guia' | 'Sistema' | 'Devlog';

type NewsPost = {
  id: number;
  title: string;
  isImportant?: boolean;
  text: string;
  tag: NewsTag;
  createdAt: string;
};

function parseTime(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function fmtDatePtBR(iso: string) {
  const ms = parseTime(iso);
  if (!ms) return '—';
  const d = new Date(ms);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

@Component({
  standalone: true,
  selector: 'app-home-page',
  imports: [CommonModule],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  posts = signal<NewsPost[]>([
    {
      id: 1,
      title: 'Início da marcação de pontos',
      tag: 'Anúncio',
      isImportant: true,
      createdAt: '2026-02-07T21:25:00.000Z',
      text: 'Os objetivos começarão a valer ponto a partir da CW1 (06:00) do dia 08/02/2026',
    },
  ]);

  sorted = computed(() => {
    return [...this.posts()].sort((a, b) => (parseTime(b.createdAt) ?? 0) - (parseTime(a.createdAt) ?? 0));
  });

  fmtDate(iso: string) {
    return fmtDatePtBR(iso);
  }

  trackById(_: number, p: NewsPost) {
    return p.id;
  }
}
