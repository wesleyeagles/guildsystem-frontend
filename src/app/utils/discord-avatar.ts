export type DiscordAvatarInput = {
  discordId: string | null | undefined;
  discordAvatar: string | null | undefined;
  discordDiscriminator: string | null | undefined;
};

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
