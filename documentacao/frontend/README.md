# Frontend AutoGestão Pro

O frontend fica em `oficina-api/frontend` para preservar a arquitetura de quatro repositórios do Tech Challenge. Ele é uma SPA em HTML, Tailwind CSS 4 e JavaScript ESM vanilla, sem React ou Vue, construída a partir da direção visual do Google Stitch e corrigida pelas regras reais da API.

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

Para testar o login por CPF, `VITE_DEV_AUTH_TARGET` deve apontar para o API Gateway/Lambda de autenticação ou para um emulador compatível com `POST /auth/token`. A API NestJS não implementa essa rota.

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

## Limites conhecidos da API, refletidos na UI

- A listagem interna de OS cobre apenas Recebida, Em diagnóstico, Aguardando aprovação e Em execução. A tela chama esse conjunto de **fila visível**, não de histórico completo.
- Não existe listagem de usuários ou mecânicos. A atribuição aceita um ID conhecido e explica essa limitação.
- A OS interna devolve IDs de cliente, veículo e mecânico sem expandir nomes.
- O cliente não possui permissão para buscar o veículo; seu detalhe mostra apenas o `veiculoId` recebido na projeção segura.
- Usuários podem ser criados ou consultados por ID, mas não listados/editados.
- O catálogo lista apenas serviços ativos; reativação exige conhecer o ID.
- Não existem endpoints para notificações, lembrete ao cliente, financeiro, perfil, MFA ou recuperação de senha; essas funções não foram simuladas.

## Direção visual

O sistema segue a proposta “gameful, não gamer” do Stitch: hierarquia clara, relevo seletivo, feedback tátil discreto, brilho curto nos botões, status legíveis e animações apenas quando comunicam mudança. `prefers-reduced-motion` desativa ripple, shimmer, pulse, entradas e transições.

As decisões de domínio, telas e integrações estão detalhadas em [MATRIZ_TELAS_ENDPOINTS.md](./MATRIZ_TELAS_ENDPOINTS.md). O roteiro de homologação está em [CHECKLIST_HOMOLOGACAO.md](./CHECKLIST_HOMOLOGACAO.md).
