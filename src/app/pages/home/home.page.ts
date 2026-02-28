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
      id: 4,
      title: 'Doação de disena e troca de nickname',
      tag: 'Sistema',
      isImportant: true,
      createdAt: '2026-02-28T12:00:00.000Z',
      text: 'Duas novidades: agora é possível fazer doação de disena em troca de pontos — use a seção de doações para converter. Além disso, você pode trocar seu nickname direto pelo seu perfil: acesse seu perfil em "Membros", clique no ícone de lápis ao lado do nickname e edite quando quiser. O histórico de nicknames fica disponível na aba "Nicknames" do perfil.',
    },
    {
      id: 2,
      title: 'Novo layout do sistema',
      tag: 'Sistema',
      isImportant: true,
      createdAt: '2026-02-23T12:00:00.000Z',
      text: 'O painel da guild passou por uma atualização visual: nova interface mais limpa, botões e formulários padronizados, cores e temas unificados em todas as telas (eventos, objetivos, leilões, membros). A navegação pela sidebar e as tabelas também foram melhoradas.',
    },
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
