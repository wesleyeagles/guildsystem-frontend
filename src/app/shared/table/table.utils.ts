export const joinUrl = (base: string, path: string) => {
    const b = base.replace(/\/+$/, '');
    const p = path.replace(/^\/+/, '');
    return `${b}/${p}`;
};

export const escapeHtml = (s: string) =>
    s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
