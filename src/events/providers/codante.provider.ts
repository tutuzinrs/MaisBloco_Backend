import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { EventSource } from '../dto/event-response.dto';

const CODANTE_BASE_URL = 'https://apis.codante.io/api/bloquinhos2025/agenda';
const COLADA_PAGE_SIZE = 10;

interface CodanteRawEvent {
  id: number;
  title: string;
  description: string | null;
  date_time: string | null;
  address: string | null;
  complete_address: string | null;
  city: string | null;
  neighborhood: string | null;
  price: string | null;
  event_url: string | null;
}

export interface CodanteEvent {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  city: string | null;
  neighborhood: string | null;
  latitude: number | null;
  longitude: number | null;
  startAt: string | null;
  price: string | null;
  externalLink: string | null;
  source: EventSource;
}

interface CodantePagePayload {
  data: CodanteRawEvent[];
}

@Injectable()
export class CodanteProvider {
  private readonly logger = new Logger(CodanteProvider.name);
  private readonly cache = new Map<string, { events: CodanteEvent[]; fetchedAt: number }>();
  private inFlight: Promise<CodanteEvent[]> | null = null;

  constructor(private readonly config: ConfigService) {}

  async fetchAgenda(city?: string): Promise<CodanteEvent[]> {
    const cacheKey = city?.toLowerCase().trim() ?? '*';
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < this.cacheTtlMs) {
      return cached.events;
    }

    if (this.inFlight) {
      return this.inFlight;
    }

    this.inFlight = this.load(city)
      .then((events) => {
        this.cache.set(cacheKey, { events, fetchedAt: Date.now() });
        return events;
      })
      .catch((error) => {
        this.logger.warn(`Falha ao buscar a agenda da Codante: ${error}`);
        const fallback = this.cache.get(cacheKey);
        if (fallback) {
          return fallback.events;
        }
        return [];
      })
      .finally(() => {
        this.inFlight = null;
      });

    return this.inFlight;
  }

  private async load(city?: string): Promise<CodanteEvent[]> {
    const normalizedCity = city?.trim().toLowerCase();
    const maxPages = this.maxPages;
    const events: CodanteEvent[] = [];
    let reachedEnd = false;

    for (let batchStart = 1; batchStart <= maxPages && !reachedEnd; batchStart += 5) {
      const batchEnd = Math.min(batchStart + 4, maxPages);
      const pages = await Promise.all(
        Array.from({ length: batchEnd - batchStart + 1 }, (_, index) =>
          this.fetchPage(batchStart + index).catch(() => []),
        ),
      );

      for (const rawEvents of pages) {
        if (rawEvents.length < COLADA_PAGE_SIZE) {
          reachedEnd = true;
        }
        const mapped = rawEvents
          .map((event) => this.mapRawEvent(event))
          .filter((event) => !normalizedCity || event.city?.toLowerCase().trim() === normalizedCity);
        events.push(...mapped);
      }
    }

    return events;
  }

  private async fetchPage(page: number): Promise<CodanteRawEvent[]> {
    const url = `${CODANTE_BASE_URL}?page=${page}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Codante respondeu com status ${response.status}`);
      }
      const payload = (await response.json()) as CodantePagePayload;
      return Array.isArray(payload.data) ? payload.data : [];
    } finally {
      clearTimeout(timeout);
    }
  }

  private mapRawEvent(event: CodanteRawEvent): CodanteEvent {
    return {
      id: `codante-${event.id}`,
      name: event.title?.trim() ?? 'Bloco sem nome',
      description: event.description?.trim() || null,
      address: event.complete_address?.trim() || event.address?.trim() || null,
      city: event.city?.trim() || null,
      neighborhood: event.neighborhood?.trim() || null,
      latitude: null,
      longitude: null,
      startAt: event.date_time ? new Date(event.date_time).toISOString() : null,
      price: event.price?.trim() || null,
      externalLink: event.event_url?.trim() || null,
      source: 'CODANTE',
    };
  }

  private get maxPages(): number {
    const parsed = Number(this.config.get<string>('CODANTE_MAX_PAGES'));
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 30;
  }

  private get cacheTtlMs(): number {
    const parsed = Number(this.config.get<string>('CODANTE_CACHE_TTL_MS'));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 10 * 60 * 1000;
  }

  private get timeoutMs(): number {
    const parsed = Number(this.config.get<string>('CODANTE_TIMEOUT_MS'));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 8000;
  }
}