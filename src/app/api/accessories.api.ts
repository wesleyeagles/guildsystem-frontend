import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export const API_BASE = environment.apiUrl;

export const ACCESSORY_SLOTS = ['amulet', 'ring'] as const;
export type AccessorySlot = (typeof ACCESSORY_SLOTS)[number];

export type AccessoryElementName = 'Fire' | 'Water' | 'Earth' | 'Wind';
export type AccessoryElement = { name: AccessoryElementName; value: number };

export type AccessoryEffect = {
  value: number;
  effect: string;
  typeNum: 'Increase' | 'Decrease';
};

export type AccessoryItem = {
  id: number;
  code: string;
  slot: 'Amulet' | 'Ring';
  name: string;
  imagePath: string;
  level: number;
  elements: AccessoryElement[];
  effects: AccessoryEffect[];
};

@Injectable({ providedIn: 'root' })
export class AccessoriesApi {
  private http = inject(HttpClient);

  list(slot: AccessorySlot) {
    return this.http.get<AccessoryItem[]>(`${API_BASE}/accessories/${slot}`);
  }

  get(slot: AccessorySlot, id: number) {
    return this.http.get<AccessoryItem>(`${API_BASE}/accessories/${slot}/${id}`);
  }
}
