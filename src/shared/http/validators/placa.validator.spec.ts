import { validate } from 'class-validator';
import { IsValidPlaca } from './placa.validator';

describe('IsValidPlaca', () => {
  class PlacaDto {
    @IsValidPlaca()
    placa: string;
  }

  it('deve aceitar placa no formato antigo', async () => {
    const dto = new PlacaDto();
    dto.placa = 'ABC-1234';

    const erros = await validate(dto);
    expect(erros).toHaveLength(0);
  });

  it('deve aceitar placa no formato Mercosul', async () => {
    const dto = new PlacaDto();
    dto.placa = 'ABC1D23';

    const erros = await validate(dto);
    expect(erros).toHaveLength(0);
  });

  it('deve rejeitar placa inválida', async () => {
    const dto = new PlacaDto();
    dto.placa = 'AB123';

    const erros = await validate(dto);
    expect(erros).toHaveLength(1);
    expect(erros[0].constraints?.isValidPlaca).toBe('Placa inválida');
  });
});
