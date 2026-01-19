import { Injectable } from '@angular/core';
import type { ShieldApi } from '../../api/shields.api';

type GradeName =
  | 'Normal'
  | 'Purple'
  | 'Intense'
  | 'Orange'
  | 'Relic'
  | 'Pink'
  | 'Unknown'
  | 'Hero'
  | 'Leon'
  | 'Pvp'
  | 'Red'
  | string;

const GRADE_NAME_CLASS: Record<string, string> = {
  Normal: 'text-white',
  Purple: 'text-[#ffffa3]',
  Intense: 'text-[#b5a3d3]',
  Orange: 'text-[#eaa037]',
  Relic: 'text-[#1188e2]',
  Pink: 'text-[#dfbae6]',
  Unknown: 'text-slate-300',
  Hero: 'text-[#69d474]',
  Leon: 'text-[#8af28f]',
  Pvp: 'text-[#f1daba]',
  Red: 'text-red-300',
};

const GRADE_RGB: Record<string, string> = {
  Normal: '255, 255, 255',
  Purple: '255, 255, 163',
  Intense: '181, 163, 211',
  Orange: '234, 160, 55',
  Relic: '17, 136, 226',
  Pink: '223, 186, 230',
  Unknown: '134, 239, 172',
  Hero: '105, 212, 116',
  Leon: '138, 242, 143',
  Pvp: '241, 218, 186',
  Red: '252, 165, 165',
};

@Injectable({ providedIn: 'root' })
export class ShieldsStylePresenter {
  nameClass(it: ShieldApi): string {
    const key = String((it.grade?.name as GradeName) ?? 'Unknown');
    return GRADE_NAME_CLASS[key] ?? 'text-slate-100';
  }
  
  gradeRgb(it: ShieldApi): string {
    const key = String((it.grade?.name as GradeName) ?? 'Unknown');
    return GRADE_RGB[key] ?? '148, 163, 184';
  }
}
