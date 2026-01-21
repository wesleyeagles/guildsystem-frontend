// src/app/pages/auctions/components/auction-roulette/auction-roulette.component.ts
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function easeOutCubic(t: number) {
  const x = 1 - t;
  return 1 - x * x * x;
}

function hashToUint32(seed: string) {
  let h = 2166136261 >>> 0;
  const s = String(seed ?? '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickHue(i: number, n: number) {
  if (n <= 0) return 0;
  return (i * (360 / n)) % 360;
}

@Component({
  selector: 'app-auction-roulette',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './auction-roulette.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuctionRouletteComponent implements AfterViewInit {
  private destroyRef = inject(DestroyRef);

  @ViewChild('canvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  /** nomes (ordem deve bater com winnerIndex) */
  @Input({ required: true }) participants: string[] = [];

  /** índice do vencedor (0..n-1) */
  @Input({ required: true }) winnerIndex = 0;

  /** seed só pra variar o ângulo inicial de forma estável */
  @Input() seed = '';

  /** duração total do giro (ms) */
  @Input() durationMs = 9000;

  /** valor do lance final (só display) */
  @Input() amount = 0;

  /** tamanho do canvas (px) */
  @Input() size = 360;

  /** segundos para manter a roleta visível após finalizar */
  @Input() keepOpenSeconds = 10;

  /**
   * chamado quando a roleta termina:
   * - `finished` dispara imediatamente ao terminar o giro
   * - `autoClose` dispara depois de keepOpenSeconds (pra você fechar o modal/limpar UI)
   */
  @Output() finished = new EventEmitter<{ winnerIndex: number; winnerName: string }>();
  @Output() autoClose = new EventEmitter<void>();

  done = signal(false);
  winnerName = signal('');
  closeInSeconds = signal(0);

  private raf: number | null = null;
  private closeTimer: any = null;
  private countdownTimer: any = null;

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(this.size * dpr);
    canvas.height = Math.floor(this.size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.draw(ctx, 0);
    this.startSpin(ctx);

    this.destroyRef.onDestroy(() => {
      if (this.raf) cancelAnimationFrame(this.raf);
      if (this.closeTimer) clearTimeout(this.closeTimer);
      if (this.countdownTimer) clearInterval(this.countdownTimer);
    });
  }

  private scheduleAutoClose() {
    const sec = clamp(Math.trunc(this.keepOpenSeconds || 10), 1, 120);
    this.closeInSeconds.set(sec);

    if (this.countdownTimer) clearInterval(this.countdownTimer);
    this.countdownTimer = setInterval(() => {
      const v = this.closeInSeconds();
      if (v <= 1) {
        this.closeInSeconds.set(0);
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
        return;
      }
      this.closeInSeconds.set(v - 1);
    }, 1000);

    if (this.closeTimer) clearTimeout(this.closeTimer);
    this.closeTimer = setTimeout(() => {
      this.autoClose.emit();
    }, sec * 1000);
  }

  private startSpin(ctx: CanvasRenderingContext2D) {
    const names = (this.participants ?? []).slice();
    const n = names.length;

    if (n < 2) {
      const w = names[0] ?? '—';
      this.done.set(true);
      this.winnerName.set(w);
      this.finished.emit({ winnerIndex: 0, winnerName: w });
      this.draw(ctx, 0);
      this.scheduleAutoClose();
      return;
    }

    const winnerIndex = clamp(Math.trunc(this.winnerIndex), 0, n - 1);
    const seg = (Math.PI * 2) / n;

    const h = hashToUint32(this.seed || `${Date.now()}`);
    const startOffset = ((h % 10_000) / 10_000) * Math.PI * 2;

    const center = winnerIndex * seg + seg / 2;
    let targetAngle = -Math.PI / 2 - center;

    const extraTurns = 6 + (h % 3); // 6..8
    targetAngle += extraTurns * Math.PI * 2;

    const from = startOffset;
    const to = startOffset + targetAngle;

    const duration = clamp(Math.trunc(this.durationMs || 9000), 1200, 30_000);
    const start = performance.now();

    const tick = (t: number) => {
      const elapsed = t - start;
      const p = clamp(elapsed / duration, 0, 1);
      const eased = easeOutCubic(p);
      const angle = from + (to - from) * eased;

      this.draw(ctx, angle);

      if (p < 1) {
        this.raf = requestAnimationFrame(tick);
      } else {
        const w = names[winnerIndex] ?? '—';
        this.done.set(true);
        this.winnerName.set(w);

        // final crisp draw
        this.draw(ctx, to);

        // dispara "finished" no final do giro
        this.finished.emit({ winnerIndex, winnerName: w });

        // mantém visível por Xs e depois emite autoClose
        this.scheduleAutoClose();
      }
    };

    this.raf = requestAnimationFrame(tick);
  }

  private draw(ctx: CanvasRenderingContext2D, angle: number) {
    const size = this.size;
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 8;

    const names = (this.participants ?? []).slice();
    const n = Math.max(1, names.length);
    const seg = (Math.PI * 2) / n;

    ctx.clearRect(0, 0, size, size);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
    ctx.restore();

    for (let i = 0; i < n; i++) {
      const a0 = angle + i * seg;
      const a1 = a0 + seg;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, a0, a1);
      ctx.closePath();

      const hue = pickHue(i, n);
      ctx.fillStyle = `hsla(${hue}, 75%, 45%, 0.95)`;
      ctx.fill();

      ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.lineWidth = 2;
      ctx.stroke();

      const label = String(names[i] ?? '').trim() || `Player ${i + 1}`;
      const mid = (a0 + a1) / 2;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(mid);

      ctx.translate(r * 0.62, 0);
      ctx.rotate(Math.PI / 2);

      ctx.font = '600 13px system-ui, -apple-system, Segoe UI, Roboto, Arial';
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const maxChars = 16;
      const text = label.length > maxChars ? label.slice(0, maxChars - 1) + '…' : label;

      ctx.fillText(text, 0, 0);
      ctx.restore();
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(2,6,23,0.9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(148,163,184,0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(148,163,184,0.30)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }
}
