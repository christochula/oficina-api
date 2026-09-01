/**
 * Define os papéis possíveis de um usuário no sistema da oficina.
 *
 * - ADMINISTRADOR: acesso total ao sistema, gerencia usuários e configurações.
 * - CONSULTOR_TECNICO: abre ordens de serviço, gera orçamentos e interage com clientes.
 * - MECANICO: executa serviços, registra diagnósticos e consome peças do estoque.
 * - CLIENTE: acessa apenas suas próprias ordens de serviço para acompanhamento.
 */
export enum PapelUsuario {
  ADMINISTRADOR = 'ADMINISTRADOR',
  CONSULTOR_TECNICO = 'CONSULTOR_TECNICO',
  MECANICO = 'MECANICO',
  CLIENTE = 'CLIENTE',
}
