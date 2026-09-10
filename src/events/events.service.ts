import { Injectable } from '@nestjs/common';
import { Event as EventModel, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { CodanteProvider } from './providers/codante.provider';
import { EventsQueryDto } from './dto/events-query.dto';
import { EventResponseDto } from './dto/event-response.dto';

const EARTH_RADIUS_KM = 6371;
const MAX_LOCAL_EVENTS = 500;

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codante: CodanteProvider,
  ) {}

  async findAll(query: EventsQueryDto) {
    const {
      lat,
      lng,
      radius,
      category,
      search,
      city,
      source = 'ALL',
      page = 1,
      limit = 100,
    } = query;

    const [localEvents, codanteEvents] = await Promise.all([
      source === 'CODANTE'
        ? Promise.resolve<EventResponseDto[]>([])
        : this.findLocalEvents({ lat, lng, radius, category, search }),
      source === 'MAISBLOCO'
        ? Promise.resolve<EventResponseDto[]>([])
        : this.findExternalEvents({ city, category, search }),
    ]);

    let events: EventResponseDto[];
    if (source === 'MAISBLOCO') {
      events = localEvents;
    } else if (source === 'CODANTE') {
      events = codanteEvents;
    } else {
      events = [...localEvents, ...codanteEvents];
    }

    if (
      radius !== undefined &&
      radius > 0 &&
      lat !== undefined &&
      lng !== undefined
    ) {
      events = events.filter((event) => {
        if (
          event.latitude === null ||
          event.longitude === null ||
          !Number.isFinite(event.latitude) ||
          !Number.isFinite(event.longitude)
        ) {
          return false;
        }
        return (
          haversineKm(lat, lng, event.latitude, event.longitude) <= radius
        );
      });
    }

    const total = events.length;
    const offset = (page - 1) * limit;
    const data = events.slice(offset, offset + limit);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: offset + limit < total,
      },
    };
  }

  private async findLocalEvents(params: {
    lat?: number;
    lng?: number;
    radius?: number;
    category?: string;
    search?: string;
  }): Promise<EventResponseDto[]> {
    const { lat, lng, radius, category, search } = params;
    const where: Prisma.EventWhereInput = {};

    if (category) {
      where.category = category;
    }

    if (search) {
      const term = search.trim();
      if (term) {
        where.OR = [
          { name: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
          { address: { contains: term, mode: 'insensitive' } },
        ];
      }
    }

    if (
      lat !== undefined &&
      lng !== undefined &&
      radius !== undefined &&
      radius > 0
    ) {
      const box = boundingBox(lat, lng, radius);
      where.AND = [
        { latitude: { gte: box.latMin, lte: box.latMax } },
        { longitude: { gte: box.lngMin, lte: box.lngMax } },
      ];
    }

    const events = await this.prisma.event.findMany({
      where,
      orderBy: { startAt: 'asc' },
      take: MAX_LOCAL_EVENTS,
    });

    return events.map(mapLocalEvent);
  }

  private async findExternalEvents(params: {
    city?: string;
    category?: string;
    search?: string;
  }): Promise<EventResponseDto[]> {
    const { city, category, search } = params;
    const externalEvents = await this.codante.fetchAgenda(city);

    return externalEvents
      .filter((event) => {
        if (category) {
          return false;
        }
        if (search) {
          const term = search.trim().toLowerCase();
          if (!term) {
            return true;
          }
          return [event.name, event.description, event.city, event.neighborhood]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(term));
        }
        return true;
      })
      .map(mapExternalEvent);
  }
}

function mapLocalEvent(event: EventModel): EventResponseDto {
  return {
    id: event.id,
    name: event.name,
    description: event.description,
    coverImage: event.coverImage,
    address: event.address,
    city: null,
    neighborhood: null,
    latitude: event.latitude,
    longitude: event.longitude,
    startAt: event.startAt.toISOString(),
    category: event.category,
    price: formatEventPrice(event),
    isPaid: event.isPaid,
    externalLink: event.externalLink,
    source: 'MAISBLOCO',
  };
}

function mapExternalEvent(
  event: Awaited<ReturnType<CodanteProvider['fetchAgenda']>>[number],
): EventResponseDto {
  return {
    id: event.id,
    name: event.name,
    description: event.description,
    coverImage: null,
    address: event.address,
    city: event.city,
    neighborhood: event.neighborhood,
    latitude: event.latitude,
    longitude: event.longitude,
    startAt: event.startAt,
    category: null,
    price: event.price,
    isPaid: event.price ? !/grátis|gratuito|free|esgotado/i.test(event.price) : false,
    externalLink: event.externalLink,
    source: 'CODANTE',
  };
}

function formatEventPrice(event: { isPaid: boolean; price: number | null }): string {
  if (!event.isPaid) {
    return 'Grátis';
  }
  if (event.price === null || !Number.isFinite(event.price)) {
    return 'Pago';
  }
  return `R$ ${event.price.toFixed(2).replace('.', ',')}`;
}

function boundingBox(lat: number, lng: number, radiusKm: number) {
  const latDelta = radiusKm / 110.574;
  const lngDelta =
    radiusKm / (111.32 * Math.max(Math.cos(toRadians(lat)), 0.01));
  return {
    latMin: lat - latDelta,
    latMax: lat + latDelta,
    lngMin: lng - lngDelta,
    lngMax: lng + lngDelta,
  };
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}