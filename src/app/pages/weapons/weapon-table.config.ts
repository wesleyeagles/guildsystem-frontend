import type { ColDef, ICellRendererParams } from 'ag-grid-community';
import { imgRenderer } from '../../shared/table/renderers/img.renderer';
import { effectsChipsRenderer } from '../../shared/table/renderers/effects-chips.renderer';
import { escapeHtml } from '../../shared/table/table.utils';
import type { DataTableConfig } from '../../shared/table/table.types';
import { WeaponStylePresenter } from './utils/weapon-style.presenter';
import { WeaponEffectsPresenter } from './utils/weapon-effects.presenter';
import { Weapon, WeaponEffect } from '../../api/weapons.api';

export function createWeaponTableConfig(
  baseUrl: string,
  style: WeaponStylePresenter,
  effects: WeaponEffectsPresenter,
): DataTableConfig<Weapon> {
  const gradeOptions = [
    'Normal','Intense','Purple','Orange','Relic','Pink','Hero','Leon','Pvp','Red','Unknown',
  ].filter((g) => !['Unknown', 'Pink', 'Red'].includes(g));

  const colDefs: ColDef<Weapon>[] = [
    {
      headerName: 'Ícone',
      field: 'imagePath',
      width: 80,
      sortable: false,
      filter: false,
      cellRenderer: imgRenderer<Weapon>(baseUrl, (w) => style.gradeRgb(w)),
      cellStyle: { justifyContent: 'center' },
      pinned: 'left',
    },
    {
      headerName: 'Nome',
      field: 'name',
      width: 170,
      cellRenderer: (p: ICellRendererParams<Weapon>) => {
        const w = p.data;
        const name = escapeHtml(String(p.value ?? ''));
        if (!w) return name;

        const rgb = style.gradeRgb(w);
        return `<span style="color: rgb(${rgb}); font-weight: 600;">${name}</span>`;
      },
      cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'flex-start' },
    },

    { field: 'level', width: 90 },

    { headerName: 'Atk Min', valueGetter: (p) => p.data?.attack?.min ?? 0, width: 120 },
    { headerName: 'Atk Max', valueGetter: (p) => p.data?.attack?.max ?? 0, width: 120 },

    { headerName: 'Force Min', valueGetter: (p) => p.data?.forceAttack?.min ?? 0, width: 130 },
    { headerName: 'Force Max', valueGetter: (p) => p.data?.forceAttack?.max ?? 0, width: 130 },

    {
      headerName: 'Cast',
      valueGetter: (p) => p.data?.cast?.imagePath ?? null,
      width: 80,
      sortable: false,
      filter: false,
      cellRenderer: imgRenderer<Weapon>(baseUrl, (w) => style.gradeRgb(w)),
      cellStyle: { justifyContent: 'center' },
    },

    {
      headerName: 'Efeitos',
      width: 720,
      minWidth: 660,
      sortable: false,
      filter: false,
      cellRenderer: effectsChipsRenderer<Weapon, WeaponEffect>(effects),
      tooltipValueGetter: (p) => {
        const w = p.data;
        if (!w) return '';
        return effects
          .displayEffects(w)
          .map((e) => `${e.effect} ${effects.formatEffectValue(e)}`)
          .join('\n');
      },
      getQuickFilterText: (p) => (p.data ? effects.effectsSearchText(p.data) : ''),
      cellStyle: { display: 'block', paddingTop: '10px', paddingBottom: '10px' },
    },
  ];

  return {
    id: 'weapons',
    colDefs,
    rowHeight: 65,

    chipFilter: {
      allLabel: 'Todos',
      options: gradeOptions,
      getValue: (w) => w.grade?.name ?? 'Unknown',
      rgbByOption: (g) => style.gradeRgbByName(g),
    },

    quickFilterPlaceholder: 'Buscar...',
  };
}
