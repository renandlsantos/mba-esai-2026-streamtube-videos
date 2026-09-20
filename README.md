# StreamTube — Plataforma de Compartilhamento de Vídeos

Projeto da disciplina **Desenvolvimento de Aplicações de IA** do MBA de Engenharia de Software com IA da [Full Cycle](https://fullcycle.com.br).

Este é um projeto greenfield desenvolvido para demonstrar como construir uma aplicação do zero utilizando IA de forma adequada no processo de desenvolvimento.

## Professor

<a href="https://github.com/argentinaluiz">
    <img src="https://avatars.githubusercontent.com/u/4926329?v=4?s=100" width="100px;" alt=""/>
    <br />
    <sub>
        <b>Luiz Carlos</b>
    </sub>
</a>

---

## Quadro Branco

- [Quadro Branco](./whiteboard.png)

---

## 🎨 Design System (Figma)

- [FC Tube.fig](./FC%20Tube.fig) — arquivo-fonte do **design system** do projeto no Figma.
- [FC Tube sem padrão.fig](./FC%20Tube%20sem%20padrao.fig) — arquivo-fonte puro, sem tokens, cores, tipografia e espaçamento.

Contém os fundamentos visuais do StreamTube — tokens (cores, tipografia, espaçamento, raios), componentes e as telas da plataforma. É a referência de design para a implementação do frontend: os componentes em `next-frontend/components/ui` (shadcn) e os tokens em `next-frontend/app/globals.css` derivam deste arquivo. Abra-o no Figma (`Arquivo → Importar`) para consultar especificações e estados visuais.

---

## 📋 Pré-requisitos

- Docker e Docker Compose
- Node.js v25+ (para rodar os testes E2E do Playwright no host)
- npm

## 🏗️ Arquitetura

O projeto é um monorepo baseado em containers Docker. Cada subprojeto sobe sua própria stack via `docker compose`.

- **Frontend** (Next.js 16, App Router + React Server Components) — interface da plataforma. Segue o **modelo BFF**: o navegador nunca chama a API NestJS diretamente; todo tráfego passa por Route Handlers same-origin em `app/api/**`, que fazem proxy server-side para a API.
- **API** (NestJS 11) — regras de negócio, autenticação (JWT + refresh token rotation), envio de e-mails e acesso ao banco.
- **Database** (PostgreSQL 17) — usuários, canais, tokens de autenticação e vídeos.
- **Email Service** (Mailpit) — captura os e-mails transacionais (confirmação de conta e recuperação de senha) em uma UI local.
- **Video Worker** (FFmpeg) — processamento assíncrono de vídeos, implementado na Fase 03.
- **Object Storage** (S3/MinIO) — arquivos de vídeo e thumbnails, implementado na Fase 03.
- **Message Queue** (BullMQ/Redis) — fila de processamento de vídeos, implementada na Fase 03.

O diagrama de arquitetura completo (C4) está em `docs/diagrams/software-arch.mermaid`.

## 🚀 Como rodar

Os dois subprojetos têm stacks Docker **separadas**. O backend aplica migrations e inicia automaticamente. O frontend das fases anteriores é opcional e não participa da entrega da Fase 03.

### 1. Backend (API, PostgreSQL, MinIO, Redis, worker e Mailpit)

```bash
cd nestjs-project
docker compose up -d --build
```

A imagem instala o lockfile; a API compila, aplica migrations e inicia. O worker aguarda a API saudável. Não inicie outro servidor na mesma porta.

| Serviço | URL / Porta |
|---------|-------------|
| API NestJS | http://localhost:53000 |
| PostgreSQL | `db:5432`, somente na rede Compose |
| MinIO / console | http://localhost:59000 / http://localhost:59001 |
| Mailpit | http://localhost:58025 |
| Swagger (opcional) | http://localhost:53000/api/docs — habilite com `SWAGGER_ENABLED=true` |

Consulte [o guia da Fase 03](docs/phases/phase-03-videos/README.md) para enviar vídeos, autenticar e verificar processamento.

### 2. Frontend (Next.js)

```bash
cd next-frontend

# Garanta que o .env.local existe (veja .env.example)
# API_URL aponta para o backend; SESSION_PASSWORD protege a sessão (iron-session)

docker compose up -d
docker compose exec next-frontend npm install        # apenas na primeira vez
docker compose exec -d next-frontend npm run dev
```

A aplicação ficará disponível em **http://localhost:3001**.

> As stacks são separadas, então o frontend acessa o backend via `host.docker.internal:53000` nesta configuração. Ajuste `API_URL` no ambiente local do frontend; a interface de vídeos não foi implementada nesta fase.

## 🧪 Testes

### Backend (Jest)

Os testes de migrations recriam tabelas: use uma stack dedicada, sem dados que deseja preservar. Pare o worker externo durante a suíte de integração e inicie-o para os e2e de vídeo.

```bash
cd nestjs-project
docker compose stop video-worker
docker compose exec -T nestjs-api npm test -- --runInBand
docker compose start video-worker
docker compose exec -T nestjs-api npm run test:e2e -- --runInBand
docker compose exec -T nestjs-api npx tsc --noEmit
docker compose exec -T nestjs-api npm run lint
docker compose exec -T nestjs-api npm run build
```

Sufixos: `*.spec.ts` (unitários), `*.integration-spec.ts` (serviços reais) e `*.e2e-spec.ts` (HTTP). A [evidência da Fase 03](docs/phases/phase-03-videos/progress.md) registra a validação em volumes separados.

### Frontend (Vitest + Playwright)

```bash
cd next-frontend
docker compose exec next-frontend npm test            # unitários + integração (Vitest + MSW)
npx playwright test                                   # end-to-end (no host, com dev server em MSW_ENABLED=true)
```

Sufixos: `*.test.ts(x)` (unitário), `*.integration.test.ts(x)` (Route Handlers com MSW), `*.e2e-spec.ts` (Playwright). MSW intercepta as chamadas à API NestJS — os testes nunca batem no backend real.

## ✅ Funcionalidades implementadas

**Fase 01 — Configuração base** e **Fase 02 — Autenticação** estão concluídas (backend + frontend). A **Fase 03 — Upload e Processamento de Vídeos** está implementada no backend (API, worker e infraestrutura); a interface de vídeos está fora do escopo deste desafio.

### Autenticação (Fase 02)

Fluxo completo de **cadastro → confirmação por e-mail → login → recuperação de senha**, com canal criado automaticamente para cada usuário (a partir do prefixo do e-mail).

Endpoints da API (`nestjs-project`):

| Método & Rota | Descrição |
|---------------|-----------|
| `POST /auth/register` | Cadastro de usuário (cria usuário + canal) |
| `GET /auth/confirm-email?token=` | Confirmação de conta via link do e-mail |
| `POST /auth/resend-confirmation` | Reenvio do e-mail de confirmação |
| `POST /auth/login` | Login (retorna access + refresh token) |
| `POST /auth/refresh` | Rotação de refresh token (com family + grace period) |
| `POST /auth/logout` | Revoga os refresh tokens da sessão |
| `POST /auth/forgot-password` | Solicita e-mail de recuperação de senha |
| `POST /auth/reset-password` | Redefine a senha via token |
| `GET /auth/me` | Dados do usuário autenticado (protegido por JWT) |

Telas e Route Handlers BFF (`next-frontend`):

- `/(auth)/signup`, `/(auth)/login`, `/(auth)/forgot-password` — formulários com React Hook Form + Zod e validação inline.
- `app/api/auth/{signup,login,logout,forgot-password}` — proxy same-origin para a API.

Segurança: senhas com **Argon2**, **JWT** com `JwtAuthGuard` global (opt-out via `@Public()`), **rotação de refresh token** com detecção de reuso, **rate limiting** (`ThrottlerGuard`) nos endpoints de auth, e sessão no navegador via **iron-session** (cookies HTTP-only).

## 🛠️ Estrutura do Projeto

```
green-field-ia-project/
├── docs/
│   ├── project-plan.md                  # Planejamento geral do projeto
│   ├── phases/                          # Planos e implementação por fase
│   │   ├── phase-01-configuracao-base/
│   │   ├── phase-02-auth/               # Auth (backend)
│   │   └── phase-02-auth-frontend/      # Auth (frontend)
│   └── diagrams/
│       └── software-arch.mermaid        # Diagrama de arquitetura (C4)
├── nestjs-project/                      # Backend API (NestJS 11)
│   ├── src/
│   │   ├── auth/                        # Cadastro, login, JWT, refresh, reset de senha
│   │   ├── users/                       # Entidade e serviço de usuários
│   │   ├── channels/                    # Canal 1:1 por usuário (nickname do e-mail)
│   │   ├── mail/                        # Envio de e-mails (templates Handlebars)
│   │   ├── common/                      # Filtros, pipes e exceptions de domínio
│   │   ├── config/                      # Configs namespaced (Joi)
│   │   └── database/                    # data-source, migrations e seeds
│   ├── test/                            # Testes e2e
│   ├── compose.yaml                     # Docker Compose (API + PostgreSQL + Mailpit)
│   └── Dockerfile.dev
├── next-frontend/                       # Frontend (Next.js 16, App Router)
│   ├── app/                             # Rotas, layouts, páginas e Route Handlers BFF
│   ├── components/                      # Componentes de auth, UI (shadcn) e ícones
│   ├── lib/                             # env, api (openapi-fetch), auth/session
│   ├── mocks/                           # MSW (handlers + server)
│   ├── tests/                           # E2E (Playwright)
│   ├── compose.yaml                     # Docker Compose (dev server)
│   └── Dockerfile.dev
├── CLAUDE.md                            # Instruções para IA
├── FC Tube.fig                          # Design system do projeto (Figma)
├── whiteboard.png                       # Quadro branco do projeto
└── README.md
```

## 📚 Fases do Projeto

| Fase | Descrição | Status |
|------|-----------|--------|
| **01** | Configuração Base do Projeto | ✅ Concluída |
| **02** | Cadastro, Login e Gerenciamento de Conta | ✅ Concluída |
| **03** | Upload e Processamento de Vídeos | ✅ Backend implementado e validado; frontend fora do escopo |
| **04** | Gerenciamento de Vídeos e Canal | ⏳ Planejada |
| **05** | Página de Visualização do Vídeo | ⏳ Planejada |
| **06** | Interações Sociais (Likes, Comentários, Inscrições) | ⏳ Planejada |
| **07** | Página Inicial, Busca e Finalização | ⏳ Planejada |

Detalhes completos em `docs/project-plan.md`.

## 📖 Stack Tecnológica

| Camada | Tecnologia |
|--------|------------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, React Hook Form + Zod, iron-session, openapi-fetch |
| Backend | NestJS 11, TypeScript, TypeORM, JWT, Argon2, Mailer (Handlebars) |
| Banco de Dados | PostgreSQL 17 |
| E-mail (dev) | Mailpit |
| Containerização | Docker, Docker Compose |
| Testes | Jest, Supertest (backend); Vitest, MSW, Playwright (frontend) |
| Qualidade | ESLint, Prettier |
</content>


## Entrega MBA — fase 03 de vídeos

Implementação SDD na branch `feature/sdd-fase-296`. Consulte [execução, arquitetura e contratos da fase 03](docs/phases/phase-03-videos/README.md) e [evidências de validação](docs/phases/phase-03-videos/progress.md). A PR desta fase deve visar `dev`.
