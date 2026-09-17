import { ExpoPushService } from './expo-push.service';
jest.mock('@nestjs/common', () => require('../test/mock-nest-common'));
jest.mock('@nestjs/config', () => ({ ConfigService: class {} }));

describe('Expo Push transport', () => {
  const originalFetch = global.fetch;
  const fetchMock = jest.fn();
  const service = new ExpoPushService({ get: () => 'access-token' } as never);
  beforeEach(() => {
    global.fetch = fetchMock;
    fetchMock.mockReset();
  });
  afterAll(() => {
    global.fetch = originalFetch;
  });
  it('sends bearer credentials only to the Expo endpoint', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ status: 'ok', id: 'ticket' }] }),
    });
    await expect(service.send({ to: 'token' } as never)).resolves.toEqual({
      status: 'ok',
      id: 'ticket',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://exp.host/--/api/v2/push/send',
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer access-token',
        },
      }),
    );
  });
  it.each([429, 500, 503])('retries HTTP %s', async (status) => {
    fetchMock.mockResolvedValue({ ok: false, status });
    await expect(service.send({} as never)).rejects.toMatchObject({
      retryable: true,
    });
  });
  it('does not retry invalid credentials indefinitely', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 });
    await expect(service.send({} as never)).rejects.toMatchObject({
      retryable: false,
    });
  });
  it('rejects malformed tickets instead of silently losing delivery', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ status: 'ok' }] }),
    });
    await expect(service.send({} as never)).rejects.toMatchObject({
      code: 'INVALID_TICKET',
    });
  });
  it('returns absent receipts for later retry', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: {} }) });
    await expect(service.receipt('ticket')).resolves.toBeUndefined();
  });
});
