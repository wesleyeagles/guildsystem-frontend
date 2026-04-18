import type { ColDef, ICellRendererParams } from 'ag-grid-community';
import { imgRenderer } from '../../shared/table/renderers/img.renderer';
import { effectsChipsRenderer } from '../../shared/table/renderers/effects-chips.renderer';
import { escapeHtml } from '../../shared/table/table.utils';
import type { DataTableConfig } from '../../shared/table/table.types';

import { ArmorStylePresenter } from './utils/armor-style.presenter';
import { ArmorEffectsPresenter } from './utils/armor-effects.presenter';
import type { ArmorEffect, ArmorPart } from '../../api/armor.api';

type ArmorRace = 'Accretia' | 'Bellato' | 'Cora' | 'Unknown';
type ArmorClass = 'Warrior' | 'Ranger' | 'Force' | 'Launcher' | 'Unknown';

function parseRaceFromCode(codeRaw: string | null | undefined): ArmorRace {
  const code = String(codeRaw ?? '').trim().toLowerCase();
  const c = code.length >= 3 ? code[2] : '';
  if (c === 'a') return 'Accretia';
  if (c === 'b') return 'Bellato';
  if (c === 'c') return 'Cora';
  return 'Unknown';
}

function parseClassFromCode(codeRaw: string | null | undefined): { cls: ArmorClass; race: ArmorRace } {
  const code = String(codeRaw ?? '').trim().toLowerCase();

  const race = parseRaceFromCode(codeRaw);
  const c = code.length >= 4 ? code[3] : '';

  if (c === 'w') return { cls: 'Warrior', race };
  if (c === 'r') return { cls: 'Ranger', race };
  if (c === 'f') return { cls: race === 'Accretia' ? 'Launcher' : 'Force', race };

  return { cls: 'Unknown', race };
}

export function createArmorTableConfig(
  baseUrl: string,
  style: ArmorStylePresenter,
  effects: ArmorEffectsPresenter,
): DataTableConfig<ArmorPart> {
  const gradeOptions = [
    'Normal','Intense','Purple','Orange','Relic','Pink','Hero','Leon','Pvp','Red','Unknown',
  ].filter((g) => !['Unknown', 'Pink', 'Red', 'Purple', 'Pvp', 'Leon'].includes(g));

  const colDefs: ColDef<ArmorPart>[] = [
    {
      headerName: 'Ícone',
      field: 'imagePath',
      width: 80,
      sortable: false,
      filter: false,
      cellRenderer: imgRenderer<ArmorPart>(baseUrl, (w) => style.gradeRgb(w)),
      cellStyle: { justifyContent: 'center' },
      pinned: 'left',
    },
    {
      headerName: 'Nome',
      field: 'name',
      width: 220,
      cellRenderer: (p: ICellRendererParams<ArmorPart>) => {
        const w = p.data;
        const name = escapeHtml(String(p.value ?? ''));
        if (!w) return name;

        const rgb = style.gradeRgb(w);
        return `<span style="color: rgb(${rgb}); font-weight: 600;">${name}</span>`;
      },
      cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'flex-start' },
    },

    { field: 'level', width: 90 },

    { headerName: 'Defense', valueGetter: (p) => p.data?.defense ?? 0, width: 120 },
    { headerName: 'Defense Success Rate', valueGetter: (p) => p.data?.defenseSuccesRate ?? 0, width: 180 },

    {
      headerName: 'Efeitos',
      width: 950,
      minWidth: 660,
      sortable: false,
      filter: false,
      cellRenderer: effectsChipsRenderer<ArmorPart, ArmorEffect>(effects),
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
    id: 'armors',
    colDefs,
    rowHeight: 65,

    chipFilters: [
      {
        id: 'grade',
        label: 'Grade',
        allLabel: 'Todos',
        options: gradeOptions,
        getValue: (w) => w.grade?.name ?? 'Unknown',
        rgbByOption: (g) => style.gradeRgbByName(g),
      },
      {
        id: 'race',
        label: 'Raça',
        allLabel: 'Todas',
        options: ['Accretia', 'Bellato', 'Cora'],
        getValue: (w) => parseRaceFromCode(w.code),
        rgbByOption: (r) =>
          r === 'Accretia' ? '252, 165, 165'
          : r === 'Bellato' ? '255, 255, 163'
          : r === 'Cora' ? '105, 212, 116'
          : '148, 163, 184',
      },
      {
        id: 'class',
        label: 'Classe',
        allLabel: 'Todas',
        options: ['Warrior', 'Ranger', 'Force', 'Launcher'],
        getValue: (w) => parseClassFromCode(w.code).cls,
      },
    ],

    quickFilterPlaceholder: 'Buscar...',
  };
}
