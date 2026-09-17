import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type ExpoResult = {
  status: 'ok' | 'error';
  id?: string;
  details?: { error?: string };
};
export type PushMessage = {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  channelId: string;
  priority: 'high';
  ttl: number;
  data: Record<string, string | number>;
};
export class PushTransportError extends Error {
  constructor(
    public code: string,
    public retryable: boolean,
  ) {
    super(code);
  }
}

@Injectable()
export class ExpoPushService {
  constructor(private readonly config: ConfigService) {}

  private async request(path: string, body: unknown): Promise<unknown> {
    let response: Response;
    try {
      const token = this.config.get<string>('EXPO_ACCESS_TOKEN');
      response = await fetch(`https://exp.host/--/api/v2/push/${path}`, {
        method: 'POST',
        signal: AbortSignal.timeout(10_000),
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
    } catch {
      throw new PushTransportError('NETWORK_ERROR', true);
    }
    if (!response.ok)
      throw new PushTransportError(
        `HTTP_${response.status}`,
        response.status === 429 || response.status >= 500,
      );
    try {
      const result = (await response.json()) as {
        data?: unknown;
        errors?: { code: string }[];
      };
      if (result.errors?.length)
        throw new PushTransportError(
          result.errors[0].code,
          result.errors[0].code === 'TOO_MANY_REQUESTS',
        );
      if (!result.data) throw new PushTransportError('INVALID_RESPONSE', true);
      return result.data;
    } catch (error) {
      if (error instanceof PushTransportError) throw error;
      throw new PushTransportError('INVALID_RESPONSE', true);
    }
  }

  async send(message: PushMessage): Promise<ExpoResult> {
    const results = await this.request('send', [message]);
    const result = Array.isArray(results)
      ? (results[0] as ExpoResult)
      : undefined;
    if (
      !result ||
      !['ok', 'error'].includes(result.status) ||
      (result.status === 'ok' && !result.id)
    ) {
      throw new PushTransportError('INVALID_TICKET', true);
    }
    return result;
  }

  async receipt(id: string): Promise<ExpoResult | undefined> {
    const results = (await this.request('getReceipts', {
      ids: [id],
    })) as Record<string, ExpoResult>;
    const result = results[id];
    if (result && !['ok', 'error'].includes(result.status))
      throw new PushTransportError('INVALID_RECEIPT', true);
    return result;
  }
}
