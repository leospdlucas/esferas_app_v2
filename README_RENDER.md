# Deploy no Render (Web Service + Postgres)

Este projeto foi adaptado para usar Postgres via `DATABASE_URL` (ideal para hospedagem no Render).

## Variáveis obrigatórias
- `DATABASE_URL` (use `fromDatabase.property: connectionString` no Blueprint, ou copie do Render)
- `JWT_SECRET` (secreto)
- `DATABASE_SSL` (recomendado `true` no Render)

## Admin (opcional)
Se você definir:
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_NAME`

o servidor vai garantir (upsert) que esse usuário exista e tenha role `admin` a cada inicialização.

## Fluxo recomendado no Render
1) Criar um Postgres (plan free ou pago).
2) Criar um Web Service (Node), apontando para este repo.
3) Setar env vars: `DATABASE_URL`, `JWT_SECRET`, `DATABASE_SSL=true`, e opcionalmente as variáveis do admin.
4) Deploy.

Depois disso, gere o QR Code no menu do admin e use o `.onrender.com` para compartilhar.
