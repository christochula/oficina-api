import tracer from 'dd-trace';
import { captureTraceparent, traceOutbox } from './trace-context';

describe('durable W3C context', () => {
  const value = '00-12345678901234567890123456789012-1234567890123456-01';
  afterEach(() => jest.restoreAllMocks());
  it('captures active span context even when the browser supplied no parent', () => {
    const active = { context: () => ({}) };
    jest
      .spyOn(tracer, 'scope')
      .mockReturnValue({ active: () => active } as unknown as ReturnType<
        typeof tracer.scope
      >);
    jest
      .spyOn(tracer, 'inject')
      .mockImplementation((_span, _format, carrier) => {
        (carrier as Record<string, string>).traceparent = value;
      });
    expect(captureTraceparent()).toBe(value);
  });
  it('retains a valid incoming parent when the tracer is disabled', () => {
    jest
      .spyOn(tracer, 'scope')
      .mockReturnValue({ active: () => null } as unknown as ReturnType<
        typeof tracer.scope
      >);
    expect(captureTraceparent(value)).toBe(value);
    expect(captureTraceparent('untrusted-value')).toBeUndefined();
    expect(captureTraceparent()).toBeUndefined();
  });
  it('does not let instrumentation errors break business requests', () => {
    jest.spyOn(tracer, 'scope').mockImplementation(() => {
      throw new Error('tracer unavailable');
    });
    expect(captureTraceparent(value)).toBe(value);
  });

  it('restores the durable parent and sends a copy with the producer span, preserving message identity', async () => {
    const child = '00-12345678901234567890123456789012-9876543210123456-01';
    const context = {};
    const parent = {} as NonNullable<ReturnType<typeof tracer.extract>>;
    jest.spyOn(tracer, 'extract').mockReturnValue(parent);
    jest.spyOn(tracer, 'scope').mockReturnValue({
      active: () => ({ context: () => context }),
    } as unknown as ReturnType<typeof tracer.scope>);
    jest
      .spyOn(tracer, 'inject')
      .mockImplementation((_span, _format, carrier) => {
        (carrier as Record<string, string>).traceparent = child;
      });
    const trace = jest
      .spyOn(tracer, 'trace')
      .mockImplementation(((
        _name: string,
        _options: unknown,
        run: () => Promise<void>,
      ) => run()) as typeof tracer.trace);
    const message = {
      messageId: 'message',
      type: 'ReserveExecution',
      osId: 'os',
      sagaId: 'saga',
      correlationId: 'corr',
      traceparent: value,
      payload: { quantity: 2 },
    };
    const publish = jest.fn().mockResolvedValue(undefined);
    await traceOutbox('oficina.outbox.publish', message, publish);
    expect(trace).toHaveBeenCalledWith(
      'oficina.outbox.publish',
      expect.objectContaining({
        childOf: parent,
        resource: 'ReserveExecution',
        tags: expect.objectContaining({
          'span.kind': 'producer',
          'messaging.system': 'aws_sqs',
          'saga.id': 'saga',
          'os.id': 'os',
        }),
      }),
      expect.any(Function),
    );
    expect(publish).toHaveBeenCalledWith({ ...message, traceparent: child });
    expect(message.traceparent).toBe(value);
  });

  it('does not repeat a failing publish and tolerates missing extraction context', async () => {
    jest.spyOn(tracer, 'extract').mockImplementation(() => {
      throw new Error('trace disabled');
    });
    jest
      .spyOn(tracer, 'scope')
      .mockReturnValue({ active: () => null } as unknown as ReturnType<
        typeof tracer.scope
      >);
    const message = {
      messageId: 'message',
      type: 'RegisterOrder',
      osId: 'os',
      sagaId: 'saga',
      correlationId: 'corr',
      traceparent: value,
    };
    const publish = jest.fn().mockRejectedValue(new Error('delivery failed'));
    await expect(
      traceOutbox('oficina.order.register', message, publish, 'http'),
    ).rejects.toThrow('delivery failed');
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish.mock.calls[0][0]).toMatchObject({ traceparent: value });
  });
});
