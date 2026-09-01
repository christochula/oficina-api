import { validate } from 'class-validator';
import { TipoDocumento } from '../../../../domain/cliente.entity';
import { CriarClienteDto } from './criar-cliente.dto';

function dto(tipoDoc: TipoDocumento, numeroDoc: string): CriarClienteDto {
  return Object.assign(new CriarClienteDto(), {
    tipoDoc,
    numeroDoc,
    nome: 'Cliente',
    email: 'cliente@example.com',
    telefone: '11999999999',
  });
}

describe('CriarClienteDto', () => {
  it('aceita CPF v?lido', async () => {
    await expect(
      validate(dto(TipoDocumento.CPF, '111.444.777-35')),
    ).resolves.toHaveLength(0);
  });

  it('rejeita CPF inv?lido sem ignorar a propriedade', async () => {
    const errors = await validate(dto(TipoDocumento.CPF, '111.111.111-11'));
    expect(errors.some((error) => error.property === 'numeroDoc')).toBe(true);
  });

  it('aceita CNPJ v?lido', async () => {
    await expect(
      validate(dto(TipoDocumento.CNPJ, '11.222.333/0001-81')),
    ).resolves.toHaveLength(0);
  });

  it('rejeita CNPJ inv?lido sem ignorar a propriedade', async () => {
    const errors = await validate(
      dto(TipoDocumento.CNPJ, '11.111.111/1111-11'),
    );
    expect(errors.some((error) => error.property === 'numeroDoc')).toBe(true);
  });
});
