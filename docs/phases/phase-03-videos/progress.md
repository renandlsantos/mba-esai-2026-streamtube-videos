---
kind: progress
phase: phase-03-videos
status: complete
---
# Progresso e evidências — 2026-09-19

SI-03.1 a SI-03.6 implementadas. O workflow Spec Kit passou por constitution, specify, plan, tasks, implement e revisão de convergência. As decisões e os contratos foram revisados antes do código. O pipeline original foi portado como execução manual documentada, conforme permitido pelo enunciado.

## Validação executada

Todos os comandos Node foram executados no container `nestjs-api` do projeto Compose `mba-esai-296`.

| Comando | Resultado |
|---|---|
| `docker compose up -d --build` | API saudável, worker separado iniciado, PostgreSQL/Redis/MinIO/Mailpit disponíveis |
| `npm ci` no Dockerfile | 1129 pacotes instalados pelo lockfile |
| `npm test -- --runInBand` | 26 suítes, 150 testes aprovados |
| `npm run test:e2e -- --runInBand` | 4 suítes, 55 testes aprovados |
| `npx tsc --noEmit` | Aprovado |
| `npm run lint` | Aprovado, zero erros; seis avisos herdados de mocks de QueryBuilder/FindOptions em testes de auth |
| `npm run build` | Aprovado |
| Cliente Python no host | Cadastro, confirmação via Mailpit, login, upload por URL pública e processamento real até ready |

Os e2e de vídeos usam MinIO, Redis, PostgreSQL e processo FFmpeg reais, em worker externo ao processo de teste. A fixture MP4 é gerada com FFmpeg. Foram comprovados thumbnail JPEG, duração/dimensões, processamento automático, repetição da conclusão, falha após retries com mídia inválida, bloqueio de outro canal, JWT obrigatório, Range 206 com 100 bytes e download idêntico ao original. Não há mock de processamento na evidência ponta a ponta. O teste unitário de autorização usa mock declarado do storage para verificar que assinatura não é chamada.

A migration `1789847748569-CreateVideos` foi gerada pela CLI TypeORM, aplicada e revertida em banco de teste. Nenhuma migration anterior foi editada. O teste antigo de migrations foi corrigido para remover seu enum antes da recriação e incluir a nova tabela.

## Correções encontradas na validação

- A branch dev não continha a fase 02. A feature incorporou por fast-forward a base oficial `8459b2f`, sem modificar main/dev. A PR deve visar dev.
- O lockfile antigo não permitia `npm ci`; ele foi reconciliado ao instalar as dependências fixadas. O build Docker confirmou sua reprodutibilidade.
- A imagem MinIO no Docker Hub não estava disponível; a mesma release foi obtida no registro Quay.
- Testes antigos falhavam no lint por `any`, métodos de mock e acesso a JSON sem contrato. Foram usados fixtures de entidades, mocks tipados, guards de campos JSON e acesso tipado à dependência de teste; regras não foram desativadas.
- A identificação de erro PostgreSQL de nickname agora valida os campos do `driverError` sem `any`, preservando a lógica de conflito; testes existentes de concorrência continuam aprovados.
- Título somente com espaços passou a ser rejeitado por validação e possui teste de regressão.

## Limites da evidência

Não foi transferido um arquivo físico de 10GiB. O contrato aceita exatamente 10.737.418.240 bytes, calcula 640 partes e rejeita um byte acima; o fluxo de bytes real foi testado com clips pequenos. Isso comprova contrato e integração, não desempenho sustentado de um upload de 10GiB. O worker requer disco local suficiente.

`npm ci` informou 60 vulnerabilidades no conjunto de dependências (3 baixas, 34 moderadas, 21 altas e 2 críticas). Não foi aplicado upgrade forçado à base. A classificação de produção/desenvolvimento e a remediação de cada advisory permanecem pendentes antes de uso público de produção. Endor package-risk não estava disponível: resultado UNKNOWN, sem aprovação de segurança.

O corpus Context7 consultado não é garantia de correspondência exata com as versões fixadas; ver library-refs.md. A suíte herdada também emite avisos de consulta concorrente no cliente pg; os testes passam, mas esse padrão precisa ser revisto antes de migrar para pg 9.

## Rastreabilidade

| Requisitos | Implementação | Evidência |
|---|---|---|
| FR-001..003 | VideosService, StorageService, DTOs | start-upload.spec, storage.integration-spec, videos.e2e-spec |
| FR-004..006 | VideoQueueService, VideoProcessingService, video-worker | worker externo e e2e de clip/erro/repetição |
| FR-007..008 | VideosController, ownership no service, URLs assinadas | e2e de 401/403/404, metadata, thumbnail, 206 e download |
| FR-009 | compose.yaml, Dockerfile.dev, migration | partida única e teste de migrations |
| FR-010 | AGENTS, Spec Kit, docs e ajustes mínimos de tipagem | suíte completa, tsc, lint e build |

Não houve merge, submissão na plataforma ou alteração de volumes externos a este projeto. Volumes do Compose permanecem preservados.

## Convergência após revisão independente

A revisão de `6cdcc88` identificou dois gaps reais, registrados como T014/T015 e corrigidos antes do encerramento:

- **Falha terminal fora do processador:** BullMQ pode marcar um job como failed por `deferredFailure` após excesso de stalled sem chamar o callback. O evento failed agora executa atualização condicional `processing → error`; uma reconciliação periódica de jobs failed persistidos recupera eventos perdidos/reinícios. A paginação de 50 jobs evita limitar a reconciliação aos primeiros registros. Vídeos ready não são sobrescritos. O teste `video-queue.integration-spec.ts` usa SDK BullMQ, Redis e PostgreSQL reais, injeta o campo `defa` que o script de stalled grava e comprova que o processador não executa, o erro persiste e o reinício reconcilia estado pendente. Não simula matar processos reais nem aguarda expiração física de lock.
- **Throttle incompatível com multipart/polling:** o limite herdado de 10 requisições/minuto era compartilhado por handler/IP. Assinaturas agora permitem 720/minuto e status 120/minuto por usuário autenticado. Os outros endpoints preservam os limites existentes. O e2e faz 12 assinaturas e 35 consultas imediatas, sem transmitir gigabytes, garantindo que os fluxos não interrompam na 11ª chamada. O cliente Python tem cinco tentativas para 429, respeita Retry-After em segundos/data HTTP e usa backoff quando ausente; outros erros não são repetidos.

Validação após correções: 150 testes Node, 55 e2e, TypeScript, lint e build aprovados; mais três testes Python de Retry-After, backoff limitado e não repetição de erro 403. Os testes de retry HTTP usam mocks declarados, enquanto o cenário de falha terminal usa infraestrutura real.

## Revalidação local — 2026-09-20

O enunciado integral foi revisitado. `git fetch --all` atualizou origin/upstream sem merge; o HEAD implementado inclui `upstream/main` em `8459b2f`. Os testes foram repetidos em **nova stack `mba-esai-296-validation`**, com volumes próprios, preservando os dados do ambiente anterior. Portas de validação: API 53096, MinIO 59096/59097, Mailpit 58096.

Resultados: 150 testes Node em 26 suítes, 55 e2e em quatro suítes e três testes Python aprovados; TypeScript, lint e build com exit 0. O build Docker e a inicialização aplicaram migrations em volume novo. O teste real de BullMQ confirmou novamente deferredFailure, preservação de ready e recuperação após reinício. O cliente Python percorreu cadastro, confirmação no Mailpit, login, multipart e processamento até ready pela API externa.

Correções documentais desta rodada: status da fase 03 no README principal alinhado ao backend implementado, com frontend de vídeos fora do escopo; configuração MCP PostgreSQL portada no exemplo Codex e validada por handshake/tools-list/SELECT read-only. O pacote MCP legado do starter está fixado em 0.6.2 e sua condição de não suportado foi registrada nas referências. Nenhuma configuração global ou segredo real foi lido/alterado. Os limites anteriores de evidência e dependências continuam válidos; não houve teste físico de 10GiB nem remediação de todos os advisories.
