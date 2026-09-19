---
kind: phase
name: phase-03-videos
---
# Fase 03 — upload e processamento de vídeos

## Objective
Implementar FR-001 a FR-010 de `specs/001-video-pipeline/spec.md`, preservando autenticação e canais da fase 02.

## Step Implementations

| Etapa | Implementação | Aceite |
|---|---|---|
| SI-03.1 | Compose isolado com PostgreSQL, Mailpit, MinIO, Redis, API e worker; Node 22 e FFmpeg | Partida única, serviços saudáveis e instalação pelo lockfile |
| SI-03.2 | Entidade Video, repository e migration gerada pela CLI | Schema criado/revertido em banco real |
| SI-03.3 | Multipart S3, DTOs e autorização pelo canal | Upload real; rejeição de partes/tamanho inválidos e acesso alheio |
| SI-03.4 | Intenção persistida, BullMQ e worker FFmpeg separado | Vídeo real pronto com thumbnail; mídia inválida termina em erro |
| SI-03.5 | Consulta, streaming e download | Range 206 real, arquivo íntegro e rascunho não exposto |
| SI-03.6 | Testes, documentação, cliente e portabilidade Codex | Suíte completa, e2e, tsc, lint e build aprovados |

## Technical Specifications

### Data Model
Tabela `videos`: `id` UUID primário; `slug` UUID único; `channel_id` FK para channels com exclusão em cascata; `title` varchar(200); `status` varchar(16); `size_bytes` bigint; `content_type` varchar(100); `object_key`, `thumbnail_key` e `upload_id` texto; `duration_seconds` double; `metadata` JSONB com dimensões, codec e formato; `error_code` texto; `enqueue_pending` boolean; datas de criação/atualização. Índice em status e intenção pendente. Transformer converte bigint para number, seguro para o limite definido, inferior a 2^53.

### API Contracts

| Método e rota | Resultado | Autorização |
|---|---|---|
| POST `/videos/uploads` | 201: id, slug, status, part_size, part_count | JWT e canal existente |
| POST `/videos/:id/upload-parts/:partNumber` | 201: url, expires_in | Dono; draft e parte válida |
| POST `/videos/:id/complete` | 202: id, status | Dono; partes completas; repetição segura |
| DELETE `/videos/:id/upload` | 204 | Dono; draft |
| GET `/videos/:id/status` | 200: estado e erro seguro | Dono |
| GET `/videos/:slug` | 200: metadados sanitizados | Público; somente ready |
| GET `/videos/:slug/stream` | 307 para GET S3 assinado | Público; somente ready |
| GET `/videos/:slug/download` | 307 para GET S3 com attachment | Público; somente ready |
| GET `/videos/:slug/thumbnail` | 307 para JPEG assinado | Público; somente ready |

Início recebe `{title, size_bytes, content_type}`. Conclusão recebe `{parts: [{part_number, etag}]}`. O cliente preserva o cabeçalho Range ao seguir o redirect; MinIO responde 206. URLs expiram em 900 segundos. A API nunca recebe o corpo binário do vídeo.

### Authorization Matrix
Criar exige usuário autenticado com canal. Assinar, concluir, cancelar e consultar status exigem o mesmo proprietário do canal. Outro dono recebe 403; inexistente, 404; sem JWT, 401. Somente vídeos ready possuem metadados e mídia públicos. Chaves internas do storage não são retornadas.

### Error Catalog
`VIDEO_NOT_FOUND` (404), `VIDEO_FORBIDDEN` (403), `VIDEO_STATE_CONFLICT` (409), `VIDEO_INVALID_UPLOAD` (400). Estado error contém `VIDEO_PROCESSING_FAILED` ou `UPLOAD_CANCELLED`. DTO inválido retorna 400 pelo ValidationPipe. Erros de infraestrutura não retornam credenciais ou URLs privadas.

### Events/Messages
Fila `video-processing`; trabalho `process-video`; payload `{version: 1, videoId}`; jobId igual ao UUID. Três tentativas com backoff exponencial iniciado em 1 segundo. Intenção e estado processing são gravados na mesma transação. O dispatcher lê pendências, publica e limpa a intenção após confirmação; falha conserva a intenção. Entrega at-least-once e processamento idempotente, sem promessa de exactly-once. Worker ignora vídeos já finalizados e só publica ready depois de salvar metadados e thumbnail.

## Dependency Map
SI-03.1 → SI-03.2 → SI-03.3 → SI-03.4 → SI-03.5 → SI-03.6. Storage pode ser testado isoladamente após a infraestrutura. Worker depende do modelo e do storage. Frontend não é alterado.

## Deliverables
Módulo de vídeos, migration, worker, Compose, testes e cliente Python sem dependências externas; documentos de decisões, contexto, validação, referências, plano e progresso; AGENTS portado; README reproduzível. Limite de 10GiB verificado na fronteira e por fluxo real com arquivo pequeno; teste físico de 10GiB identificado separadamente.
