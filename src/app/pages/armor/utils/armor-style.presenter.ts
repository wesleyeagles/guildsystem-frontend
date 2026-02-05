import { Injectable } from '@angular/core';
import { ArmorPart } from '../../../api/armor.api';

type GradeName = string;

const GRADE_NAME_CLASS: Record<string, string> = {
  Normal: 'text-white',
  Intense: 'text-[#ffffa3]', 
  Orange: 'text-[#eaa037]',
  Relic: 'text-[#1188e2]',
  Pink: 'text-[#dfbae6]',
  Green: 'text-green-300',
  Hero: 'text-[#69d474]',
  DarkRay: 'text-[#8af28f]',
  Leon: 'text-[#8af28f]',
  Pvp: 'text-[#f1daba]',
  Red: 'text-red-300',
};

const GRADE_RGB: Record<string, string> = {
  Normal: '255, 255, 255',
  Intense: '255, 255, 163',
  Orange: '234, 160, 55',
  Relic: '17, 136, 226',
  Pink: '223, 186, 230',

  Green: '134, 239, 172',
  Hero: '105, 212, 116',
  DarkRay: '138, 242, 143',

  Leon: '138, 242, 143',
  Pvp: '241, 218, 186',
  Red: '252, 165, 165',
};

@Injectable({ providedIn: 'root' })
export class ArmorStylePresenter  {
  nameClass(h: ArmorPart): string {
    const key = String((h.grade?.name as GradeName) ?? 'Unknown');
    return GRADE_NAME_CLASS[key] ?? 'text-slate-100';
  }

  gradeRgbByName(name: string): string {
    const key = String(name ?? 'Unknown');
    return GRADE_RGB[key] ?? '148, 163, 184';
  }

  gradeRgb(h: ArmorPart): string {
    const key = String((h.grade?.name as GradeName) ?? 'Unknown');
    return GRADE_RGB[key] ?? '148, 163, 184';
  }
}
