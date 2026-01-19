import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export const API_BASE = environment.apiUrl;

export const ARMOR_SLOTS = ['helmet', 'upper', 'lower', 'gloves', 'shoes'] as const;
export type ArmorSlot = (typeof ARMOR_SLOTS)[number];

export type ArmorEffect = {
  effect: string;
  value: number;
  typeNum: 'Increase' | 'Decrease';
};

export type ArmorPart = {
  id: number;
  slot: ArmorSlot;

  code: string;
  name: string;
  imagePath: string;

  grade: { id: number; name: string };
  level: number;

  effects: ArmorEffect[];

  defense: number;
  defenseSuccesRate: number;
};

@Injectable({ providedIn: 'root' })
export class ArmorApi {
  private http = inject(HttpClient);

  list(slot: ArmorSlot) {
    return this.http.get<ArmorPart[]>(`${API_BASE}/armor/${slot}`);
  }

  importSlot(slot: ArmorSlot) {
    return this.http.post(`${API_BASE}/armor/${slot}/import`, {});
  }
}
