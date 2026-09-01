/** Chave global que serializa operações capazes de remover administradores. */
export const BLOQUEIO_ADMINISTRADORES_ATIVOS =
  'oficina:usuarios:administradores-ativos';

/** Chave por usuário usada também pelo fluxo de atribuição de ordens. */
export const bloqueioUsuario = (usuarioId: string): string =>
  `oficina:usuario:${usuarioId}`;
