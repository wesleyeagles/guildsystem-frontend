import { Component, EventEmitter, Input, Output, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive } from '@angular/router';
import {
  LucideAngularModule,
  House,
  Link as LinkIcon,
  SlidersHorizontal,
  X,
  ChevronLeft,
  ChevronRight,
  Tags,
  Zap,
  Sword,
  Shirt,
  HardHat,
  Hand,
  Footprints,
} from 'lucide-angular';
import { trousers } from '@lucide/lab';
import { TeamsApi, Team } from '../../api/teams.api';
import { AuthService } from '../../auth/auth.service';

function parseTimesParam(value: string | null): number[] {
  if (!value) return [];
  return value
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function toTimesParam(times: number[]) {
  return times.join(',');
}

@Component({
  standalone: true,
  imports: [RouterLink, RouterLinkActive, LucideAngularModule],
  selector: 'app-sidebar',
  template: `
    <aside
      class="fixed top-0 left-0 h-screen pt-16 border-r border-slate-800 bg-slate-950/70 backdrop-blur overflow-hidden z-20
             transition-[width] duration-300 ease-in-out"
      [class.w-72]="!collapsed"
      [class.w-20]="collapsed"
    >
      <div class="h-full flex flex-col">
        <!-- Navegação + botão -->
        <div class="px-2 pt-3">
          @if (!collapsed) {
            <div class="flex items-center justify-between px-2 py-2">
              <div class="text-xs uppercase tracking-wide text-slate-500">Navegação</div>

              <button
                class="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800"
                (click)="toggle.emit()"
                [attr.aria-label]="'Colapsar sidebar'"
                title="Colapsar"
              >
                <lucide-icon [img]="CollapseIcon" class="w-4 h-4 text-slate-200"></lucide-icon>
              </button>
            </div>
          } @else {
            <div class="flex items-center justify-center px-2 py-2">
              <button
                class="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800"
                (click)="toggle.emit()"
                [attr.aria-label]="'Expandir sidebar'"
                title="Expandir"
              >
                <lucide-icon [img]="ExpandIcon" class="w-4 h-4 text-slate-200"></lucide-icon>
              </button>
            </div>
          }

          <nav class="space-y-2">
            <!-- Home -->
            <a
  routerLink="/"
  queryParamsHandling="preserve"
  routerLinkActive="bg-slate-900"
  [routerLinkActiveOptions]="{ exact: true }"
  class="flex items-center rounded-xl hover:bg-slate-900 text-slate-200 transition-colors"
  [class.w-full]="!collapsed"
  [class.px-3]="!collapsed"
  [class.py-2]="!collapsed"
  [class.gap-3]="!collapsed"
  [class.justify-start]="!collapsed"
  [class.w-12]="collapsed"
  [class.h-12]="collapsed"
  [class.mx-auto]="collapsed"
  [class.justify-center]="collapsed"
  title="Início"
  aria-label="Início"
>
  <lucide-icon [img]="HomeIcon" class="w-5 h-5 text-slate-300"></lucide-icon>

  <span
    class="whitespace-nowrap overflow-hidden transition-all duration-200"
    [style.maxWidth.px]="collapsed ? 0 : 180"
    [style.transitionDelay]="collapsed ? '0ms' : '140ms'"
    [class.opacity-0]="collapsed"
    [class.opacity-100]="!collapsed"
    [class.translate-x-1]="collapsed"
    [class.translate-x-0]="!collapsed"
  >
    Início
  </span>
</a>

<a
  routerLink="/events/all"
  routerLinkActive="bg-slate-900"
  class="flex items-center rounded-xl hover:bg-slate-900 text-slate-200 transition-colors"
  [class.w-full]="!collapsed"
  [class.px-3]="!collapsed"
  [class.py-2]="!collapsed"
  [class.gap-3]="!collapsed"
  [class.justify-start]="!collapsed"
  [class.w-12]="collapsed"
  [class.h-12]="collapsed"
  [class.mx-auto]="collapsed"
  [class.justify-center]="collapsed"
  title="Eventos"
  aria-label="Eventos"
>
  <div class="w-10 h-10 flex items-center justify-center">
    <span class="text-xs text-slate-300">EV</span>
  </div>
  <span
    class="whitespace-nowrap overflow-hidden transition-all duration-200"
    [style.maxWidth.px]="collapsed ? 0 : 180"
    [style.transitionDelay]="collapsed ? '0ms' : '140ms'"
    [class.opacity-0]="collapsed"
    [class.opacity-100]="!collapsed"
    [class.translate-x-1]="collapsed"
    [class.translate-x-0]="!collapsed"
  >
    Eventos
  </span>
</a>

            <!-- Admin -->
            @if (isAdmin()) {

              <a
                routerLink="/events"
                routerLinkActive="bg-slate-900"
                class="flex items-center rounded-xl hover:bg-slate-900 text-slate-200 transition-colors"
                [class.w-full]="!collapsed"
                [class.px-3]="!collapsed"
                [class.py-2]="!collapsed"
                [class.gap-3]="!collapsed"
                [class.justify-start]="!collapsed"
                [class.w-12]="collapsed"
                [class.h-12]="collapsed"
                [class.mx-auto]="collapsed"
                [class.justify-center]="collapsed"
                title="Events"
                aria-label="Events"
              >
                <div class="w-10 h-10 flex items-center justify-center">
                  <span class="text-xs text-slate-300">EV</span>
                </div>

                <span
                  class="whitespace-nowrap overflow-hidden transition-all duration-200"
                  [style.maxWidth.px]="collapsed ? 0 : 180"
                  [style.transitionDelay]="collapsed ? '0ms' : '140ms'"
                  [class.opacity-0]="collapsed"
                  [class.opacity-100]="!collapsed"
                  [class.translate-x-1]="collapsed"
                  [class.translate-x-0]="!collapsed"
                >
                  Events
                </span>
              </a>


              <a
                routerLink="/forces"
                routerLinkActive="bg-slate-900"
                class="flex items-center rounded-xl hover:bg-slate-900 text-slate-200 transition-colors"
                [class.w-full]="!collapsed"
                [class.px-3]="!collapsed"
                [class.py-2]="!collapsed"
                [class.gap-3]="!collapsed"
                [class.justify-start]="!collapsed"
                [class.w-12]="collapsed"
                [class.h-12]="collapsed"
                [class.mx-auto]="collapsed"
                [class.justify-center]="collapsed"
                title="Forces"
                aria-label="Forces"
              >
                <div class="w-10 h-10 flex justify-center">
                  <img src="force.png" class="w-8 h-10 text-slate-300" alt="Ícone de anel" />
               </div>

                <span
                  class="whitespace-nowrap overflow-hidden transition-all duration-200"
                  [style.maxWidth.px]="collapsed ? 0 : 180"
                  [style.transitionDelay]="collapsed ? '0ms' : '140ms'"
                  [class.opacity-0]="collapsed"
                  [class.opacity-100]="!collapsed"
                  [class.translate-x-1]="collapsed"
                  [class.translate-x-0]="!collapsed"
                >
                  Forces
                </span>
              </a>

              <a
                routerLink="/weapons"
                routerLinkActive="bg-slate-900"
                class="flex items-center rounded-xl hover:bg-slate-900 text-slate-200 transition-colors"
                [class.w-full]="!collapsed"
                [class.px-3]="!collapsed"
                [class.py-2]="!collapsed"
                [class.gap-3]="!collapsed"
                [class.justify-start]="!collapsed"
                [class.w-12]="collapsed"
                [class.h-12]="collapsed"
                [class.mx-auto]="collapsed"
                [class.justify-center]="collapsed"
                title="Weapons"
                aria-label="Weapons"
              >
                <div>
                <img src="weapon.png" class="w-10 h-10 text-slate-300" alt="Ícone de anel" />
               </div>

                <span
                  class="whitespace-nowrap overflow-hidden transition-all duration-200"
                  [style.maxWidth.px]="collapsed ? 0 : 180"
                  [style.transitionDelay]="collapsed ? '0ms' : '140ms'"
                  [class.opacity-0]="collapsed"
                  [class.opacity-100]="!collapsed"
                  [class.translate-x-1]="collapsed"
                  [class.translate-x-0]="!collapsed"
                >
                  Weapons
                </span>
              </a>

              <a
                routerLink="/shields"
                routerLinkActive="bg-slate-900"
                class="flex items-center rounded-xl hover:bg-slate-900 text-slate-200 transition-colors"
                [class.w-full]="!collapsed"
                [class.px-3]="!collapsed"
                [class.py-2]="!collapsed"
                [class.gap-3]="!collapsed"
                [class.justify-start]="!collapsed"
                [class.w-12]="collapsed"
                [class.h-12]="collapsed"
                [class.mx-auto]="collapsed"
                [class.justify-center]="collapsed"
                title="Shields"
                aria-label="Shields"
              >
                <div>
                <img src="shield.png" class="w-10 h-10 text-slate-300" alt="Ícone de anel" />
               </div>

                <span
                  class="whitespace-nowrap overflow-hidden transition-all duration-200"
                  [style.maxWidth.px]="collapsed ? 0 : 180"
                  [style.transitionDelay]="collapsed ? '0ms' : '140ms'"
                  [class.opacity-0]="collapsed"
                  [class.opacity-100]="!collapsed"
                  [class.translate-x-1]="collapsed"
                  [class.translate-x-0]="!collapsed"
                >
                  Shields
                </span>
              </a>

               <a
                routerLink="/armor/helmets"
                routerLinkActive="bg-slate-900"
                class="flex items-center rounded-xl hover:bg-slate-900 text-slate-200 transition-colors"
                [class.w-full]="!collapsed"
                [class.px-3]="!collapsed"
                [class.py-2]="!collapsed"
                [class.gap-3]="!collapsed"
                [class.justify-start]="!collapsed"
                [class.w-12]="collapsed"
                [class.h-12]="collapsed"
                [class.mx-auto]="collapsed"
                [class.justify-center]="collapsed"
                title="Helmets"
                aria-label="Helmets"
              >
                 <div>
                <img src="helmet.png" class="w-10 h-10 text-slate-300" alt="Ícone de anel" />
               </div>

                <span
                  class="whitespace-nowrap overflow-hidden transition-all duration-200"
                  [style.maxWidth.px]="collapsed ? 0 : 180"
                  [style.transitionDelay]="collapsed ? '0ms' : '140ms'"
                  [class.opacity-0]="collapsed"
                  [class.opacity-100]="!collapsed"
                  [class.translate-x-1]="collapsed"
                  [class.translate-x-0]="!collapsed"
                >
                  Helmets
                </span>
              </a>

               <a
                routerLink="/armor/upper"
                routerLinkActive="bg-slate-900"
                class="flex items-center rounded-xl hover:bg-slate-900 text-slate-200 transition-colors"
                [class.w-full]="!collapsed"
                [class.px-3]="!collapsed"
                [class.py-2]="!collapsed"
                [class.gap-3]="!collapsed"
                [class.justify-start]="!collapsed"
                [class.w-12]="collapsed"
                [class.h-12]="collapsed"
                [class.mx-auto]="collapsed"
                [class.justify-center]="collapsed"
                title="Upper"
                aria-label="Upper"
              >
                 <div>
                <img src="upper.png" class="w-10 h-10 text-slate-300" alt="Ícone de anel" />
               </div>

                <span
                  class="whitespace-nowrap overflow-hidden transition-all duration-200"
                  [style.maxWidth.px]="collapsed ? 0 : 180"
                  [style.transitionDelay]="collapsed ? '0ms' : '140ms'"
                  [class.opacity-0]="collapsed"
                  [class.opacity-100]="!collapsed"
                  [class.translate-x-1]="collapsed"
                  [class.translate-x-0]="!collapsed"
                >
                  Upper
                </span>
              </a>

              <a
                routerLink="/armor/lower"
                routerLinkActive="bg-slate-900"
                class="flex items-center rounded-xl hover:bg-slate-900 text-slate-200 transition-colors"
                [class.w-full]="!collapsed"
                [class.px-3]="!collapsed"
                [class.py-2]="!collapsed"
                [class.gap-3]="!collapsed"
                [class.justify-start]="!collapsed"
                [class.w-12]="collapsed"
                [class.h-12]="collapsed"
                [class.mx-auto]="collapsed"
                [class.justify-center]="collapsed"
                title="Lower"
                aria-label="Lower"
              >
                 <div class="w-10 h-10 flex justify-center">
                <img src="lower.png" class="w-8 h-10 text-slate-300" alt="Ícone de anel" />
               </div>

                <span
                  class="whitespace-nowrap overflow-hidden transition-all duration-200"
                  [style.maxWidth.px]="collapsed ? 0 : 180"
                  [style.transitionDelay]="collapsed ? '0ms' : '140ms'"
                  [class.opacity-0]="collapsed"
                  [class.opacity-100]="!collapsed"
                  [class.translate-x-1]="collapsed"
                  [class.translate-x-0]="!collapsed"
                >
                  Lower
                </span>
              </a>

              <a
                routerLink="/armor/gloves"
                routerLinkActive="bg-slate-900"
                class="flex items-center rounded-xl hover:bg-slate-900 text-slate-200 transition-colors"
                [class.w-full]="!collapsed"
                [class.px-3]="!collapsed"
                [class.py-2]="!collapsed"
                [class.gap-3]="!collapsed"
                [class.justify-start]="!collapsed"
                [class.w-12]="collapsed"
                [class.h-12]="collapsed"
                [class.mx-auto]="collapsed"
                [class.justify-center]="collapsed"
                title="Gloves"
                aria-label="Gloves"
              >
                 <div>
                <img src="gloves.png" class="w-10 h-10 text-slate-300" alt="Ícone de anel" />
               </div>

                <span
                  class="whitespace-nowrap overflow-hidden transition-all duration-200"
                  [style.maxWidth.px]="collapsed ? 0 : 180"
                  [style.transitionDelay]="collapsed ? '0ms' : '140ms'"
                  [class.opacity-0]="collapsed"
                  [class.opacity-100]="!collapsed"
                  [class.translate-x-1]="collapsed"
                  [class.translate-x-0]="!collapsed"
                >
                  Gloves
                </span>
              </a>

              <a
                routerLink="/armor/shoes"
                routerLinkActive="bg-slate-900"
                class="flex items-center rounded-xl hover:bg-slate-900 text-slate-200 transition-colors"
                [class.w-full]="!collapsed"
                [class.px-3]="!collapsed"
                [class.py-2]="!collapsed"
                [class.gap-3]="!collapsed"
                [class.justify-start]="!collapsed"
                [class.w-12]="collapsed"
                [class.h-12]="collapsed"
                [class.mx-auto]="collapsed"
                [class.justify-center]="collapsed"
                title="Shoes"
                aria-label="Shoes"
              >
                <div>
                <img src="shoes.png" class="w-10 h-10 text-slate-300" alt="Ícone de anel" />
               </div>

                <span
                  class="whitespace-nowrap overflow-hidden transition-all duration-200"
                  [style.maxWidth.px]="collapsed ? 0 : 180"
                  [style.transitionDelay]="collapsed ? '0ms' : '140ms'"
                  [class.opacity-0]="collapsed"
                  [class.opacity-100]="!collapsed"
                  [class.translate-x-1]="collapsed"
                  [class.translate-x-0]="!collapsed"
                >
                  Shoes
                </span>
              </a>

               <a
                routerLink="/accessories/amulet"
                routerLinkActive="bg-slate-900"
                class="flex items-center rounded-xl hover:bg-slate-900 text-slate-200 transition-colors"
                [class.w-full]="!collapsed"
                [class.px-3]="!collapsed"
                [class.py-2]="!collapsed"
                [class.gap-3]="!collapsed"
                [class.justify-start]="!collapsed"
                [class.w-12]="collapsed"
                [class.h-12]="collapsed"
                [class.mx-auto]="collapsed"
                [class.justify-center]="collapsed"
                title="Amulets"
                aria-label="Amulets"
              >
                <div>
                <img src="amulet.png" class="w-10 h-10 text-slate-300" alt="Ícone de anel" />
               </div>

                <span
                  class="whitespace-nowrap overflow-hidden transition-all duration-200"
                  [style.maxWidth.px]="collapsed ? 0 : 180"
                  [style.transitionDelay]="collapsed ? '0ms' : '140ms'"
                  [class.opacity-0]="collapsed"
                  [class.opacity-100]="!collapsed"
                  [class.translate-x-1]="collapsed"
                  [class.translate-x-0]="!collapsed"
                >
                  Amulets
                </span>
              </a>

               <a
                routerLink="/accessories/ring"
                routerLinkActive="bg-slate-900"
                class="flex items-center rounded-xl hover:bg-slate-900 text-slate-200 transition-colors"
                [class.w-full]="!collapsed"
                [class.px-3]="!collapsed"
                [class.py-2]="!collapsed"
                [class.gap-3]="!collapsed"
                [class.justify-start]="!collapsed"
                [class.w-12]="collapsed"
                [class.h-12]="collapsed"
                [class.mx-auto]="collapsed"
                [class.justify-center]="collapsed"
                title="Rings"
                aria-label="Rings"
              >
               <div>
                <img src="ring.png" class="w-10 h-10 text-slate-300" alt="Ícone de anel" />
               </div>

                <span
                  class="whitespace-nowrap overflow-hidden transition-all duration-200"
                  [style.maxWidth.px]="collapsed ? 0 : 180"
                  [style.transitionDelay]="collapsed ? '0ms' : '140ms'"
                  [class.opacity-0]="collapsed"
                  [class.opacity-100]="!collapsed"
                  [class.translate-x-1]="collapsed"
                  [class.translate-x-0]="!collapsed"
                >
                  Rings
                </span>
              </a>
            }
          </nav>
        </div>
      </div>
    </aside>
  `,
})
export class SidebarComponent {
  @Input() collapsed = false;
  @Output() toggle = new EventEmitter<void>();

  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private teamsApi = inject(TeamsApi);
  private auth = inject(AuthService);

  readonly HomeIcon = House;
  readonly LinksIcon = LinkIcon;
  readonly FilterIcon = SlidersHorizontal;
  readonly ClearIcon = X;
  readonly CollapseIcon = ChevronLeft;
  readonly ExpandIcon = ChevronRight;

  readonly ItemTypesIcon = Tags;
  readonly ForcesIcon = Zap;
  readonly ItemsIcon = Sword;

  readonly Helmet = HardHat
  readonly Upper = Shirt
  readonly Lower = trousers
  readonly Gloves = Hand
  readonly Shoes = Footprints


  isAdmin = computed(() => this.auth.userSig()?.scope === 'admin');

  teams = signal<Team[]>([]);
  loadingTeams = signal(false);
  teamsError = signal('');

  selectedTimes = signal<number[]>(parseTimesParam(this.route.snapshot.queryParamMap.get('time')));

  constructor() {
    this.route.queryParamMap.subscribe((m) => {
      this.selectedTimes.set(parseTimesParam(m.get('time')));
    });

    this.loadTeams();
  }

  loadTeams() {
    this.loadingTeams.set(true);
    this.teamsError.set('');

    this.teamsApi.list().subscribe({
      next: (list) => this.teams.set(list),
      error: (e) => {
        const msg = e?.error?.message;
        this.teamsError.set(Array.isArray(msg) ? msg.join(', ') : msg ?? 'Falha ao carregar times');
        this.loadingTeams.set(false);
      },
      complete: () => this.loadingTeams.set(false),
    });
  }

  isSelected(uor: number) {
    return this.selectedTimes().includes(uor);
  }

  toggleTime(uor: number) {
    const current = new Set(this.selectedTimes());
    if (current.has(uor)) current.delete(uor);
    else current.add(uor);

    const next = Array.from(current).sort((a, b) => a - b);
    this.setTimesOnUrl(next);
  }

  clearTimes() {
    this.setTimesOnUrl([]);
  }

  private setTimesOnUrl(times: number[]) {
    const qp: any = { ...this.route.snapshot.queryParams };

    if (times.length === 0) delete qp.time;
    else qp.time = toTimesParam(times);

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: qp,
      replaceUrl: true,
    });
  }
}
