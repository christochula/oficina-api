import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  cleanAlphanumeric,
  cleanCNPJ,
  cleanCPF,
  cleanNumbers,
  formatCNPJ,
  formatCPF,
  formatDocument,
  isAlphanumericCNPJ,
  isValidCNPJ,
  isValidCPF,
  isValidDocument,
} from './documento-validator';
import { IsValidDocumentForType } from '../http/validators/documento-tipo.validator';
import { IsValidPlaca } from '../http/validators/placa.validator';
import { TipoDocumento } from '../../cliente/domain/cliente.entity';
import { PaginacaoDto } from '../http/dtos/paginacao.dto';

describe('document normalization and validation boundaries', () => {
  it('preserves identifiers while formatting masks and rejects unrecognized lengths', () => {
    expect(cleanNumbers('529.982.247-25')).toBe('52998224725');
    expect(cleanCPF('529.982.247-25')).toBe('52998224725');
    expect(formatCPF('52998224725')).toBe('529.982.247-25');
    expect(formatCPF('123')).toBe('');
    expect(cleanCNPJ('11.222.333/0001-81')).toBe('11222333000181');
    expect(formatCNPJ('11222333000181')).toBe('11.222.333/0001-81');
    expect(formatCNPJ('123')).toBe('');
    expect(cleanAlphanumeric('12.ABC.345/01DE-35')).toBe('12ABC34501DE35');
    expect(cleanCNPJ('12.ABC.345/01DE-35')).toBe('12ABC34501DE35');
    expect(formatCNPJ('12ABC34501DE35')).toBe('12.ABC.345/01DE-35');
    expect(isAlphanumericCNPJ('12ABC34501DE35')).toBe(true);
    expect(isAlphanumericCNPJ('11222333000181')).toBe(false);
  });
  // Reference vector: Receita/Serpro manual-dv-cnpj.pdf, example on page 4.
  it('accepts numeric and official alphanumeric check-digit vectors', () => {
    expect(isValidCNPJ('12.ABC.345/01DE-35')).toBe(true);
    expect(isValidCNPJ('04.252.011/0001-10')).toBe(true);
    expect(isValidCNPJ('33.000.167/0001-01')).toBe(true);
    expect(isValidCPF('390.533.447-05')).toBe(true);
    expect(isValidCPF('012.345.678-90')).toBe(true);
  });
  it.each([
    '',
    '123',
    '00000000000000',
    '12ABC34501DE3A',
    '12ABC34501DE45',
    '12ABC34501DE36',
  ])('rejects malformed or wrong CNPJ check digits: %s', (value) => {
    expect(isValidCNPJ(value)).toBe(false);
  });
  it.each(['', '123', '11111111111', '52998224735', '52998224726'])(
    'rejects malformed or wrong CPF check digits: %s',
    (value) => {
      expect(isValidCPF(value)).toBe(false);
    },
  );
  it('dispatches mixed document formats without truncating or treating letters as CPF digits', () => {
    for (const value of ['52998224725', '11222333000181', '12ABC34501DE35'])
      expect(isValidDocument(value)).toBe(true);
    expect(isValidDocument('ABC123')).toBe(false);
    expect(isValidDocument('123')).toBe(false);
    expect(formatDocument('52998224725')).toBe('529.982.247-25');
    expect(formatDocument('11222333000181')).toBe('11.222.333/0001-81');
    expect(formatDocument('12ABC34501DE35')).toBe('12.ABC.345/01DE-35');
    expect(formatDocument('ABC')).toBe('');
    expect(formatDocument('123')).toBe('');
  });
  it('rejects mismatched declared document types and non-string fields', async () => {
    class DocumentDto {
      tipoDoc?: TipoDocumento;
      @IsValidDocumentForType() numeroDoc?: unknown;
      @IsValidPlaca() placa?: unknown;
    }
    const invalid = Object.assign(new DocumentDto(), {
      tipoDoc: undefined,
      numeroDoc: 123,
      placa: 123,
    });
    expect(await validate(invalid)).toHaveLength(2);
    invalid.numeroDoc = '52998224725';
    invalid.placa = 'ABC1D23';
    const missingType = await validate(invalid);
    expect(missingType[0].constraints).toMatchObject({
      isValidDocumentForType: 'CPF invalido',
    });
    invalid.tipoDoc = TipoDocumento.CNPJ;
    expect((await validate(invalid))[0].constraints).toMatchObject({
      isValidDocumentForType: 'CNPJ invalido',
    });
    invalid.numeroDoc = '12ABC34501DE35';
    expect(await validate(invalid)).toHaveLength(0);
  });
  it('transforms and bounds pagination query input', async () => {
    const page = plainToInstance(PaginacaoDto, {
      pagina: '2',
      porPagina: '50',
    });
    expect(page).toMatchObject({ pagina: 2, porPagina: 50 });
    expect(await validate(page)).toHaveLength(0);
    expect(
      await validate(
        plainToInstance(PaginacaoDto, { pagina: '-1', porPagina: '101' }),
      ),
    ).toHaveLength(2);
    expect(new PaginacaoDto()).toMatchObject({ pagina: 1, porPagina: 20 });
  });
});
