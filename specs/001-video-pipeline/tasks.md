# Tasks: Vídeos
## Phase 1: Setup
- [x] T001 Portar instruções/MCP e registrar pesquisa em AGENTS.md, .codex/config.toml.example e docs/decisions/ (FR-010).
- [x] T002 Preparar Compose/FFmpeg/dependências em nestjs-project/compose.yaml e Dockerfile.dev (SI03.1/FR-009).
## Phase 2: Foundational
- [x] T003 Criar entidade/repository/migration CLI em nestjs-project/src/videos e database/migrations (SI03.2).
- [x] T004 Verificar baseline e modelo com infra real e registrar em docs/phases/phase-03-videos/progress.md.
## Phase 3: US1 Upload
- [x] T005 [US1] Testar limite/partes/autorização em nestjs-project/src/videos/*.spec.ts.
- [x] T006 [US1] Implementar S3/DTOs/services/controllers em nestjs-project/src/videos/ (FR-001..003/008).
- [x] T007 [US1] Validar multipart real em nestjs-project/test/videos.e2e-spec.ts.
## Phase 4: US2 Processamento
- [x] T008 [US2] Implementar outbox/BullMQ/FFmpeg em nestjs-project/src/videos/ e src/video-worker.ts (FR-004..006).
- [x] T009 [US2] Testar clip/inválido/idempotência em nestjs-project/test/videos.e2e-spec.ts com worker separado.
## Phase 5: US3 Reprodução
- [x] T010 [US3] Implementar status/consulta/stream/download/thumbnail em nestjs-project/src/videos/ (FR-007/008).
- [x] T011 [US3] Verificar 206 e download reais em nestjs-project/test/videos.e2e-spec.ts.
## Phase 6: Polish
- [x] T012 Atualizar documentação e cliente multipart em README.md, nestjs-project/scripts/upload-video.py e docs/phases/phase-03-videos/progress.md.
- [x] T013 Executar suíte completa/e2e/tsc/lint/build no container; revisar diff e convergência.
## Dependencies
T001→T002→T003/T004→US1→US2→US3→Polish. Testes antecipam código de cada SI; docs podem avançar em paralelo sem tocar código. MVP US1; entrega requer todas as histórias.
