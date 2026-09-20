---
kind: context
phase: phase-03-videos
---
# Contexto

Entrada: fase 296; docs/project-plan.md fase 03; decisões TD-03.1..6; base oficial 8459b2f. Existentes: auth JWT global, @Public, CurrentUser, channels 1:1 user, TypeORM, DomainExceptionFilter, ValidationPipe e Swagger. Frontend não será editado.

Entregas: módulo videos, repository, storage S3, fila BullMQ/Redis, worker FFmpeg separado, migration e compose. Contratos e dependências no plano. Autorização usa canal do usuário do JWT, nunca canal recebido do cliente. Dados: draft/processing/ready/error, IDs UUID, armazenamento privado. Limites: 1..10GiB, partes de 16MiB,3 tentativas, concorrência 1.

Fontes locais de aula consultadas:17642 — arquitetura StreamTube (separação API/worker),15396 — filas (intermediário durável),17992 — implementação de upload (contrato e validação). Só referências públicas/títulos serão publicados.

Portabilidade: AGENTS.md root/backend deriva de CLAUDE; SpecKit skills em .agents; pipeline original manual rastreado pelos artefatos. Config MCP exemplo separado, sem instalação/configuração global ou credenciais do usuário.
