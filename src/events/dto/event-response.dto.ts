export type EventSource = 'goBloco' | 'CODANTE';

export class EventResponseDto {
  id: number | string;
  name: string;
  description: string | null;
  coverImage: string | null;
  address: string | null;
  city: string | null;
  neighborhood: string | null;
  latitude: number | null;
  longitude: number | null;
  startAt: string | null;
  category: string | null;
  price: string | null;
  isPaid: boolean;
  externalLink: string | null;
  source: EventSource;
}

export interface EventsMetaDto {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
}

export class EventsListResponseDto {
  data: EventResponseDto[];
  meta: EventsMetaDto;
}