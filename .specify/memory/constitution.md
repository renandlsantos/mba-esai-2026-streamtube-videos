# StreamTube Videos Constitution

## Core Principles
### I. Continuidade e rastreabilidade
A fase MUST preservar autenticação, canais e frontend existentes. Cada requisito MUST apontar para SI, implementação e evidência. Decisões não podem ser apresentadas como requisitos do professor.
### II. Separação e segurança
Controllers MUST ser finos; serviços contêm regras; repositories isolam persistência. Upload e alterações MUST validar o dono do canal. Apenas vídeos prontos são acessíveis publicamente. Arquivos não podem atravessar a memória da API.
### III. Processamento recuperável
Storage, fila e worker MUST ser reais. Processamento MUST ser idempotente, limitado e registrar erro; entrega assíncrona não pode depender da disponibilidade imediata do worker.
### IV. Qualidade verificável
Testes unitários, integração, e2e, TypeScript, lint e build MUST passar em containers. Limites não exercitados fisicamente (10GB) MUST ser declarados sem fingir transferência realizada.
### V. SDD e privacidade
O workflow MUST produzir decisões, contexto, validação clean, plano SI/Technical Specs e progresso antes/depois da implementação. Segredos, aulas privadas e credenciais reais MUST ficar fora do Git.

## Additional Constraints
Backend NestJS 11/TypeORM/PostgreSQL 17, MinIO S3, fila escolhida no research, FFmpeg separado. Sem frontend novo, merge automático ou submissão. Serviços usam DNS Compose; URLs externas assinadas usam endereço acessível ao cliente.

## Development Workflow
Constitution → specify → plan (research/context/validate/resolve/build) → tasks → implement SI a SI → converge. Usuário autorizou o fluxo completo; decisões técnicas rotineiras são registradas e revisadas. Infra isolada mba-esai-296.

## Governance
Versão semântica; alterações de princípio exigem análise de impacto e revisão. Não reutilizar resultados antigos como validação do código novo. Revisar cinco princípios antes do push.

**Version**: 1.0.0 | **Ratified**: 2026-09-19 | **Last Amended**: 2026-09-19
