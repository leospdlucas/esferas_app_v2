# DTE - Diagrama de Tendência Esferal

Aplicação web para aplicar o questionário DTE (Diagrama de Tendência Esferal), com sistema de usuários, admin e geração de QR Codes para compartilhamento.

## 🚀 Deploy no Render (Grátis)

### Passo 1: Preparar o repositório

1. Crie uma conta no [GitHub](https://github.com) se não tiver
2. Crie um novo repositório (pode ser privado)
3. Faça upload de todos os arquivos deste projeto

### Passo 2: Configurar no Render

1. Acesse [render.com](https://render.com) e crie uma conta (pode usar o GitHub)
2. No Dashboard, clique em **"New +"** → **"Web Service"**
3. Conecte seu repositório GitHub
4. Configure:

| Campo | Valor |
|-------|-------|
| **Name** | `dte-app` (ou outro nome) |
| **Region** | `Oregon (US West)` ou o mais próximo |
| **Branch** | `main` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | `Free` |

### Passo 3: Configurar variáveis de ambiente

No Render, vá em **Environment** e adicione:

| Variável | Valor | Descrição |
|----------|-------|-----------|
| `JWT_SECRET` | `gere-um-segredo-aleatorio-longo-aqui` | Segredo para tokens (use algo como `openssl rand -hex 32`) |
| `ADMIN_EMAIL` | `seu@email.com` | Email do administrador |
| `ADMIN_PASSWORD` | `sua-senha-segura` | Senha do administrador |
| `ADMIN_NAME` | `Seu Nome` | Nome do administrador |
| `NODE_ENV` | `production` | Modo de produção |

### Passo 4: Deploy

1. Clique em **"Create Web Service"**
2. Aguarde o build (pode demorar alguns minutos na primeira vez)
3. Quando aparecer "Live", sua URL estará disponível!

**Sua URL será algo como:** `https://dte-app.onrender.com`

---

## 📱 Funcionalidades

### Para Usuários
- Cadastro e login separados
- Questionário DTE completo
- Validação de perguntas não respondidas (com scroll automático)
- Visualização do resultado com diagrama

### Para Admin
- **Painel de Controle** com menu de opções
- **Gerar QR Code** - Crie convites para compartilhar com amigos
- **Acessar questionário** - Responda como um usuário normal
- **Resultado agregado** - Veja todos os resultados
- **Buscar usuários** - Pesquise por nome/email

---

## 🔗 Compartilhando com Amigos

1. Faça login como admin
2. Acesse **"Gerar convite (QR Code)"**
3. Configure expiração e limite de usos (opcional)
4. Clique em **"Gerar QR Code"**
5. Compartilhe a imagem do QR Code!

Seus amigos podem:
- Escanear o QR Code com a câmera do celular
- Ou acessar diretamente o link

---

## 🛠 Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Copiar arquivo de configuração
cp .env.example .env

# Editar .env com suas configurações
# (defina JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD)

# Iniciar servidor
npm run dev

# Acesse: http://localhost:3000
```

---

## 📁 Estrutura do Projeto

```
├── server.js           # Servidor Express principal
├── db.js               # Configuração SQLite
├── auth_middleware.js  # Middlewares de autenticação
├── server_scoring.js   # Lógica de pontuação
├── package.json        # Dependências
├── .env.example        # Exemplo de configuração
└── public/
    ├── index.html          # Página de login
    ├── cadastro.html       # Página de cadastro
    ├── quiz.html           # Questionário
    ├── result.html         # Resultado individual
    ├── invite.html         # Página de convite
    ├── admin-dashboard.html # Painel admin
    ├── admin-individual.html # Busca de usuários
    ├── invites.html        # Gerenciar convites
    ├── aggregate.html      # Resultado agregado
    ├── css/style.css       # Estilos
    ├── js/                 # Scripts frontend
    └── data/questions.json # Perguntas do questionário
```

---

## ⚠️ Notas Importantes

### Sobre o Render Free Tier
- O serviço "dorme" após 15 minutos de inatividade
- A primeira requisição após "dormir" demora ~30 segundos
- O banco de dados SQLite é persistente no disco

### Banco de Dados
- Usa SQLite (arquivo local)
- No Render, o banco fica em `/data/app.db`
- Backups manuais são recomendados para dados importantes

### Segurança
- Nunca compartilhe seu `JWT_SECRET`
- Use senhas fortes para o admin
- O QR Code público permite cadastro, mas não acesso sem senha

---

## 📝 Licença

MIT - Use livremente!
