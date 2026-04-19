/**
 * Manter alinhado com guildsystem-backend/src/common/game-classes.ts
 * (slug = nome do arquivo sem extensão; file inclui .jpg / .png)
 */
export const GAME_CLASS_UNSET = '__UNSET__';

export interface GameClassOption {
  id: string;
  file: string;
  /** Nome de exibição (igual em todos os idiomas). */
  label: string;
}

export const GAME_CLASS_OPTIONS: GameClassOption[] = [
  { id: 'assaulter', file: 'assaulter.jpg', label: 'Assaulter' },
  { id: 'battleleader', file: 'battleleader.png', label: 'Battle Leader' },
  { id: 'dementer', file: 'dementer.png', label: 'Dementer' },
  { id: 'mercenary', file: 'mercenary.jpg', label: 'Mercenary' },
  { id: 'phantomshadow', file: 'phantomshadow.png', label: 'Phantom Shadow' },
  { id: 'punisher', file: 'punisher.jpg', label: 'Punisher' },
  { id: 'scientist', file: 'scientist.png', label: 'Scientist' },
  { id: 'striker', file: 'striker.png', label: 'Striker' },
];

const ALLOWED = new Set(GAME_CLASS_OPTIONS.map((o) => o.id));

export function isValidGameClassSlug(value: string | null | undefined): boolean {
  const s = String(value ?? '').trim();
  if (!s || s === GAME_CLASS_UNSET) {
    return false;
  }
  return ALLOWED.has(s);
}

export function getGameClassOption(id: string | null | undefined): GameClassOption | null {
  const s = String(id ?? '').trim();
  return GAME_CLASS_OPTIONS.find((o) => o.id === s) ?? null;
}

export function gameClassPublicPath(option: GameClassOption): string {
  return `classes/${option.file}`;
}

/** Modal obrigatório: nickname não confirmado ou classe ainda __UNSET__/inválida. */
export function needsSiteProfileSetup(u: {
  accepted?: boolean;
  hasConfirmedSiteNickname?: boolean;
  characterClass?: string | null;
} | null | undefined): boolean {
  if (!u?.accepted) {
    return false;
  }
  if (u.hasConfirmedSiteNickname === false) {
    return true;
  }
  const cc = u.characterClass ?? GAME_CLASS_UNSET;
  if (!isValidGameClassSlug(cc)) {
    return true;
  }
  return false;
}
