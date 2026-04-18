import type { ICellRendererParams } from 'ag-grid-community';
import { escapeHtml } from '../table.utils';

export interface EffectsPresenterLike<T, E> {
  displayEffects(row: T): E[];
  formatEffectValue(effect: E): string;
  effectsSearchText(row: T): string;
}

export interface EffectLike {
  effect?: string;
  typeNum?: 'Decrease' | string;
}

export const effectsChipsRenderer =
  <T, E extends EffectLike>(
    presenter: EffectsPresenterLike<T, E>,
    toLabel: (e: E) => string = (e) => String(e.effect ?? ''),
    kindOf: (e: E) => 'up' | 'down' = (e) => (e.typeNum === 'Decrease' ? 'down' : 'up'),
  ) =>
  (p: ICellRendererParams<T>) => {
    const row = p.data as T | null | undefined;
    if (!row) return '';

    const effects = presenter.displayEffects(row) ?? [];
    if (!effects.length) return '';

    const chips = effects
      .map((e) => {
        const label = `${escapeHtml(toLabel(e))} ${escapeHtml(presenter.formatEffectValue(e))}`;
        const kind = kindOf(e);
        return `<span class="fx-chip fx-chip--${kind}">${label}</span>`;
      })
      .join('');

    return `<div class="fx-wrap">${chips}</div>`;
  };
