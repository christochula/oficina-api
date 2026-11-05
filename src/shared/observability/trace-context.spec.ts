import tracer from 'dd-trace';
import { captureTraceparent } from './trace-context';

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
});
