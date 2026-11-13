# Frontend AutoGestão Pro

O frontend fica em `oficina-api/frontend` e é servido pelo OS Service. Ele é uma SPA em HTML, Tailwind CSS 4 e JavaScript ESM vanilla, com build Vite. A mesma interface consome OS, Billing e Production pelas rotas relativas do Gateway. O polimento mantém essa arquitetura e a identidade AutoGestão Pro.

## O que foi implementado

- login de cliente por CPF e login da equipe por e-mail/senha;
- sessão da equipe com renovação automática do par de tokens;
- sessão de cliente de curta duração, sem refresh e sem armazenar CPF;
- AppShell e navegação específicos para Administrador, Consultor Técnico, Mecânico e Cliente;
- dashboards por papel, sem apresentar contagens parciais como totais globais;
- fila/lista de ordens, abertura guiada e detalhe da OS;
- diagnóstico, orçamento, aprovação/rejeição, execução, consumo de peça, finalização e entrega conforme papel e status;
- Clientes, Veículos, Estoque, Catálogo de Serviços e Usuários conforme os endpoints existentes;
- relatórios de lead time e KPIs da oficina;
- loading, vazio, filtro vazio, offline, erro recuperável, sessão expirada, 403 e 404;
- acessibilidade por teclado, foco visível, semântica, alvos de toque e redução de movimento;
- correlation ID preservado nos erros para suporte.

## Executar localmente

Pré-requisitos: Node.js 22 e a API NestJS disponível.

```bash
cd oficina-api/frontend
npm ci
cp .env.example .env.local
npm run dev
```

A interface estará em `http://localhost:5173`. O Vite encaminha `/api` para `VITE_DEV_API_TARGET` e `/auth/token` para `VITE_DEV_AUTH_TARGET`.

Para o fluxo distribuído local, siga a inicialização da Fase 4 no [README do OS Service](../../README.md). O modo de demonstração local fornece a rota de autenticação por CPF somente no servidor de desenvolvimento e consulta a identidade no OS Service. Esse modo não é incluído no build de produção. Quando se usa a autenticação publicada, `VITE_DEV_AUTH_TARGET` aponta para o Gateway/Lambda; a API NestJS não implementa `POST /auth/token`.

## Variáveis de ambiente

| Variável | Padrão | Uso |
|---|---:|---|
| `VITE_API_BASE_URL` | `/api/v1` | Base dos endpoints NestJS no navegador |
| `VITE_CLIENT_AUTH_BASE_URL` | mesma origem | Host que expõe `POST /auth/token` |
| `VITE_REQUEST_TIMEOUT_MS` | `15000` | Timeout das chamadas HTTP |
| `VITE_DEV_API_TARGET` | `http://localhost:3000` | Destino do proxy `/api` no desenvolvimento |
| `VITE_DEV_AUTH_TARGET` | igual ao alvo da API | Destino do proxy `/auth/token` no desenvolvimento |

Quando frontend, Gateway e API compartilham a mesma origem, mantenha as duas bases relativas. Se forem publicados em origens diferentes, configure URLs absolutas e ajuste CORS no Gateway e no NestJS.

## Qualidade e build

```bash
npm run lint
npm test
npm run build
# ou os três em sequência
npm run check
```

O build de produção é gerado em `frontend/dist`. Fontes Inter, Manrope e Material Symbols são empacotadas localmente; a aplicação não depende de CDN em runtime.

## Segurança e autorização

- O JWT é decodificado somente para personalizar navegação e estado visual. A API continua sendo a autoridade de acesso.
- Tokens ficam em `sessionStorage`, não em armazenamento permanente.
- O cliente HTTP tenta refresh apenas para sessão da equipe. Um `401` de cliente encerra a sessão e solicita novo CPF.
- Conteúdo vindo da API é escapado antes de entrar em templates HTML.
- O portal do cliente usa somente a projeção segura de OS e não mostra notas internas, IDs de usuário ou consumo de peças.
- A equipe não recebe botão para aprovar orçamento; somente o cliente titular pode aprovar ou rejeitar.

## Operação distribuída

- Os dados paginados e indicadores respeitam o escopo e o papel do usuário. Contagens de uma página não são apresentadas como totais globais.
- A atribuição usa a busca de mecânicos ativos; o texto digitado não substitui a seleção de uma identidade válida.
- O estoque mostra a filial, o saldo disponível, as reservas e o consumo informados pela Produção. A entrada adiciona unidades somente à peça e à filial exibidas no diálogo.
- O orçamento aprovado é preservado durante compensação. Reposição de estoque, nova tentativa e reconciliação são ações distintas.
- A confirmação de pagamento vem do Billing; o retorno do checkout sozinho não libera a entrega.
- A navegação do cliente preserva sua projeção autorizada. Não consulta cadastros de outros clientes nem apresenta notas internas.
- O indicador do cabeçalho informa a conexão do navegador. A situação de cada operação é apresentada na própria tela, sem afirmar que todos os serviços estão disponíveis.
- Não são simulados módulos de notificações, perfil, MFA ou recuperação de senha.

## Direção visual

O sistema preserva o azul-marinho e o azul de ação, as fontes locais Manrope/Inter e os ícones Material Symbols. Superfícies claras, bordas discretas e espaçamento consistente organizam a informação. Botões não saltam ao passar o mouse; os status têm texto e ícone, sem depender apenas de cor. `prefers-reduced-motion` desativa os efeitos de movimento.

O alvo desta revisão é desktop 16:9: **1920×1080, 2560×1440 e 3840×2160**. O conteúdo usa larguras máximas progressivas de 1600, 1888 e 2304 CSS px, com formulários de leitura confortável, detalhe em duas colunas, tabelas com cabeçalho fixo e modais com ações persistentes. O zoom e a escala do sistema são respeitados, sem `zoom` ou ampliação artificial do documento. Os estilos menores existentes permanecem disponíveis, mas mobile não faz parte desta rodada de homologação.

Na revisão visual, conferir: menu aberto/recolhido; títulos e ações sem cortes; ausência de rolagem horizontal da página; modais longos com confirmação acessível; formulários preenchidos; estados vazio/erro/carregando; preparação, compensação e pagamento. Usar teclado para percorrer campos e confirmar o retorno de foco ao fechar o modal por Cancelar, X ou Escape.

As decisões de domínio, telas e integrações estão detalhadas em [MATRIZ_TELAS_ENDPOINTS.md](./MATRIZ_TELAS_ENDPOINTS.md). O roteiro de homologação está em [CHECKLIST_HOMOLOGACAO.md](./CHECKLIST_HOMOLOGACAO.md).

Para a rodada desktop de 11/11/2026, consulte o [ambiente local](../phase4-local.md), o [plano e as ferramentas avaliadas](polimento-desktop.md) e os [resultados da validação](validacao-local-2026-11-11.md).
