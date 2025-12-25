# DTE Web Project

Aplicação web do **Diagrama de Tendência Esferal (DTE)** com:
- Cadastro e login de usuários;
- Armazenamento das respostas de cada usuário;
- Resultado individual com gráfico (triângulo);
- Tela admin para ver resultado por usuário;
- Tela admin com **agregado** do diagrama (todos os respondentes + ponto médio).

## Rodar localmente

1) Instale dependências:
```bash
npm install
```

2) Configure variáveis de ambiente:
```bash
cp .env.example .env
# edite .env
```

3) Inicie o servidor:
```bash
npm run dev
```

4) Abra:
- http://localhost:3000/

## Banco de dados
- SQLite em `./data/app.db` (criado automaticamente).

## Notas
- Para produção, configure um `JWT_SECRET` forte.
- O admin inicial é criado a partir das variáveis `ADMIN_*` no primeiro boot.

## Ordem aleatória das perguntas
- As perguntas são entregues pelo backend em ordem aleatória via `GET /api/questions`.

## Sobrescrever respostas (um envio por usuário)
- Se o mesmo usuário responder novamente, a nova submissão **substitui** a anterior (o servidor remove a submissão antiga antes de salvar a nova).

## Convites por link (Admin)
- Em `Admin · Respostas por usuário`, gere um convite e compartilhe o link `/invite.html?code=...`.
- O convidado cria cadastro (ou faz login) e o código de convite é associado ao usuário no registro.

## Convites por QR Code (Admin)
- O admin gera um convite e o sistema exibe um **QR Code** para o link do questionário.
- Endpoint do PNG: `GET /api/admin/invites/:code/qr.png` (restrito a admin).

## QR Code público
- O PNG do QR Code do convite é público (quem tiver o código consegue acessar): `GET /api/invites/:code/qr.png`.

## Painel do Administrador
- Ao logar como admin, você é redirecionado para `/admin-dashboard.html` com opções: questionário, convites (QR), agregado e busca individual.

## Admin (importante)
- Se o e-mail definido em `ADMIN_EMAIL` já existir como usuário comum, o servidor **promove para admin** e redefine a senha para `ADMIN_PASSWORD` na inicialização.
