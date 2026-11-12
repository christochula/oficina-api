import { BadGatewayException, HttpException } from '@nestjs/common';
import { DistributedInventoryController } from './inventory.controller';
describe('Inventory compatibility facade', () => {
  let controller: DistributedInventoryController;
  let fetcher: jest.SpyInstance;
  beforeEach(() => {
    process.env.PRODUCTION_SERVICE_URL = 'http://production:3002/';
    controller = new DistributedInventoryController();
    fetcher = jest.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            data: [{ peca: { id: 'pc1' } }],
            meta: { total: 1 },
          }),
          { status: 200 },
        ),
    );
  });
  afterEach(() => jest.restoreAllMocks());
  it('proxies list and all mutations to Production while preserving envelope and bearer authorization', async () => {
    expect(
      await controller.list('Bearer token', {
        pagina: '1',
        porPagina: '20',
        busca: 'óleo & filtro',
        ativo: 'true',
        filialId: 'filial-sp',
        ignored: 'secret',
      }),
    ).toMatchObject({ meta: { total: 1 } });
    const call = fetcher.mock.calls[0];
    expect(call[0]).toBe(
      'http://production:3002/api/v1/production/inventory?pagina=1&porPagina=20&busca=%C3%B3leo+%26+filtro&ativo=true&filialId=filial-sp',
    );
    expect(call[1].headers.Authorization).toBe('Bearer token');
    await controller.get('Bearer token', 'pc/1', { filialId: 'sp' });
    await controller.create('Bearer token', { codigo: 'FILTRO' });
    await controller.update(
      'Bearer token',
      'pc1',
      { nome: 'Peça' },
      { filialId: 'sp' },
    );
    await controller.entry(
      'Bearer token',
      'pc1',
      { quantidade: 1 },
      { filialId: 'sp' },
    );
    await controller.activate('Bearer token', 'pc1', {});
    await controller.deactivate('Bearer token', 'pc1', {});
    expect(fetcher.mock.calls.map((c) => c[1].method)).toEqual([
      'GET',
      'GET',
      'POST',
      'PATCH',
      'PATCH',
      'PATCH',
      'PATCH',
    ]);
    expect(fetcher.mock.calls[1][0]).toContain('pc%2F1');
  });
  it('fails missing configuration/network and preserves owner service HTTP rejection', async () => {
    delete process.env.PRODUCTION_SERVICE_URL;
    await expect(controller.list('Bearer token', {})).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    process.env.PRODUCTION_SERVICE_URL = 'http://production';
    fetcher.mockRejectedValueOnce(new Error('network'));
    await expect(controller.list('Bearer token', {})).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    fetcher.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 }),
    );
    await expect(
      controller.get('Bearer token', 'p', {}),
    ).rejects.toBeInstanceOf(HttpException);
    fetcher.mockResolvedValueOnce(new Response('invalid', { status: 503 }));
    await expect(controller.get('Bearer token', 'p', {})).rejects.toThrow(
      'Falha ao consultar estoque',
    );
  });
});
