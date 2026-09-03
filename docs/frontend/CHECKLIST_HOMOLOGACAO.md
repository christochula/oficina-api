# Checklist de homologação do frontend

## Automação

- [ ] `npm ci` conclui usando `frontend/package-lock.json`.
- [ ] `npm run lint` termina sem erros.
- [ ] `npm test` aprova contratos HTTP, sessão, permissões, status e views.
- [ ] `npm run build` produz `frontend/dist` sem dependência de CDN.
- [ ] O servidor de preview responde `index.html` e assets com HTTP 200.

## Acesso

- [ ] Cliente entra por CPF e não recebe refresh token.
- [ ] Administrador, Consultor e Mecânico entram por e-mail/senha.
- [ ] Senha pode ser exibida/ocultada por teclado e leitor de tela.
- [ ] Erro de login é genérico e não revela se o cadastro existe.
- [ ] Logout limpa a sessão mesmo quando a API está indisponível.

## Permissões

- [ ] Cliente vê somente Início e Minhas ordens.
- [ ] Mecânico vê Meu trabalho, Minhas ordens, Estoque e Catálogo.
- [ ] Consultor não vê Estoque nem Usuários.
- [ ] Somente Administrador altera Estoque, Catálogo e Usuários.
- [ ] Equipe não consegue aprovar/rejeitar orçamento pela UI.
- [ ] Cliente não recebe notas internas nem dados técnicos restritos.

## Ciclo da OS

- [ ] Recebida permite atribuir mecânico para Administrador/Consultor.
- [ ] Atribuída/Em diagnóstico permitem diagnóstico e orçamento ao Mecânico responsável.
- [ ] Aguardando aprovação oferece decisão somente ao Cliente titular.
- [ ] Rejeição mostra confirmação de que a OS será cancelada.
- [ ] Aprovada permite iniciar execução ao Mecânico responsável.
- [ ] Em execução permite consumir peça e finalizar.
- [ ] Finalizada permite registrar entrega para Administrador/Consultor.
- [ ] Entrega mostra confirmação definitiva.
- [ ] Timeline exibe oito etapas e o ramo Cancelada.

## Responsividade e acessibilidade

- [ ] Validar 390×844, 768×1024, 1440×1024 e largura acima de 1600 px.
- [ ] Drawer abre pelo botão, fecha por backdrop/Esc e devolve o foco.
- [ ] Navegação por Tab tem ordem previsível e foco visível.
- [ ] Abas respondem a setas, Home e End.
- [ ] Modais contêm o foco, fecham com Esc e devolvem foco ao acionador.
- [ ] Tabelas viram cartões no mobile sem esconder ações essenciais.
- [ ] Controles de toque têm pelo menos 44×44 px.
- [ ] Estados não dependem apenas de cor.
- [ ] Com redução de movimento, ripple, shimmer, pulse e transições desaparecem.

## Integração

- [ ] `VITE_API_BASE_URL` aponta para `/api/v1` do ambiente.
- [ ] `VITE_CLIENT_AUTH_BASE_URL` alcança `POST /auth/token`.
- [ ] CORS autoriza a origem publicada quando houver hosts diferentes.
- [ ] Respostas paginadas usam `{data,meta}` e IDs aceitam string ou `{valor}`.
- [ ] Erros exibem o `X-Correlation-Id` quando presente.
