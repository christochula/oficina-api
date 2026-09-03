# Publicação do frontend

## Imagem integrada

O `Dockerfile` de `oficina-api` executa dois builds no mesmo estágio:

1. instala e compila `frontend` com Vite;
2. compila a API NestJS;
3. copia `frontend/dist` para `/app/public` na imagem final.

O bootstrap NestJS serve `/app/public` na raiz. A SPA usa rotas hash (`#/inicio`, `#/ordens`), portanto não precisa de fallback de servidor para cada tela.

Validação local da imagem:

```bash
docker build -t oficina-api:frontend-test .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL=postgresql://usuario:senha@host:5432/oficina \
  -e JWT_SECRET=uma-chave-segura \
  oficina-api:frontend-test
```

- `GET /` deve responder o `index.html`;
- `GET /assets/...` deve responder JavaScript, CSS e fontes;
- `GET /api/health/live` deve responder `200`;
- os arquivos estáticos recebem os mesmos cabeçalhos de segurança da API.

## Exposição pelo API Gateway

No estado atual dos repositórios, o API Gateway publica `POST /auth/token`, rotas públicas específicas da API e o proxy protegido `ANY /api/{proxy+}`. Ele ainda não encaminha `/` nem `/assets/{proxy+}` ao ALB interno.

Antes de tornar a interface acessível pelo hostname público do Gateway, a infraestrutura de autenticação deve adicionar rotas públicas de leitura apontando para a integração privada existente:

```hcl
"GET /"
"GET /assets/{proxy+}"
```

Essas rotas devem permanecer sem authorizer para permitir que a página de login e seus assets sejam carregados antes de existir um token. Isso expõe somente arquivos estáticos; as rotas `/api/v1/**` continuam sob as regras atuais de autenticação/autorização.

Como alternativa, publique `frontend/dist` em hospedagem estática e configure:

- `VITE_API_BASE_URL` com o host do Gateway mais `/api/v1`;
- `VITE_CLIENT_AUTH_BASE_URL` com o host do Gateway;
- CORS do Gateway/NestJS para a origem estática.

A abertura dessas rotas públicas não foi aplicada automaticamente porque amplia a superfície pública da infraestrutura. Ela deve passar pela decisão/revisão de segurança do ambiente de destino.
