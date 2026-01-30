import { Component, EventEmitter, Input, Output, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive } from '@angular/router';
import {
  LucideAngularModule,
  House,
  CalendarClock,
  CalendarPlus,
  Scale,
  Grid2x2Plus,
  Users,
  Shield,
} from 'lucide-angular';
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
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent {
  @Input() collapsed = false;
  @Output() toggle = new EventEmitter<void>();

  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private teamsApi = inject(TeamsApi);
  private auth = inject(AuthService);

  readonly HomeIcon = House;
  readonly EventIcon = CalendarClock;
  readonly AuctionIcon = Scale;

  readonly EventAddIcon = CalendarPlus;
  readonly AuctionAddIcon = Grid2x2Plus;

  readonly PendencyUser = Users;
  readonly PermissionsIcon = Shield;

  isAdminArea = computed(() => {
    const s = this.auth.userSig()?.scope;
    return s === 'admin' || s === 'root';
  });

  canSeePendingMembers = computed(() => {
    const s = this.auth.userSig()?.scope;
    return s === 'moderator' || s === 'admin' || s === 'root';
  });

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
