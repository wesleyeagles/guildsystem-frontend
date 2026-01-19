import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { ProductsApi, Product } from '../../api/products.api';

function parseTimesParam(value: string | null): number[] {
  if (!value) return [];
  return value
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

@Component({
  standalone: true,
  template: `
    <div class="max-w-6xl">
      <div class="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 class="text-3xl font-bold">Home</h1>
          <p class="text-slate-300">
            @if (times().length > 0) {
              Filtrando por time(s): {{ times().join(', ') }}
            } @else {
              Todos os produtos (sem filtro)
            }
          </p>
        </div>

        <div class="text-sm text-slate-300 mt-2">
          {{ userLabel() }}
        </div>
      </div>

      @if (loading()) {
        <div class="p-4 rounded-2xl border border-slate-800 bg-slate-900/30">
          Carregando produtos...
        </div>
      } @else if (error()) {
        <div class="p-4 rounded-2xl border border-red-900/60 bg-red-950/30 text-red-200">
          {{ error() }}
          <button class="ml-3 px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800" (click)="reload()">
            Tentar novamente
          </button>
        </div>
      } @else {
        @if (filteredProducts().length === 0) {
          <div class="p-4 rounded-2xl border border-slate-800 bg-slate-900/30 text-slate-300">
            Nenhum produto encontrado.
          </div>
        } @else {
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            @for (p of filteredProducts(); track p.id) {
              <div class="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 hover:bg-slate-900/60 transition">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <div class="text-lg font-semibold">{{ p.name }}</div>
                    <div class="text-xs text-slate-400 mt-1">
                      ansible: <span class="text-slate-300">{{ p.ansibleName }}</span>
                    </div>
                  </div>
                  <span class="text-xs px-2 py-1 rounded-full border border-slate-700 text-slate-300">
                    #{{ p.id }}
                  </span>
                </div>

                <div class="mt-4 space-y-1 text-sm text-slate-300">
                  <div class="flex gap-2">
                    <span class="text-slate-400 w-24">Fornecedor</span>
                    <span>{{ p.company?.name ?? ('ID ' + p.companyId) }}</span>
                  </div>
                  <div class="flex gap-2">
                    <span class="text-slate-400 w-24">Time</span>
                    <span>
                      {{ p.team?.name ?? ('ID ' + p.teamId) }}
                      @if (p.team?.uor) { <span class="text-slate-500">• UOR {{ p.team?.uor }}</span> }
                    </span>
                  </div>
                </div>
              </div>
            }
          </div>
        }
      }
    </div>
  `,
})
export class HomePage {
  private auth = inject(AuthService);
  private api = inject(ProductsApi);
  private route = inject(ActivatedRoute);

  products = signal<Product[]>([]);
  loading = signal(true);
  error = signal('');

  // lê o query param time e mantém reativo
  times = signal<number[]>(parseTimesParam(this.route.snapshot.queryParamMap.get('time')));

  userLabel = computed(() => {
    const u = this.auth.userSig();
    return u ? `${u.email} • ${u.scope}` : '';
  });

  filteredProducts = computed(() => {
    const times = this.times();
    const list = this.products();

    // sem ?time= -> sem filtro (mostra tudo)
    if (times.length === 0) return list;

    return list.filter((p) => {
      const uor = p.team?.uor;
      return typeof uor === 'number' && times.includes(uor);
    });
  });

  constructor() {
    // atualizar quando a URL mudar (ex: compartilhar link/editar query)
    this.route.queryParamMap.subscribe((m) => {
      this.times.set(parseTimesParam(m.get('time')));
    });

    this.reload();
  }

  reload() {
    this.loading.set(true);
    this.error.set('');

    this.api.list().subscribe({
      next: (data) => this.products.set(data),
      error: (e) => {
        const msg = e?.error?.message;
        this.error.set(Array.isArray(msg) ? msg.join(', ') : msg ?? 'Falha ao carregar produtos');
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }
}
