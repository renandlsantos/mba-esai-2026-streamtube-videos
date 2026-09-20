# Implementation Plan: StreamTube vídeos

**Branch**: feature/sdd-fase-296 | **Date**: 2026-09-19 | **Spec**: [spec.md](spec.md)

## Summary
O [plano executável da fase](../../docs/phases/phase-03-videos/phase-03-videos.md) contém os SI, contratos e especificações técnicas, evitando duplicação.

## Technical Context
TypeScript, NestJS 11, TypeORM, PostgreSQL 17, AWS SDK v3, MinIO, BullMQ 5, Redis 7 e FFmpeg. Node 22 executa em Docker. Um cliente Python envia multipart diretamente ao storage; a API recebe somente JSON. Backend sem alterações de frontend. Limite de 10GiB; concorrência do worker igual a 1; timeout de geração da thumbnail de 20 minutos.

## Constitution Check
Os cinco princípios foram revisados: continuidade da base oficial, separação de camadas e autorização, intenção persistida/retries, testes reais, artefatos e privacidade. A pesquisa inicial usou fontes oficiais; a consulta Context7 foi depois realizada pelo servidor MCP Docker e registrada em library-refs.md.

## Project Structure
`nestjs-project/src/videos/` contém DTOs, entidade, repository, storage, serviço, controller, fila, processador e módulo. `src/video-worker.ts` inicia o processo separado. Migrations ficam em `src/database/migrations`; o e2e fica em `test/videos.e2e-spec.ts`; infraestrutura em compose.yaml e Dockerfile.dev. O cliente fica em `scripts/upload-video.py`. Os documentos completos estão em `docs/phases/phase-03-videos`.

## Complexity Tracking
Uma intenção booleana no registro substitui tabela dedicada de outbox, adequada a um trabalho por vídeo. A fila é única, sem barramento de eventos generalizado. Python foi escolhido para o cliente por dispensar instalação Node no host e bibliotecas externas.
