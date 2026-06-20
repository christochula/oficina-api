# Relatório de Análise OWASP ZAP - Oficina API

**Data da Análise:** 20 de Abril de 2026  
**Ferramenta:** OWASP ZAP 2.17.0  
**Alvo:** http://host.docker.internal:3000  
**Status Geral:** ✅ Aprovado com melhorias implementadas

---

## 📊 Resumo Executivo

A análise de segurança dinâmica com OWASP ZAP identificou **5 categorias de alertas**, sendo:

- **2 alertas de Baixa Severidade** (X-Powered-By, X-Content-Type-Options)
- **3 alertas Informativos** (caching, códigos HTTP 4xx)

**Todos os alertas de baixa severidade foram corrigidos** através da configuração HTTP centralizada da aplicação em `src/shared/http/configurar-aplicacao.ts`, aplicada também no bootstrap principal.

---

## 🔴 Vulnerabilidades de Baixa Severidade

### 1. **Server Leaks Information via "X-Powered-By" HTTP Response Header**

**Risco:** Low (Medium Confidence)  
**Instâncias:** 5 endpoints  
**Descrição:**  
O servidor Express estava expondo informações de framework através do header `X-Powered-By: Express`. Isso facilita ataques direcionados ao identificar quais componentes e versões estão em uso.

**Correção Implementada:**
```typescript
app.getHttpAdapter().getInstance().disable('x-powered-by');
```

**Verificação:**
```bash
docker compose up -d --build api
curl -i http://localhost:3000/api/docs
# X-Powered-By header não mais presente ✅
```

---

### 2. **X-Content-Type-Options Header Missing**

**Risco:** Low (Medium Confidence)  
**Instâncias:** 1 rota  
**Descrição:**  
A falta do header `X-Content-Type-Options: nosniff` permite que navegadores antigos (IE, Chrome legado) façam MIME-sniffing no corpo da resposta, interpretando-a como tipo diferente do declarado.

**Correção Implementada:**
```typescript
res.setHeader('X-Content-Type-Options', 'nosniff');
```

---

## 🟡 Headers de Segurança Adicionados (Evolução)

Além de corrigir os apontamentos, adicionamos headers complementares para aumentar a postura de segurança:

### **Strict-Transport-Security (HSTS)**
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
```
- **Propósito:** Força HTTPS em futuras requisições
- **Validade:** 1 ano (31536000 segundos)
- **Benefício:** Previne ataques MITM (man-in-the-middle)

### **X-Frame-Options**
```
X-Frame-Options: DENY
```
- **Propósito:** Previne clickjacking
- **Benefício:** Evita que a aplicação seja embutida em iframes maliciosos

### **Content-Security-Policy (CSP)**
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:
```
- **Propósito:** Controla quais recursos podem ser carregados
- **Benefício:** Mitiga ataques XSS (cross-site scripting)
- **Nota:** Inclui `'unsafe-inline'` e `'unsafe-eval'` porque Swagger UI requer (revisar em produção)

---

## 🔵 Alertas Informativos (Sem Ação Imediata Necessária)

### 3. **A Client Error Response Code Was Returned by the Server**

**Risco:** Informational (High Confidence)  
**Instâncias:** 173 rotas  
**Descrição:**  
O ZAP encontrou 404s esperados durante o scan (rotas que não existem). Isso é normal e não representa vulnerabilidade.

**Análise:**
- 173 dos 404s são de exploração de endpoints inexistentes (comportamento esperado)
- Todos os endpoints válidos retornam respostas apropriadas
- **Sem ação necessária**

---

### 4. **Non-Storable Content**

**Risco:** Informational (Medium Confidence)  
**Instâncias:** 5 endpoints  
**Descrição:**  
Algumas respostas não possuem cache headers configurados, o que significa que proxies não as cacheiam. Como a maioria das respostas são sensíveis (requerem autenticação), isso é apropriado.

**Análise:**
- Endpoints de autenticação e dados sensíveis corretamente não cacheáveis
- **Sem ação necessária** — comportamento desejado

---

### 5. **Storable and Cacheable Content**

**Risco:** Informational (Medium Confidence)  
**Instâncias:** 1 rota  
**Descrição:**  
Uma rota retorna conteúdo que pode ser cacheado (provavelmente Swagger). Risco mínimo pois é conteúdo público.

**Análise:**
- Identificada rota `/api/docs` (Swagger UI)
- Conteúdo é público e estático
- **Sem ação necessária**

---

## ✅ Verificação Pós-Correção

### Teste de Headers de Segurança

Validação executada após recriar o serviço `api` com `docker compose up -d --build api`.

```bash
# Remover X-Powered-By
curl -i http://localhost:3000/api/docs | grep -i "x-powered-by"
# (sem resultado = sucesso)

# Verificar X-Content-Type-Options
curl -i http://localhost:3000/api/docs | grep -i "x-content-type-options"
# X-Content-Type-Options: nosniff ✅

# Verificar HSTS
curl -i http://localhost:3000/api/docs | grep -i "strict-transport-security"
# Strict-Transport-Security: max-age=31536000; includeSubDomains ✅

# Verificar X-Frame-Options
curl -i http://localhost:3000/api/docs | grep -i "x-frame-options"
# X-Frame-Options: DENY ✅

# Verificar CSP
curl -i http://localhost:3000/api/docs | grep -i "content-security-policy"
# Content-Security-Policy: default-src 'self'; ... ✅
```

### Validação Adicional de Execução

- `npm run build` executado com sucesso
- `npm test` executado com 291 testes passando
- `npm run test:e2e` executado com 5 testes passando via Testcontainers
- `docker exec oficina_api whoami` retornou `appuser`, confirmando execução sem root

---

## 📝 Métricas Gerais do Scan

| Métrica | Valor |
|---------|-------|
| **Total de Endpoints Testados** | 172 |
| **Métodos HTTP** | GET (59%), PATCH (25%), POST (14%) |
| **Content-Type** | 100% application/json ✅ |
| **Respostas 4xx** | 99% (esperado para teste sem auth completo) |

---

## 🔐 Recomendações para Produção

1. **CSP Policy**  
   Em produção, remover `'unsafe-inline'` e `'unsafe-eval'` do CSP, migrando Swagger UI para usar inline scripts seguros.

2. **Certificado HTTPS**  
   O header HSTS será totalmente efetivo apenas com HTTPS em produção.

3. **Rate Limiting**  
   Considerar adicionar rate limiting em endpoints de autenticação para mitigação de força bruta.

4. **Logs de Segurança**  
   Implementar logging estruturado de tentativas de acesso negado para auditoria.

5. **Análise Periódica**  
   Repetir scan de ZAP em cada release para assegurar que novas vulnerabilidades não foram introduzidas.

---

## 🎯 Conclusão

A aplicação **passou na análise de segurança dinâmica do OWASP ZAP** com sucesso. Todos os apontamentos de baixa severidade foram corrigidos e revalidados em execução real no ambiente Docker da aplicação. Os alertas informativos não representam risco imediato e estão em conformidade com as melhores práticas.

**Status Final: ✅ APROVADO**
