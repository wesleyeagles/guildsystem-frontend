import { Inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import type { ItemDto } from '../../../api/items.api';
import { ItemModalResult } from '../ui/item-modal/item-modal.component';
import { API_URL } from '../../../core/api-urls.tokens';

type UploadImageResponse = { imagePath: string };

@Injectable({ providedIn: 'root' })
export class ItemsEditorService {
  constructor(
    private http: HttpClient,
    @Inject(API_URL) private apiUrl: string,
  ) {}

  uploadImage(file: File) {
    const fd = new FormData();
    fd.append('file', file, file.name);

    // ✅ absoluto, vindo do environment
    return this.http.post<UploadImageResponse>(`${this.apiUrl}/items/upload-image`, fd);
  }

  createItem(payload: any) {
    return this.http.post<ItemDto>(`${this.apiUrl}/items`, payload);
  }

  updateItem(id: number, payload: any) {
    return this.http.put<ItemDto>(`${this.apiUrl}/items/${id}`, payload);
  }

  async saveFromModal(result: ItemModalResult): Promise<ItemDto> {
    const payload = { ...(result.payload ?? {}) };

    if (result.uploadFile) {
      const up = await firstValueFrom(this.uploadImage(result.uploadFile));
      payload.imagePath = up?.imagePath ?? null;
    }

    if (result.mode === 'create') {
      return await firstValueFrom(this.createItem(payload));
    }

    const id = Number(result.id);
    if (!Number.isFinite(id) || id <= 0) throw new Error('ID inválido no edit');
    return await firstValueFrom(this.updateItem(id, payload));
  }
}
