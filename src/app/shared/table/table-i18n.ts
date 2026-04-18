import type { TranslocoService } from '@jsverse/transloco';

/**
 * Use no ColDef em vez de `headerName: this.transloco.translate(...)`.
 * O texto do cabeçalho passa a ser resolvido quando o AG Grid desenha o header
 * (e após `refreshHeader` ao mudar idioma / carregar traduções).
 */
export function headerT(transloco: TranslocoService, key: string, params?: Record<string, unknown>) {
  return {
    headerValueGetter: () => transloco.translate(key, params),
  };
}
