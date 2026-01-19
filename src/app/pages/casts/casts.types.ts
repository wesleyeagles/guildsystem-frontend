import type { CastType } from '../../api/casts.api';

export type CastTypeFilter = 'All' | CastType;
export type TipPos = { x: number; y: number };

export type LevelsView =
  | { mode: 'none' }
  | { mode: 'single'; text: string }
  | { mode: 'range'; text: string }
  | { mode: 'grid'; items: { lv: number; text: string }[] };
