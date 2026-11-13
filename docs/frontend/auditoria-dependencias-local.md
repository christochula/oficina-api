# Auditoria de dependências — validação local

Data: **11/11/2026**, fuso America/Sao_Paulo. Auditoria somente leitura com `npm audit --json`, `npm audit --omit=dev --json`, consulta ao registro npm e inspeção dos lockfiles, Dockerfiles e bootstraps. Nenhuma dependência foi atualizada nesta revisão. Não foi executado `npm audit fix` nem teste de exploração.

## Resultado e comparação com a base

Os números abaixo contam pacotes apontados pelo npm, não vulnerabilidades independentes. Por exemplo, `@nestjs/platform-express` e `multer` aparecem separadamente para a mesma cadeia de dependências.

| Projeto | Auditoria completa | Somente dependências de produção |
|---|---|---|
| OS | 40: 2 críticas, 9 altas, 27 moderadas, 2 baixas | 8: 1 crítica, 4 altas, 3 moderadas |
| Frontend | 7: 3 altas, 4 moderadas | 0 |
| Billing | 22: 2 altas, 16 moderadas, 4 baixas | 2 altas |
| Production | 22: 2 altas, 16 moderadas, 4 baixas | 2 altas |

Comparação de versões dos pacotes com o `HEAD` local:

- OS e frontend: `07aa8b8f6ad45f78d24df4846bac32ca7616c554`.
- Billing: `86f9f80d108c4be88cff24e94de31d53b1bfc9cc`.
- Production: `26401741874259c577caeed59ad1c014042516f6`.

O lockfile OS acrescentou somente `@axe-core/playwright@4.14.0` e `axe-core@4.14.0` nesta rodada; ambos não apareceram nos alertas. As versões de todos os pacotes preexistentes permaneceram iguais ao HEAD. Os lockfiles frontend, Billing e Production também preservaram todas as versões. Portanto, os alertas listados são **preexistentes às melhorias de UI e aos novos testes**. Esta comparação foi feita sobre os lockfiles; não foi criada uma instalação separada de cada HEAD.

`--omit=dev` usa a classificação do lockfile. O Dockerfile OS copia `node_modules` completo para a imagem final, incluindo ferramentas de desenvolvimento utilizadas pelo seed local. Assim, esse filtro não significa que os pacotes de desenvolvimento estejam ausentes da imagem OS. Os Dockerfiles Billing e Production executam `npm prune --omit=dev`. O frontend publicado é estático; Vite não é o servidor do portal em produção.

## Contexto dos alertas prioritários

| Pacote instalado | Escopo | Contexto observado |
|---|---|---|
| `body-parser@2.3.0` | Produção OS, alta | O bootstrap utiliza Nest Express com parser padrão; não foi localizada desativação da descompressão de corpos. O aviso descreve encerramento do processo por bytes adicionais após um corpo comprimido. Não houve reprodução ofensiva no ambiente. |
| `dd-trace@6.13.0` | Produção OS, alta | A aplicação inicializa o tracer com `--require dd-trace/init`. O Compose local desativa tracing; o Helm configura a variável correspondente para a implantação. O alerta trata de consumo excessivo de CPU na ofuscação de query strings quando o tracing HTTP afetado está ativo. |
| `proxy-addr@2.0.7` | Produção OS, crítica | O aviso exige uma configuração específica de subnet confiável IPv6/IPv4. Não foi encontrada configuração `trust proxy` no código dos serviços. A presença do pacote vulnerável, isoladamente, não comprova esse caminho de exploração na aplicação. |
| `multer@2.2.0` no OS; `2.4.0` no Billing/Production | Produção, alta; propagada para `@nestjs/platform-express` | Não foram encontrados interceptors de upload, uso direto de multer ou `fileFilter` no código dos três serviços. O aviso mais recente exige filtro assíncrono de upload; esse uso não foi identificado. |
| `vite@8.2.2` | Desenvolvimento frontend, alta | O alerta envolve a integração de abertura de editor no Windows. O portal de desenvolvimento atual está limitado a loopback; isso reduz a exposição de rede, mas não substitui a atualização do pacote. Vite não está no servidor cloud do portal estático. |

Fontes primárias dos avisos: [body-parser](https://github.com/advisories/GHSA-27r3-jxmh-p828), [dd-trace](https://github.com/advisories/GHSA-x94g-w73q-hpcw), [proxy-addr](https://github.com/advisories/GHSA-jqcg-44mw-7w3h), [multer](https://github.com/advisories/GHSA-q7qp-rjg7-q26m) e [Vite/launch-editor](https://github.com/advisories/GHSA-587h-7wmj-h5pm).

Os demais alertas altos/críticos da auditoria completa OS estão em dependências classificadas como desenvolvimento: `@grpc/grpc-js@1.14.4`, versões de `brace-expansion`, `browserslist@4.28.1`, `fast-uri@3.1.6`, `handlebars@4.7.9` e `undici@8.10.1`. No frontend, os outros altos são `brace-expansion@5.0.9` e `source-map-js@1.2.1`. Não foi identificada uma rota da aplicação que receba templates Handlebars arbitrários; o alerta crítico desse pacote não foi tratado como exploração comprovada.

## Atualizações candidatas, não aplicadas

As versões abaixo existem no registro npm e tiveram seus metadados de dependências, peers e engines consultados. São candidatas de atualização compatível, e não uma declaração de aprovação após testes.

| Atualização candidata | Compatibilidade verificada |
|---|---|
| Vite `8.2.2` → `8.2.4` | Patch da mesma linha; exige Node `^20.19.0` ou `>=22.12.0`, compatível com o Node 22.23.4 utilizado na imagem local. Requer alterar o pin explícito do frontend. |
| `body-parser` → `2.4.0` | Mesma major; Node `>=18`. Atualizar a resolução transitiva compatível no lockfile OS. |
| `proxy-addr` → `2.0.8` | Patch da mesma linha. Atualizar a resolução transitiva compatível no lockfile OS. |
| `dd-trace` → `6.20.1` ou uma versão posterior corrigida na major 6 | A versão mínima corrigida consultada exige Node `>=22` e cabe no range `^6.13.0` do OS. Validar novamente tracing e propagação antes do deploy. |
| `@nestjs/platform-express` → `11.2.9` nos três serviços | Peers `@nestjs/common` e `@nestjs/core` aceitam `^11.0.0`; essa versão fixa `multer@2.5.0`. Cabe nos ranges atuais da major 11. |
| `source-map-js` → `1.2.2` | Patch da mesma linha, para tooling frontend. |
| `brace-expansion` `5.0.9` → `5.0.12` | Patch da linha 5; Node `20` ou `>=22`. Não usar esse número como override global sobre as linhas 1 e 2 presentes no OS. |
| `handlebars` → `4.7.10` | Patch da mesma linha, para tooling OS; não exige migração de framework. |

Para uma rodada de manutenção dedicada, priorizar o parser HTTP e o tracer do OS e o patch Vite do ambiente Windows. A atualização Nest/multer remove alertas nos três serviços sem mudança de major, mas deve passar pelas suítes de cada serviço. Evitar `npm audit fix --force`, upgrades de framework e overrides globais que substituam linhas incompatíveis. Reemitir a auditoria após qualquer atualização; os números acima não são uma meta de resultado prometida.

Nesta rodada de UI e regressões, as dependências foram mantidas para que a evidência E2E corresponda à base efetivamente testada. As atualizações de segurança ficam registradas para uma mudança separada e verificável.

## Reprodução

Dentro de cada diretório com `package-lock.json` (`oficina-api`, `oficina-api/frontend`, `oficina-billing-service` e `oficina-production-service`):

```powershell
npm.cmd audit --json
npm.cmd audit --omit=dev --json
```

Consultas de versões, sem instalação:

```powershell
npm.cmd view vite@8.2.4 version dependencies peerDependencies engines --json
npm.cmd view @nestjs/platform-express@11.2.9 version dependencies peerDependencies engines --json
npm.cmd view body-parser@2.4.0 version engines --json
npm.cmd view proxy-addr@2.0.8 version engines --json
npm.cmd view dd-trace@6.20.1 version engines --json
```

`npm audit` retorna código diferente de zero quando encontra alertas; isso não deve ser confundido com falha de leitura do JSON. A contagem pode mudar conforme a base de avisos do registro é atualizada.
