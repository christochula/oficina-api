import tracer from 'dd-trace';
import { StatsD } from 'hot-shots';
import { JsonLoggerService } from './json-logger.service';
import { TelemetryService } from './telemetry.service';
import { requestContext } from './request-context';

const mockMetrics = {
  distribution: jest.fn(),
  increment: jest.fn(),
  gauge: jest.fn(),
  close: jest.fn((done: () => void) => done()),
};
jest.mock('hot-shots', () => ({ StatsD: jest.fn(() => mockMetrics) }));
const saved = { ...process.env };
describe('structured logs', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    process.env = { ...saved };
  });
  it('correlates request and trace identifiers while preserving structured messages', () => {
    const write = jest.spyOn(process.stdout, 'write').mockReturnValue(true);
    const span = {
      context: () => ({
        toTraceId: () => 'trace-123',
        toSpanId: () => 'span-456',
      }),
    };
    jest
      .spyOn(tracer, 'scope')
      .mockReturnValue({ active: () => span } as unknown as ReturnType<
        typeof tracer.scope
      >);
    process.env.DD_SERVICE = 'oficina-api';
    process.env.DD_ENV = 'homolog';
    process.env.DD_VERSION = 'commit-test';
    requestContext.run({ correlationId: 'request-123' }, () =>
      new JsonLoggerService().log(
        { event: 'saga-step', saga_id: 'saga-123' },
        'Worker',
      ),
    );
    const entry = JSON.parse(String(write.mock.calls[0][0]));
    expect(entry).toMatchObject({
      level: 'info',
      service: 'oficina-api',
      env: 'homolog',
      version: 'commit-test',
      correlation_id: 'request-123',
      context: 'Worker',
      'dd.trace_id': 'trace-123',
      'dd.span_id': 'span-456',
      message: { event: 'saga-step', saga_id: 'saga-123' },
    });
  });
  it('serializes errors and bigint and sends failures to stderr', () => {
    const stderr = jest.spyOn(process.stderr, 'write').mockReturnValue(true);
    const stdout = jest.spyOn(process.stdout, 'write').mockReturnValue(true);
    jest
      .spyOn(tracer, 'scope')
      .mockReturnValue({ active: () => null } as unknown as ReturnType<
        typeof tracer.scope
      >);
    delete process.env.DD_SERVICE;
    delete process.env.DD_ENV;
    delete process.env.DD_VERSION;
    delete process.env.npm_package_version;
    delete process.env.NODE_ENV;
    const logger = new JsonLoggerService();
    logger.error(new Error('offline'), 'safe-stack', 'Infrastructure');
    logger.warn('retrying');
    logger.debug(42n);
    logger.verbose('details');
    expect(JSON.parse(String(stderr.mock.calls[0][0]))).toMatchObject({
      level: 'error',
      message: 'offline',
      stack: 'safe-stack',
      service: 'oficina-api',
      env: 'local',
      version: 'dev',
    });
    expect(JSON.parse(String(stderr.mock.calls[1][0])).level).toBe('warn');
    expect(JSON.parse(String(stdout.mock.calls[0][0])).message).toBe('42');
    expect(JSON.parse(String(stdout.mock.calls[1][0])).level).toBe('debug');
  });
});

describe('business and operational telemetry', () => {
  const logger = { warn: jest.fn() };
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => {
    process.env = { ...saved };
  });
  it('emits units/tags used by the dashboard and separates compensations from ordinary transitions', async () => {
    const service = new TelemetryService(
      logger as unknown as JsonLoggerService,
    );
    service.apiRequest(25, 'get', 200);
    service.serviceOrderCreated();
    service.serviceOrderTransition('EM_EXECUCAO');
    service.serviceOrderStatusDuration('EM_DIAGNOSTICO', 1000);
    service.serviceOrderStatusDuration('EM_EXECUCAO', 2000);
    service.serviceOrderStatusDuration('FINALIZADA', 3000);
    service.serviceOrderStatusDuration('AWAITING_APPROVAL', 4000);
    service.serviceOrderProcessingFailure('consume');
    service.integrationError('mercadopago');
    service.sagaTransition('reserve', 'RESERVING_EXECUTION');
    service.sagaTransition('release', 'COMPENSATED');
    service.messageProcessed();
    service.messageProcessed(true);
    service.sagaPendingAge(25, 'PREPARING_BUDGET');
    service.sagaPendingAge(0);
    expect(mockMetrics.distribution).toHaveBeenCalledWith(
      'oficina.api.request.duration_ms',
      25,
      1,
      { method: 'GET', status_code: '200' },
    );
    expect(mockMetrics.distribution).toHaveBeenCalledTimes(4);
    expect(mockMetrics.increment).toHaveBeenCalledWith(
      'oficina.saga.compensations',
      1,
      1,
      { step: 'release', status: 'COMPENSATED' },
    );
    expect(mockMetrics.increment).toHaveBeenCalledWith(
      'oficina.messaging.failed',
      1,
      1,
      { queue: 'os-events' },
    );
    expect(mockMetrics.gauge).toHaveBeenCalledWith(
      'oficina.saga.pending_age_seconds',
      0,
      { step: 'unknown' },
    );
    await service.onModuleDestroy();
    expect(mockMetrics.close).toHaveBeenCalledTimes(1);
  });
  it('uses deploy tags and a configured agent without opening a real socket in tests', () => {
    process.env.DD_SERVICE = 'oficina-api';
    process.env.DD_ENV = 'homolog';
    process.env.DD_VERSION = 'release';
    process.env.DD_AGENT_HOST = '10.0.0.1';
    process.env.DD_DOGSTATSD_PORT = '9125';
    new TelemetryService(logger as unknown as JsonLoggerService);
    const options = (StatsD as unknown as jest.Mock).mock.calls[0][0] as {
      errorHandler: (error: Error) => void;
    };
    expect(options).toMatchObject({
      host: '10.0.0.1',
      port: 9125,
      mock: true,
      globalTags: {
        env: 'homolog',
        service: 'oficina-api',
        version: 'release',
      },
    });
    options.errorHandler(new Error('agent unavailable'));
    expect(logger.warn).toHaveBeenCalledWith(
      { event: 'dogstatsd_delivery_failed', error: 'agent unavailable' },
      'TelemetryService',
    );
  });
  it('supports explicitly disabled delivery and fallback tags in non-test processes', () => {
    process.env.NODE_ENV = 'production';
    process.env.DD_METRICS_ENABLED = 'false';
    delete process.env.DD_ENV;
    delete process.env.DD_SERVICE;
    delete process.env.DD_VERSION;
    delete process.env.DD_AGENT_HOST;
    delete process.env.DD_DOGSTATSD_PORT;
    process.env.npm_package_version = '4.0.0';
    new TelemetryService(logger as unknown as JsonLoggerService);
    expect((StatsD as unknown as jest.Mock).mock.calls[0][0]).toMatchObject({
      mock: true,
      globalTags: { env: 'production', version: '4.0.0' },
    });
    delete process.env.NODE_ENV;
    delete process.env.npm_package_version;
    new TelemetryService(logger as unknown as JsonLoggerService);
    expect((StatsD as unknown as jest.Mock).mock.calls[1][0]).toMatchObject({
      globalTags: { env: 'local', version: 'dev' },
    });
    process.env.NODE_ENV = 'production';
    process.env.DD_METRICS_ENABLED = 'true';
    new TelemetryService(logger as unknown as JsonLoggerService);
    expect((StatsD as unknown as jest.Mock).mock.calls[2][0]).toMatchObject({
      mock: false,
    });
  });
});
