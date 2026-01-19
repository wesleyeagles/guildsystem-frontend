import { Injectable } from '@angular/core';
import { Helmet } from '../../api/helmets.api';

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
  Normal: '255, 255, 255',      // text-white
  Intense: '255, 255, 163',     // #ffffa3
  Orange: '234, 160, 55',       // #eaa037
  Relic: '17, 136, 226',        // #1188e2
  Pink: '223, 186, 230',        // #dfbae6

  Green: '134, 239, 172',       // text-green-300 (Tailwind)
  Hero: '105, 212, 116',        // #69d474
  DarkRay: '138, 242, 143',     // #8af28f

  Leon: '138, 242, 143',        // #8af28f
  Pvp: '241, 218, 186',         // #f1daba
  Red: '252, 165, 165',         // text-red-300 (Tailwind)
};

@Injectable({ providedIn: 'root' })
export class HelmetStylePresenter {
  nameClass(h: Helmet): string {
    const key = String((h.grade?.name as GradeName) ?? 'Unknown');
    return GRADE_NAME_CLASS[key] ?? 'text-slate-100';
  }

  gradeRgb(h: Helmet): string {
    const key = String((h.grade?.name as GradeName) ?? 'Unknown');
    return GRADE_RGB[key] ?? '148, 163, 184';
  }
}
