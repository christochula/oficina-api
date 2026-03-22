import { CriarClienteUseCase } from './criar-cliente.usecase';
import { TipoDocumento } from '../../domain/cliente.entity';
import { ConflitoDeRecurso } from '../../../shared/excecoes/dominio.exception';

const mockRepo = {
  buscarPorNumeroDoc: jest.fn(),
  salvar: jest.fn(),
  buscarPorId: jest.fn(),
  listar: jest.fn(),
};

function criarUseCase() {
  return new CriarClienteUseCase(mockRepo as any);
}

describe('CriarClienteUseCase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve normalizar o numeroDoc removendo pontos, traços e barras', async () => {
    mockRepo.buscarPorNumeroDoc.mockResolvedValue(null);
    mockRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    const cliente = await uc.executar({
      tipoDoc: TipoDocumento.CPF,
      numeroDoc: '111.444.777-35',
      nome: 'João',
      email: 'joao@test.com',
      telefone: '11999',
    });

    expect(mockRepo.buscarPorNumeroDoc).toHaveBeenCalledWith('11144477735');
    expect(cliente.numeroDoc).toBe('11144477735');
  });

  it('deve lançar ConflitoDeRecurso se o documento já existir', async () => {
    mockRepo.buscarPorNumeroDoc.mockResolvedValue({ id: 'cl_01' });

    const uc = criarUseCase();
    await expect(
      uc.executar({
        tipoDoc: TipoDocumento.CPF,
        numeroDoc: '11144477735',
        nome: 'João',
        email: 'joao@test.com',
        telefone: '11999',
      }),
    ).rejects.toThrow(ConflitoDeRecurso);
  });

  it('deve salvar e retornar o cliente criado', async () => {
    mockRepo.buscarPorNumeroDoc.mockResolvedValue(null);
    mockRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    const cliente = await uc.executar({
      tipoDoc: TipoDocumento.CPF,
      numeroDoc: '11144477735',
      nome: 'Maria',
      email: 'maria@test.com',
      telefone: '11888',
    });

    expect(mockRepo.salvar).toHaveBeenCalledTimes(1);
    expect(cliente.nome).toBe('Maria');
    expect(cliente.tipoDoc).toBe(TipoDocumento.CPF);
  });

  it('deve normalizar CNPJ removendo pontos, barras e traços', async () => {
    mockRepo.buscarPorNumeroDoc.mockResolvedValue(null);
    mockRepo.salvar.mockResolvedValue(undefined);

    const uc = criarUseCase();
    await uc.executar({
      tipoDoc: TipoDocumento.CNPJ,
      numeroDoc: '11.222.333/0001-81',
      nome: 'Empresa X',
      email: 'empresa@x.com',
      telefone: '1133334444',
    });

    expect(mockRepo.buscarPorNumeroDoc).toHaveBeenCalledWith('11222333000181');
  });
});
