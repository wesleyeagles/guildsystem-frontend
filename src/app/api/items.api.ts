import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export const API_BASE = environment.apiUrl;

export const WEAPON_GRADES = ['Normal', 'Intense', 'Orange', 'Green', 'Relic'] as const;
export type WeaponGrade = (typeof WEAPON_GRADES)[number];

export type WeaponData = {
  grade: WeaponGrade;
  level: number;
  minAttack: number;
  maxAttack: number;
  minForceAttack: number;
  maxForceAttack: number;
  castForceId?: number;
  specialEffects?: string[];
  upgrade?: { type: string; quantity: number };
};

export type CastMini = {
  id: number;
  name: string;
  imagePath: string;
  code?: string;
  icon?: number;
  type?: string;
};


export type Item = {
  id: number;
  type: string; // ex: 'weapon'
  name: string;
  imagePath: string;

  data?: WeaponData | null;

  castForce?: CastMini | null;

  createdAt: string;
  updatedAt: string;
};

export type CreateWeaponPayload = {
  name: string;
  type: 'weapon';
  data: WeaponData;
};

export type UpdateWeaponPayload = {
  name?: string;
  data: Partial<WeaponData> & { castForceId?: number | null; upgrade?: any | null };
};

function flattenWeaponPayload(payload: { name?: string; type?: 'weapon'; data?: any }) {
  const out: any = {};
  if (payload.type !== undefined) out.type = payload.type;
  if (payload.name !== undefined) out.name = payload.name;

  const d = payload.data ?? {};
  for (const k of Object.keys(d)) out[k] = d[k];

  return out;
}

@Injectable({ providedIn: 'root' })
export class ItemsApi {
  private http = inject(HttpClient);

  list() {
    return this.http.get<Item[]>(`${environment.apiUrl}/item`);
  }

  get(id: number) {
    return this.http.get<Item>(`${environment.apiUrl}/item/${id}`);
  }

  createWeapon(payload: CreateWeaponPayload, image: File) {
    const fd = new FormData();
    fd.append('image', image);
    fd.append('data', JSON.stringify(flattenWeaponPayload(payload)));
    return this.http.post<Item>(`${environment.apiUrl}/item`, fd);
  }

  updateWeapon(id: number, payload: UpdateWeaponPayload, image?: File) {
    const url = `${environment.apiUrl}/item/${id}`;
    const body = flattenWeaponPayload(payload);

    if (image) {
      const fd = new FormData();
      fd.append('image', image);
      fd.append('data', JSON.stringify(body));
      return this.http.patch<Item>(url, fd);
    }

    return this.http.patch<Item>(url, body);
  }

  remove(id: number) {
    return this.http.delete<{ ok: true }>(`${environment.apiUrl}/item/${id}`);
  }
}
