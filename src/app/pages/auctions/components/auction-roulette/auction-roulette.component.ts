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

function pickHue(i: number, n: number, offset: number) {
  if (n <= 0) return 0;
  return (offset + i * (360 / n)) % 360;
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
   * ✅ Overlay pra uniformizar contraste (0..0.35)
   * - Antes estava alto e “matava” as cores.
   * - Deixa baixo (0.06..0.12) ou 0 pra “puro”.
   */
  @Input() segmentOverlayAlpha = 0.08;

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

    const h = hashToUint32(this.seed || `${Date.now()}`);
    const startOffset = ((h % 10_000) / 10_000) * Math.PI * 2;

    this.draw(ctx, startOffset);

    if (n < 2) {
      const w = names[0] ?? '—';
      this.done.set(true);
      this.winnerName.set(w);
      this.finished.emit({ winnerIndex: 0, winnerName: w });
      this.scheduleAutoClose();
      return;
    }

    const winnerIndex = clamp(Math.trunc(this.winnerIndex), 0, n - 1);
    const seg = (Math.PI * 2) / n;

    const center = winnerIndex * seg + seg / 2;
    const baseFinal = -Math.PI / 2 - center;

    const extraTurns = 6 + (h % 3);

    const from = startOffset;

    let to = baseFinal + extraTurns * Math.PI * 2;
    while (to <= from) to += Math.PI * 2;

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

        this.draw(ctx, to);

        this.finished.emit({ winnerIndex, winnerName: w });
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

    // Fundo geral do disco (escuro)
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(2, 6, 23, 0.96)';
    ctx.fill();
    ctx.restore();

    // Hue offset estável por seed (pra não “trocar” cores toda hora)
    const seedHash = hashToUint32(this.seed || 'seed');
    const hueOffset = seedHash % 360;

    for (let i = 0; i < n; i++) {
      const a0 = angle + i * seg;
      const a1 = a0 + seg;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, a0, a1);
      ctx.closePath();

      // ✅ fatia com HSL escuro, mas COLORIDO
      const hue = pickHue(i, n, hueOffset);

      // alterna levemente o “lightness” pra diferenciar ainda mais
      const lightOuter = i % 2 === 0 ? 34 : 30;
      const lightInner = i % 2 === 0 ? 22 : 20;

      ctx.save();
      ctx.clip();

      // gradiente radial leve (sem “efeito brega”, só pra dar separação)
      const g = ctx.createRadialGradient(cx, cy, r * 0.12, cx, cy, r);
      g.addColorStop(0, `hsla(${hue}, 78%, ${lightInner}%, 0.98)`);
      g.addColorStop(1, `hsla(${hue}, 86%, ${lightOuter}%, 0.98)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);

      // overlay opcional (bem baixo)
      const overlayA = clamp(Number(this.segmentOverlayAlpha ?? 0.08), 0, 0.35);
      if (overlayA > 0) {
        ctx.fillStyle = `rgba(0,0,0,${overlayA})`;
        ctx.fillRect(0, 0, size, size);
      }

      ctx.restore();

      // separadores (um pouco mais visíveis)
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Texto
      const label = String(names[i] ?? '').trim() || `Player ${i + 1}`;
      const mid = (a0 + a1) / 2;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(mid);

      ctx.translate(r * 0.62, 0);
      ctx.rotate(Math.PI / 2);

      const maxChars = 16;
      const text = label.length > maxChars ? label.slice(0, maxChars - 1) + '…' : label;

      ctx.font = '800 14px system-ui, -apple-system, Segoe UI, Roboto, Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // ✅ outline resolve leitura SEM depender da cor da fatia
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 1;

      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(2,6,23,0.92)';
      ctx.strokeText(text, 0, 0);

      ctx.fillStyle = 'rgba(255,255,255,0.98)';
      ctx.fillText(text, 0, 0);

      ctx.restore();
    }

    // Miolo
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(2,6,23,0.92)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(148,163,184,0.22)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Borda externa
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(148,163,184,0.26)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }
}
