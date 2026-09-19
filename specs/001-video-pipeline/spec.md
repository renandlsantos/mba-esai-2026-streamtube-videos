# Feature Specification: Upload e processamento de vídeos
**Feature Branch**: `feature/sdd-fase-296`
**Created**: 2026-09-19
**Status**: Revisada
**Input**: Fase 03 StreamTube — enunciado fase296, docs/project-plan.md.

## User Scenarios & Testing
### User Story 1 — Enviar vídeo (Priority: P1)
Usuário autenticado inicia upload para seu canal, envia partes diretamente ao storage e confirma conclusão.
**Why this priority**: porta de entrada da fase.
**Independent Test**: iniciar upload autenticado, verificar rascunho, enviar partes reais e confirmar; outro usuário não pode assinar/concluir.
**Acceptance Scenarios**: tamanho entre 1 e 10GiB aceito; acima rejeitado; partes incompletas não processam; repetição da conclusão não duplica job.
### User Story 2 — Processar automaticamente (Priority: P1)
Worker recebe trabalho, extrai duração/metadados, gera thumbnail e torna vídeo pronto; arquivos inválidos geram erro observável.
**Why this priority**: transforma arquivo em vídeo utilizável sem bloquear API.
**Independent Test**: vídeo real pequeno transita draft→processing→ready; arquivo inválido termina error após tentativas.
**Acceptance Scenarios**: job repetido não duplica resultado; indisponibilidade de fila não perde intenção persistida; arquivo temporário removido após sucesso/falha.
### User Story 3 — Assistir e baixar (Priority: P2)
Visitante obtém URL única de vídeo pronto e transmite trecho com Range ou baixa arquivo.
**Why this priority**: prova entrega utilizável.
**Independent Test**: GET com Range retorna 206 e tamanho parcial; download retorna attachment; rascunho/erro não expõe arquivo.
**Acceptance Scenarios**: ID único por vídeo; thumbnail acessível somente ready; dono consulta status privado.
### Edge Cases
Uploads incompletos, tamanho declarado falso, MIME não vídeo, conteúdo inválido, duas conclusões simultâneas, falha entre storage/banco/fila, crash do worker, cliente sem JWT, usuário de outro canal, Range inválido.

## Requirements
### Functional Requirements
- FR-001: Pré-cadastrar rascunho no canal do usuário autenticado ao iniciar upload.
- FR-002: Permitir até 10GiB por upload direto multipart sem transportar bytes pela API.
- FR-003: Validar partes reais e tamanho antes de completar; permitir retomar assinatura e cancelar rascunho.
- FR-004: Persistir intenção de processamento e entregar via fila real a worker separado.
- FR-005: Extrair duração, codec, dimensões e formato com ffprobe e gerar thumbnail FFmpeg.
- FR-006: Persistir status draft/processing/ready/error e motivo seguro de erro; repetir jobs com segurança.
- FR-007: Gerar identificador único e oferecer streaming Range/206 e download para ready.
- FR-008: Proteger mutações/status privado por dono; publicar apenas metadados sanitizados de ready.
- FR-009: Subir API/banco/MinIO/Redis/worker em Compose; schema por migration.
- FR-010: Preservar fases01/02, portar instruções ao Codex e entregar artefatos do workflow com testes/build/lint.
### Key Entities
Vídeo: canal, título, tamanho, status, chaves storage, upload multipart, duração/metadados, slug, intenção de fila e erro.
Mensagem: versão1, videoId; dados sensíveis e URLs assinadas não circulam pela fila.

## Success Criteria
- SC-001: E2E real comprova upload pequeno→worker→thumbnail→206/download.
- SC-002: Testes de limite aceitam 10GiB e rejeitam +1 byte; teste físico de10GiB identificado separadamente se não executado.
- SC-003: Usuário alheio recebe 403; não autenticado 401; não-ready não expõe mídia.
- SC-004: Suíte completa, integração/e2e, tsc, lint e build passam nos containers.

## Assumptions
10GB interpretado como 10GiB, explicitamente documentado. Reprodução progressiva de MP4/WebM compatível com navegador, sem ABR/transcoding de todos os formatos. Preservar arquivo original para download. Limite físico exige espaço de disco worker superior ao vídeo. Frontend fora do escopo.
