# Pizzaria SaaS

Projeto completo de protótipo SaaS para uma pizzaria com:

- Cardápio interativo
- Área de login para cliente e dono
- Dashboard de cliente com carrinho e histórico de pedidos
- Dashboard do dono com gerenciamento de cardápio e vendas

## Como usar

1. Instale Node.js e npm na sua máquina.
2. Abra a pasta `pizzaria-saas`.
3. No terminal, execute:

```bash
npm install
npm start
```

4. Abra no navegador `http://localhost:3000`.
5. Não abra os arquivos HTML diretamente pelo `file://` — use o servidor Node para que as requisições à API funcionem corretamente.
6. Use as credenciais abaixo para fazer login, ou registre seu próprio e-mail em `register.html`:

- Cliente: `cliente@exemplo.com` / `cliente123`
- Dono: `dono@pizzaria.com` / `donopizza`

O banco de dados SQLite `database.sqlite` será criado automaticamente na primeira execução.

## Estrutura

- `index.html` - página inicial e cardápio público
- `login.html` - tela de login para clientes e dono
- `dashboard.html` - dashboard do cliente
- `admin.html` - dashboard do dono
- `styles.css` - estilos da aplicação
- `app.js` - lógica de login, sessão e dados do app

## Observações

O projeto usa Node.js/Express e SQLite para autenticação, sessão e persistência. O backend precisa estar em execução para que o login e o cadastro funcionem corretamente.
