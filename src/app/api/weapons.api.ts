import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export const API_BASE = environment.apiUrl;

export type WeaponEffect = {
  effect: string;
  value: number; // já vem normalizado do backend
  typeNum: 'Increase' | 'Decrease';
};

export type Weapon = {
  id: number;
  code: string;
  name: string;
  imagePath: string;

  grade: { id: number; name: string };
  level: number;

  effects: WeaponEffect[];

  attack: { min: number; max: number };
  forceAttack: { min: number; max: number };

  cast: { id: number; name: string; imagePath: string } | null;
};

@Injectable({ providedIn: 'root' })
export class WeaponsApi {
  private http = inject(HttpClient);

  list() {
    return this.http.get<Weapon[]>(`${API_BASE}/weapon`);
  }

  importAll() {
    return this.http.post(`${API_BASE}/weapon/import`, {});
  }
}
