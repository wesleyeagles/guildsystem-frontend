import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

const API_BASE = environment.apiUrl;

export const NEWS_POST_TAGS = [
  'Anúncio',
  'Patch',
  'Evento',
  'Guia',
  'Sistema',
  'Devlog',
] as const;

export type NewsPostTag = (typeof NEWS_POST_TAGS)[number];

export interface NewsPostDto {
  id: number;
  title: string;
  text: string;
  tag: NewsPostTag;
  isImportant: boolean;
  createdAt: string;
}

export interface CreateNewsPostBody {
  title: string;
  text: string;
  tag: NewsPostTag;
  isImportant?: boolean;
}

@Injectable({ providedIn: 'root' })
export class NewsApi {
  private http = inject(HttpClient);

  list() {
    return this.http.get<NewsPostDto[]>(`${API_BASE}/news`);
  }

  create(body: CreateNewsPostBody) {
    return this.http.post<NewsPostDto>(`${API_BASE}/news`, body, { withCredentials: true });
  }
}
