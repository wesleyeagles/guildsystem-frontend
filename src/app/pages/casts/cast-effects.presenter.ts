import { Injectable } from '@angular/core';
import type { Cast, CastEffect, CastEffectFormat } from '../../api/casts.api';
import type { LevelsView } from './casts.types';

interface Weapons {
  id: number; // Auto Gerado pelo Banco de Dados
  code: string; // Code - Excel
  name: string; // Name - Excel
  imagePath: string; // Ler o código que está em Icon, e procurar na pasta de imagens, só olhar como é feito em Cast
  grade: {
    id: number; // Grade ID - Excel
    name: string; // Grade Name - Excel
  }; // Grade - Excel (No Excel está salvo em números, vamos criar um enum, o id fica sendo grade e o name o nome do grade no enum)
  level: number; // LevelLim - Excel
  effects: {
    effect: string; // Eff1Code - Eff4Code - Excel // Também vamos ter que fazer um enum para os Eff1Code, o aqui só recebe o nome (Accuracy, Attack Speed, etc)
    value: number; // Eff1Unit - Eff4Unit - Excel
    typeNum: 'Increase' | 'Decrease'; // Depende se o valor de Eff1Unit é positivo ou negativo
  }[]
  attack: {
    min: number; // GAminAF - Excel
    max: number; // GAmaxAF - Excel
  }
  forceAttack: {
    min: number; // MAminAF - Excel
    max: number; // MAmaxAF - Excel
  }
  cast: { // No Weapon tem a coluna ActiveCodeKey que referencia o Cast que é ativado ao usar a arma
    id: number; // Cast ID - Excel
    name: string; // Cast Name - Excel
    imagePath: string; // Ler o código que está em Icon, e procurar na pasta de imagens, só olhar como é feito em Cast
  }
}[]

@Injectable({ providedIn: 'root' })
export class CastEffectsPresenter {
  hasDetails(it: Cast) {
    return this.displayEffects(it).length > 0 || Boolean((it as any).description);
  }

  displayEffects(it: Cast) {
    const arr = Array.isArray((it as any).effects) ? ((it as any).effects as CastEffect[]) : [];
    return arr.filter((e) => {
      const key = String(e?.key ?? '');
      const label = String(e?.label ?? '');
      if (!key && !label) return false;
      if (key.startsWith('unknown_')) return false;
      if (label.toLowerCase().startsWith('unknown')) return false;
      return true;
    });
  }

  private stripIncDec(label: string) {
    const s = String(label ?? '').trim();
    return s.replace(/^increase\s+/i, '').replace(/^decrease\s+/i, '').trim();
  }

  private directionFromValues(values: number[]) {
    for (const v of values ?? []) {
      if (v === -1 || v === 0) continue;
      return v < 0 ? 'Decrease' : 'Increase';
    }
    return '';
  }

  effectLabel(e: CastEffect) {
    const base = this.stripIncDec(e.label);
    const dir = this.directionFromValues(e.values ?? []);
    return dir ? `${dir} ${base}` : base;
  }

  private isAllEqual(vals: number[]) {
    if (!vals?.length) return true;
    const first = vals[0];
    return vals.every((v) => v === first);
  }

  private formatValueAbs(v: number, fmt?: CastEffectFormat) {
    if (v === -1 || Number.isNaN(v)) return '—';

    const abs = Math.abs(v);

    if (fmt === 'pct01') {
      const pct = abs * 100;
      const s = Number.isInteger(pct) ? String(pct) : pct.toFixed(2).replace(/\.00$/, '');
      return `${s}%`;
    }

    if (fmt === 'pct10') {
      const s = Number.isInteger(abs) ? String(abs) : abs.toFixed(2).replace(/\.00$/, '');
      return `${s}%`;
    }

    if (fmt === 'pct100') {
      const s = Number.isInteger(abs) ? String(abs * 10) : abs.toFixed(2).replace(/\.00$/, '');
      return `${s}%`;
    }

    if (fmt === 'ms') {
      const s = Number.isInteger(abs) ? String(abs) : abs.toFixed(2).replace(/\.00$/, '');
      return `${s}ms`;
    }

    if (fmt === 'flag') return 'ON';

    const s = Number.isInteger(abs) ? String(abs) : abs.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
    return s;
  }
  

  // Regras:
  // - ClassSkill: só valor (sem Lv)
  // - Force/Skill: se todos iguais -> "Lv1–Lv7: valor"
  // - Force/Skill: se variado -> grid Lv1..Lv7
 levelsView(cast: Cast, e: CastEffect): LevelsView {
  const vals0 = Array.isArray(e.values) ? e.values : [];
  const fmt = e.format;

  if (!vals0.length) return { mode: 'none' };
  if (fmt === 'flag') return { mode: 'single', text: 'ON' };

  // corta no primeiro -1 (sentinela)
  const end = vals0.indexOf(-1);
  const usable = end === -1 ? vals0 : vals0.slice(0, end);

  // se tudo era -1 ou vazio após cortar
  if (!usable.length) return { mode: 'none' };

  // ClassSkill: só o primeiro valor válido (sem Lv)
  if ((cast as any).source === 'ClassSkill') {
    const v = usable[0] ?? -1;
    return { mode: 'single', text: this.formatValueAbs(v, fmt) };
  }

  // se só tem 1 nível, melhor como single (não range)
  if (usable.length === 1) {
    const v = usable[0] ?? -1;
    return { mode: 'single', text: this.formatValueAbs(v, fmt) };
  }

  // todos iguais => range, mas agora Lv1–LvN (N = usable.length)
  if (this.isAllEqual(usable)) {
    const v = usable[0] ?? -1;
    return { mode: 'range', text: `Lv1–Lv${usable.length}: ${this.formatValueAbs(v, fmt)}` };
  }

  // variado => grid só com níveis válidos
  return {
    mode: 'grid',
    items: usable.map((v, i) => ({
      lv: i + 1,
      text: this.formatValueAbs(v ?? -1, fmt),
    })),
  };
}

  levelsSearchText(cast: Cast, e: CastEffect) {
    const view = this.levelsView(cast, e);
    if (view.mode === 'single') return view.text;
    if (view.mode === 'range') return view.text;
    if (view.mode === 'grid') return view.items.map((x) => `Lv${x.lv}:${x.text}`).join(' ');
    return '';
  }
}
