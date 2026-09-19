---
kind: decisions
scope_type: phase
related_phases: [3]
status: decided
---
# Decisões técnicas — fase 03 vídeos

Revisadas em 2026-09-19, antes de implementação. Fonte: fase 296 e docs/project-plan.md.

## TD-03.1 — Fila
Opções: RabbitMQ (roteamento flexível, exige retry/DLQ manual); Kafka (log/replay, operação excessiva para jobs); BullMQ+Redis (jobs/retries/deduplicação, stack TypeScript familiar). Escolha: BullMQ com Redis AOF e worker separado. Consequência: Redis passa a ser componente operacional; entrega é at-least-once, não exactly-once. JobId=UUID do vídeo; processamento idempotente. Intenção persistida no próprio registro (`enqueue_pending`) funciona como outbox simples e é reenviada até confirmação de publicação.

## TD-03.2 — Upload de 10GiB
Opções: proxy da API (bandwidth/duração da requisição inadequados); PUT único (limite/retomada); multipart S3 direto. Escolha: multipart, partes de 16MiB, até 640 partes, URLs por parte expiram em 15min. API recebe só metadados e ETags; ListParts confere total e tamanhos reais antes da conclusão. Tamanho aceito 1..10*1024^3 bytes. Pré-cadastro draft associado ao canal. Upload cancelável; não há limpeza global de arquivos do usuário.

## TD-03.3 — Processamento
FFprobe/FFmpeg via executável do container, spawn/execFile com argv, sem shell e sem URL remota. Worker baixa em stream para diretório temporário exclusivo, extrai metadados, captura thumbnail JPEG e remove temporários em finally. Protocol whitelist file/pipe impede playlist maliciosa buscar rede. Concorrência 1 limita disco; timeout de 20min, 3 tentativas com backoff. Requer mais de 10GiB livres para maior arquivo. Sem transcodificação ABR nesta fase.

## TD-03.4 — URL e reprodução
UUID único indexado como slug e rota /videos/:slug. Mídia pronta redireciona307 para GET S3 assinado por15min; MinIO/S3 implementa Range/206 e Content-Disposition de download. Alternativa proxy API evitada para não transportar vídeo pelo servidor. Endpoint interno `storage:9000`, endpoint público configurável `http://localhost:59000` só para links de cliente externo. Arquivo permanece privado no bucket. Thumbnail também GET assinado.

## TD-03.5 — Estado e consistência
Draft→processing depois de multipart concluído/tamanho conferido; processing→ready depois de metadados/thumbnail; erro após retry final. Cancelamento draft→error/UPLOAD_CANCELLED. Lock pessimista serializa concluir/cancelar. Se S3 conclui mas transação falha, nova conclusão verifica HEAD e recupera; nenhum sucesso é anunciado sem persistência. Worker só processa processing, ready é no-op. Intenção de fila é transacional com status para sobreviver à indisponibilidade de Redis. Falha de enqueue mantém pending=true.

## TD-03.6 — Base/IA e evidências
A feature foi criada de dev 0b82246, mas essa referência não inclui fase 02. Fast-forward da feature para origin/main 8459b2f incorporou base oficial auth/channels/OpenAPI/frontend. Dev/main permaneceram intactas. Uma eventual PR deve apontar para dev, conforme o enunciado. Portar instruções para AGENTS.md e executar pipeline manual+SpecKit é permitido pelo enunciado. Context7 não estava exposto inicialmente. A verificação MCP foi depois executada pelo servidor Docker local e registrada em library-refs.md; fontes oficiais e APIs instaladas complementam a evidência. Full suite executada somente nos containers dedicados.
