# Plano e validação local — polimento desktop

## Objetivo e decisões

Evoluir a identidade AutoGestão Pro e validar a aplicação distribuída localmente antes de publicar alterações. A AWS Academy permanece desligada. Esta rodada prepara código e evidências; a publicação e o deploy posterior devem passar pelo GitHub Actions.

- Público: administrador, consultor, mecânico e cliente, em PC com teclado e mouse.
- Matriz principal: 1920×1080, 2560×1440 e 3840×2160. Nenhum projeto de teste mobile nesta rodada.
- Preservar marca, azul, Inter/Manrope e rotas. Melhorar hierarquia, densidade, largura de leitura, contraste, foco e consistência de tabelas, formulários, modais e estados vazios/erro.
- Pagamento automatizado usa o simulador local. O teste real com comprador Mercado Pago TEST será repetido na retomada da homologação; não representa cobrança real nem validação já concluída na AWS.

## Ferramentas e skills pesquisadas

| Opção | Decisão nesta rodada |
|---|---|
| [Tailwind CSS 4 — responsividade e container queries](https://tailwindcss.com/docs/responsive-design) | Manter o Tailwind/Vite já instalado. Usar tokens, Grid/Flex, limites de largura e regras desktop; não escalar toda a interface proporcionalmente aos pixels da tela. |
| [shadcn/ui para Vite](https://ui.shadcn.com/docs/installation/vite) | Avaliado, sem migração: seu caminho React exigiria reescrever o frontend atual em JavaScript/DOM, sem necessidade para este polimento. |
| [Playwright — comparação visual](https://playwright.dev/docs/test-snapshots) | Validar navegação e capturar as três resoluções. Comparações de pixels precisam do mesmo navegador/SO; imagens de Windows não devem ser tomadas como baseline de Linux no CI. |
| [Playwright + axe](https://playwright.dev/docs/accessibility-testing) | Acrescentar verificações automáticas de acessibilidade e revisar teclado/foco manualmente. Uma análise automática não comprova conformidade completa. |
| [Skill frontend-design, Anthropic](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md) | Referência de direção visual, tipografia e composição. A preferência confirmada do projeto é evoluir a identidade existente. |
| [Skills oficiais Playwright](https://github.com/openai/skills/tree/main/skills/.curated/playwright) e [Playwright Interactive](https://github.com/openai/skills/tree/main/skills/.curated/playwright-interactive) | Encontradas no catálogo do Codex. O projeto já possui Playwright Test: manter testes reproduzíveis versionados; não depender de instalar uma skill global para executar CI. |

## Sequência de execução

1. **Ambiente reproduzível:** iniciar Docker; separar demonstração persistente e aceitação descartável por projeto, portas e volumes. Subir três serviços, dois PostgreSQL, LocalStack com SQS/DynamoDB e simulador. Fazer seed fictício pelas APIs e login pelo portal.
2. **Regressões distribuídas:** repetir preparação sem peças ao menos três vezes; provar compensação, orçamento preservado e reserva liberada. Repor na mesma filial, repetir e concluir o reparo. Exercitar reconciliação administrativa, duplicações, falhas e retomada conforme a matriz de testes existente/ampliada.
3. **Experiência da OS:** acompanhar transições por GET limitado; pausar em erro/inatividade, preservar aba e dados, indicar atualização pendente. Nunca repetir automaticamente POST de aprovação, preparação, consumo ou pagamento. Evitar clique duplo, preservar formulários e retornar à mesma OS após login expirado.
   O consumo incremental também precisa de um `operationId` persistido por tentativa: a Produção deve reconhecer repetições atomicamente com o estoque/outbox, inclusive quando a resposta HTTP se perde. Reutilizar a chave com outro conteúdo deve ser rejeitado.
4. **Polimento visual:** revisar acesso, navegação, dashboard, listas, wizard, detalhe da OS, estoque, cadastros e relatórios. Priorizar a próxima ação, tornar pagamento/preparação compreensíveis, reduzir textos técnicos na experiência do cliente e facilitar seleção de peças.
5. **Aceitação:** rodar testes unitários/cobertura, BDD com serviços reais e Playwright desktop; inspecionar screenshots e corrigir os problemas encontrados. Executar lint/build e verificar arquivos de CI/manifests alterados.
6. **Preparação de entrega:** registrar resultados e limitações reais, conferir diff e manter credenciais fora do conteúdo publicável. Atualizar roteiro e voice-over somente nos passos cujas telas/comportamentos mudaram.

## Critérios de aceite

- Uma nova OS atravessa abertura, diagnóstico, orçamento, aprovação, reparo, pagamento simulado e entrega pelo portal com os papéis corretos.
- Retentativas sem estoque retornam a um estado explícito e recuperável; jamais liberam reparo/entrega indevidamente nem duplicam reservas/consumos.
- Pagamento pendente/recusado bloqueia entrega; confirmação canônica e processamento posterior permitem avançar. Atualizar a página não cria novo pagamento.
- Reenviar um consumo após perda de resposta, com o mesmo `operationId`, produz uma única movimentação e um único evento. A confirmação encerra essa tentativa; outro consumo legítimo recebe outra identificação.
- Falha de consulta preserva contexto e impede mutação baseada em dados desatualizados até nova consulta bem-sucedida.
- Telas e modais utilizáveis nas três resoluções, sem rolagem horizontal da página, sobreposição de controles ou cortes de ações. Tabelas extensas podem ter seu próprio scroll.
- Cobertura mínima de 80% nas quatro métricas por serviço; evidências de execução e falhas esperadas sem segredos.
- Nenhuma publicação/deploy nesta rodada local. Roteiro com credenciais continua local; somente documentação sanitizada pode entrar em commit público.

Os resultados executados e as limitações estão no [relatório de validação local](validacao-local-2026-11-11.md), separados dos itens planejados.
