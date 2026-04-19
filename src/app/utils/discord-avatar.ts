export type DiscordAvatarInput = {
  discordId: string | null | undefined;
  discordAvatar: string | null | undefined;
  discordDiscriminator: string | null | undefined;
};

export type MemberAvatarInput = DiscordAvatarInput & {
  profileAvatar?: string | null | undefined;
};

function trimSlashRight(s: string) {
  return String(s ?? '').replace(/\/+$/, '');
}

function trimSlashLeft(s: string) {
  return String(s ?? '').replace(/^\/+/, '');
}

function toInt(v: any, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}

function modBigIntString(s: string, mod: number) {
  try {
    const bi = BigInt(s);
    const m = BigInt(mod);
    return Number(bi % m);
  } catch {
    return 0;
  }
}

export function discordAvatarUrl(input: DiscordAvatarInput, size = 64): string | null {
  const discordId = String(input?.discordId ?? '').trim();
  if (!discordId) return null;

  const avatar = String(input?.discordAvatar ?? '').trim();
  const s = Math.max(16, Math.min(512, toInt(size, 64)));

  if (avatar) {
    return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png?size=${s}`;
  }

  const discRaw = String(input?.discordDiscriminator ?? '').trim();
  const hasLegacyDisc = discRaw.length > 0 && discRaw !== '0';

  if (hasLegacyDisc) {
    const discNum = toInt(discRaw, 0);
    const idx = Math.abs(discNum) % 5;
    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
  }

  const idx = modBigIntString(discordId, 6);
  return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
}

/**
 * Avatar exibido no site: foto enviada pelo usuário tem prioridade; senão Discord.
 * `profileAvatar`: path relativo da API (ex. /uploads/profile-avatars/...) ou URL absoluta.
 */
export function memberAvatarUrl(input: MemberAvatarInput, apiBase: string, size = 64): string | null {
  const rel = String(input?.profileAvatar ?? '').trim();
  if (rel) {
    if (/^https?:\/\//i.test(rel)) {
      return rel;
    }
    const base = trimSlashRight(apiBase);
    return `${base}/${trimSlashLeft(rel)}`;
  }
  return discordAvatarUrl(input, size);
}
