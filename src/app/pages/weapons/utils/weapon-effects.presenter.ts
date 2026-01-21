import { Injectable } from '@angular/core';
import type { Weapon, WeaponEffect } from '../../../api/weapons.api';

/**
 * Como o backend NÃO manda o format, a regra no front é por LABEL.
 * (fica alinhado com seu WEAPON_EFFECT_MAP do backend)
 */
type UnitKind = 'none' | 'percent' | 'ms';

const EFFECT_UNIT_BY_LABEL: Record<string, UnitKind> = {
  'FP Consumption': 'percent',
  'Max. HP/FP': 'percent',
  Attack: 'percent',
  Defense: 'percent',
  Vampiric: 'percent',
  'Critical Chance': 'percent',
  'Block Chance': 'percent',
  'Max. HP': 'percent',
  'Debuff Duration': 'percent',
  'Ignore Block Chance': 'percent',

  'Launcher Attack Delay': 'ms',
  'Force Skill Delay': 'ms',
};

@Injectable({ providedIn: 'root' })
export class WeaponEffectsPresenter {
  hasDetails(w: Weapon) {
    return (
      (Array.isArray(w.effects) && w.effects.length > 0) ||
      Boolean(w.cast) ||
      Boolean(w.attack?.min || w.attack?.max || w.forceAttack?.min || w.forceAttack?.max)
    );
  }

  displayEffects(w: Weapon) {
    const arr = Array.isArray(w.effects) ? w.effects : [];
    return arr.filter((e) => {
      const label = String(e?.effect ?? '').trim();
      if (!label) return false;
      if (!Number.isFinite(Number(e?.value))) return false;
      if (Number(e.value) === 0) return false;
      return true;
    });
  }

  private unitKind(label: string): UnitKind {
    return EFFECT_UNIT_BY_LABEL[label] ?? 'none';
  }

  formatEffectValue(e: WeaponEffect): string {
    const label = String(e.effect ?? '').trim();
    const kind = this.unitKind(label);

    const value = Number(e.value);
    const abs = Number.isFinite(value) ? Math.abs(value) : 0;

    const sign = e.typeNum === 'Decrease' ? '-' : '+';

    if (kind === 'percent') {
      // backend já mandou "10" pra 10%
      const v = Number.isInteger(abs) ? String(abs) : abs.toFixed(2).replace(/\.00$/, '');
      return `${sign}${v}%`;
    }

    if (kind === 'ms') {
      // backend normalizou pra inteiro no ms
      const v = String(Math.round(abs));
      return `${sign}${v}ms`;
    }

    // none/float/int
    if (Number.isInteger(abs)) return `${sign}${abs}`;
    return `${sign}${abs.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}`;
  }

  // útil pro search
  effectsSearchText(w: Weapon): string {
    return this.displayEffects(w)
      .map((e) => `${e.effect} ${this.formatEffectValue(e)}`)
      .join(' ');
  }
}
