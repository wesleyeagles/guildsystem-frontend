import { Injectable } from '@angular/core';
import { Helmet, HelmetEffect } from '../../api/helmets.api';

type UnitKind = 'none' | 'percent' | 'ms';

const EFFECT_UNIT_BY_LABEL: Record<string, UnitKind> = {
  'FP Consumption': 'percent',
  'Max. HP/FP': 'percent',
  Attack: 'percent',
  Defense: 'percent',
  Vampiric: 'percent',
  'Force Attack': 'percent',
  'Critical Chance': 'percent',
  'Block Chance': 'percent',
  'Max. HP': 'percent',
  'Max. FP': 'percent',
  'Debuff Duration': 'percent',
  'Ignore Block Chance': 'percent',
  'Movement Speed': 'none',

  'Launcher Attack Delay': 'ms',
  'Force Skill Delay': 'ms',
};

@Injectable({ providedIn: 'root' })
export class HelmetEffectsPresenter {
  hasDetails(h: Helmet) {
    return (Array.isArray(h.effects) && h.effects.length > 0) || Boolean(h.defense) || Boolean(h.defenseSuccesRate);
  }

  displayEffects(h: Helmet) {
    const arr = Array.isArray(h.effects) ? h.effects : [];
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

  formatEffectValue(e: HelmetEffect): string {
    const label = String(e.effect ?? '').trim();
    const kind = this.unitKind(label);

    const value = Number(e.value);
    const abs = Number.isFinite(value) ? Math.abs(value) : 0;

    const sign = e.typeNum === 'Decrease' ? '-' : '+';

    if (kind === 'percent') {
      const v = Number.isInteger(abs) ? String(abs) : abs.toFixed(2).replace(/\.00$/, '');
      return `${sign}${v}%`;
    }

    if (kind === 'ms') {
      const v = String(Math.round(abs));
      return `${sign}${v}ms`;
    }

    if (Number.isInteger(abs)) return `${sign}${abs}`;
     if (e.effect === 'Movement Speed') {
      return `${sign}${abs.toFixed(2).replace(/\.00$/, '')}`;
     }
     
    return `${sign}${abs.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}`;
  }

  effectsSearchText(h: Helmet): string {
    return this.displayEffects(h)
      .map((e) => `${e.effect} ${this.formatEffectValue(e)}`)
      .join(' ');
  }
}
