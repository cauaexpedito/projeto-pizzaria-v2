const express = require('express');
const session = require('express-session');
const SessionFileStore = require('session-file-store')(session);
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const port = process.env.PORT || 3000;
const dbFile = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbFile, (err) => {
  if (err) {
    console.error('Falha ao abrir o banco de dados:', err);
    process.exit(1);
  }
});

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve(this);
      }
    });
  });
}

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

async function initDb() {
  await runAsync('PRAGMA foreign_keys = ON');

  await runAsync(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);

  await runAsync(`CREATE TABLE IF NOT EXISTS menu (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    image_url TEXT
  )`);

  // ensure image_url column exists if older DB schema is present
  try {
    const cols = await allAsync("PRAGMA table_info('menu')");
    const hasImage = cols.some((c) => c && c.name === 'image_url');
    if (!hasImage) {
      await runAsync('ALTER TABLE menu ADD COLUMN image_url TEXT');
    }
  } catch (err) {
    // ignore if alter table fails for any reason
  }

  await runAsync(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_email TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    total REAL NOT NULL,
    date TEXT NOT NULL
  )`);

  await runAsync(`CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    quantity INTEGER NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  )`);

  const owner = await getAsync('SELECT id FROM users WHERE role = ? LIMIT 1', ['dono']);
  if (!owner) {
    await runAsync(
      'INSERT INTO users (email, password, role, name, created_at) VALUES (?, ?, ?, ?, ?)',
      ['dono@pizzaria.com', 'donopizza', 'dono', 'Dono da Pizzaria', new Date().toISOString()]
    );
  }

  const menuCountRow = await getAsync('SELECT COUNT(*) AS count FROM menu');
  if (!menuCountRow || menuCountRow.count === 0) {
    const seedMenu = [
      { name: 'Margherita', description: 'Mussarela, tomate fresco e manjericão.', price: 39.9 },
      { name: 'Pepperoni', description: 'Pepperoni crocante com queijo especial.', price: 45.9 },
      { name: '4 Queijos', description: 'Mussarela, gorgonzola, parmesão e provolone.', price: 48.5 },
      { name: 'Vegetariana', description: 'Legumes grelhados com molho especial.', price: 42.9 }
    ];
    for (const item of seedMenu) {
      await runAsync('INSERT INTO menu (name, description, price) VALUES (?, ?, ?)', [item.name, item.description, item.price]);
    }
  }
}

initDb().catch((error) => {
  console.error('Erro ao inicializar o banco de dados:', error);
  process.exit(1);
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// prepare uploads folder and multer
const uploadsDir = path.join(__dirname, 'uploads');
try {
  fs.mkdirSync(uploadsDir, { recursive: true });
} catch (err) {
  console.warn('Não foi possível criar pasta de uploads:', err.message);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const safe = Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.-_]/g, '_');
    cb(null, safe);
  }
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.options('*', (req, res) => {
  res.sendStatus(200);
});

app.use(
  session({
    secret: 'pizzaria-saas-secret',
    store: new SessionFileStore({ path: path.join(__dirname, 'sessions'), retries: 1 }),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }
  })
);

// Root redirect: envia o usuário para a página correta sem precisar digitar outra rota
app.get('/', (req, res) => {
  if (req.session && req.session.user) {
    const role = req.session.user.role;
    if (role === 'dono') return res.redirect('/admin.html');
    if (role === 'cliente') return res.redirect('/dashboard.html');
  }
  return res.redirect('/index.html');
});

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Não autenticado' });
  }
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.user || req.session.user.role !== role) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    next();
  };
}

app.post('/api/register', async (req, res) => {
  try {
    const { email, password, name, role = 'cliente' } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
    }

    const safeEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail)) {
      return res.status(400).json({ error: 'E-mail inválido.' });
    }

    const existing = await getAsync('SELECT id, role FROM users WHERE lower(email) = ?', [safeEmail]);
    if (existing) {
      return res.status(409).json({ error: 'E-mail já cadastrado. Faça login ou use outro e-mail.' });
    }

    if (role === 'dono') {
      const existingOwner = await getAsync('SELECT id FROM users WHERE role = ?', ['dono']);
      if (existingOwner) {
        return res.status(403).json({ error: 'Já existe um dono cadastrado. Registre-se como cliente.' });
      }
    }

    await runAsync(
      'INSERT INTO users (email, password, role, name, created_at) VALUES (?, ?, ?, ?, ?)',
      [safeEmail, password, role, name.trim(), new Date().toISOString()]
    );

    return res.json({ success: true, message: 'Conta criada com sucesso. Faça login.' });
  } catch (error) {
    console.error('Erro em /api/register:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password || !role) {
      return res.status(400).json({ error: 'E-mail, senha e papel são obrigatórios.' });
    }

    const safeEmail = String(email).trim().toLowerCase();
    const user = await getAsync('SELECT * FROM users WHERE lower(email) = ?', [safeEmail]);
    if (!user) {
      return res.status(401).json({ error: 'E-mail não encontrado.' });
    }

    if (user.role !== role) {
      return res.status(401).json({ error: `Este usuário é ${user.role}. Selecione a área correta.` });
    }

    if (user.password !== password) {
      return res.status(401).json({ error: 'Senha incorreta.' });
    }

    req.session.user = { email: user.email, role: user.role, name: user.name };
    return res.json({ success: true, user: req.session.user });
  } catch (error) {
    console.error('Erro em /api/login:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

app.post('/api/logout', requireAuth, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Falha ao encerrar sessão.' });
    }
    res.clearCookie('connect.sid');
    return res.json({ success: true });
  });
});

app.get('/api/session', (req, res) => {
  if (!req.session.user) {
    return res.json({ authenticated: false });
  }
  return res.json({ authenticated: true, user: req.session.user });
});

app.get('/api/menu', async (req, res) => {
  try {
    const menu = await allAsync('SELECT * FROM menu ORDER BY id');
    return res.json({ menu });
  } catch (error) {
    console.error('Erro em /api/menu:', error);
    return res.status(500).json({ error: 'Erro ao carregar cardápio.' });
  }
});

app.get('/api/orders', requireAuth, async (req, res) => {
  try {
    let orders = [];
    if (req.session.user.role === 'dono') {
      orders = await allAsync('SELECT * FROM orders ORDER BY id DESC');
    } else {
      orders = await allAsync('SELECT * FROM orders WHERE customer_email = ? ORDER BY id DESC', [req.session.user.email]);
    }

    const ordersWithItems = [];
    for (const order of orders) {
      const items = await allAsync('SELECT item_id AS id, name, price, quantity FROM order_items WHERE order_id = ?', [order.id]);
      ordersWithItems.push({ ...order, items });
    }
    return res.json({ orders: ordersWithItems });
  } catch (error) {
    console.error('Erro em /api/orders:', error);
    return res.status(500).json({ error: 'Erro ao carregar pedidos.' });
  }
});

app.post('/api/checkout', requireRole('cliente'), async (req, res) => {
  try {
    const { cart } = req.body;
    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ error: 'Carrinho vazio.' });
    }

    const total = cart.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
    const now = new Date().toLocaleString('pt-BR');
    const orderResult = await runAsync(
      'INSERT INTO orders (customer_email, customer_name, total, date) VALUES (?, ?, ?, ?)',
      [req.session.user.email, req.session.user.name, total, now]
    );
    const orderId = orderResult.lastID;

    for (const item of cart) {
      await runAsync(
        'INSERT INTO order_items (order_id, item_id, name, price, quantity) VALUES (?, ?, ?, ?, ?)',
        [orderId, item.id, item.name, item.price, item.quantity]
      );
    }

    return res.json({ success: true, order: { id: orderId, customerEmail: req.session.user.email, customerName: req.session.user.name, total, date: now } });
  } catch (error) {
    console.error('Erro em /api/checkout:', error);
    return res.status(500).json({ error: 'Erro ao processar pedido.' });
  }
});

app.post('/api/menu', requireRole('dono'), upload.single('image'), async (req, res) => {
  try {
    const { name, description, price } = req.body;
    const parsedPrice = Number(price);
    if (!name || !description || Number.isNaN(parsedPrice) || parsedPrice <= 0) {
      return res.status(400).json({ error: 'Nome, descrição e preço válidos são obrigatórios.' });
    }

    let imageUrl = null;
    if (req.file && req.file.filename) {
      // serve via static root; store relative path
      imageUrl = '/uploads/' + req.file.filename;
    }

    const result = await runAsync('INSERT INTO menu (name, description, price, image_url) VALUES (?, ?, ?, ?)', [name.trim(), description.trim(), parsedPrice, imageUrl]);
    return res.json({ success: true, item: { id: result.lastID, name: name.trim(), description: description.trim(), price: parsedPrice, image_url: imageUrl } });
  } catch (error) {
    console.error('Erro em /api/menu POST:', error);
    return res.status(500).json({ error: 'Erro ao adicionar item.' });
  }
});

app.put('/api/menu/:id', requireRole('dono'), upload.single('image'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, description, price, currentImageUrl } = req.body;
    const parsedPrice = Number(price);
    if (!name || !description || Number.isNaN(parsedPrice) || parsedPrice <= 0) {
      return res.status(400).json({ error: 'Nome, descrição e preço válidos são obrigatórios.' });
    }

    const existingItem = await getAsync('SELECT * FROM menu WHERE id = ?', [id]);
    if (!existingItem) {
      return res.status(404).json({ error: 'Item não encontrado.' });
    }

    let imageUrl = existingItem.image_url || null;
    if (req.file && req.file.filename) {
      imageUrl = '/uploads/' + req.file.filename;
    } else if (currentImageUrl && currentImageUrl.trim() !== '') {
      imageUrl = currentImageUrl.trim();
    }

    await runAsync('UPDATE menu SET name = ?, description = ?, price = ?, image_url = ? WHERE id = ?', [
      name.trim(), description.trim(), parsedPrice, imageUrl, id
    ]);

    return res.json({ success: true, item: { id, name: name.trim(), description: description.trim(), price: parsedPrice, image_url: imageUrl } });
  } catch (error) {
    console.error('Erro em /api/menu PUT:', error);
    return res.status(500).json({ error: 'Erro ao atualizar item.' });
  }
});

app.delete('/api/menu/:id', requireRole('dono'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const result = await runAsync('DELETE FROM menu WHERE id = ?', [id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Item não encontrado.' });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('Erro em /api/menu DELETE:', error);
    return res.status(500).json({ error: 'Erro ao excluir item.' });
  }
});

app.get('/api/stats', requireRole('dono'), async (req, res) => {
  try {
    const totalOrdersRow = await getAsync('SELECT COUNT(*) AS count FROM orders');
    const totalRevenueRow = await getAsync('SELECT SUM(total) AS totalRevenue FROM orders');
    const menuCountRow = await getAsync('SELECT COUNT(*) AS count FROM menu');
    return res.json({
      totalOrders: totalOrdersRow.count || 0,
      totalRevenue: totalRevenueRow.totalRevenue || 0,
      menuCount: menuCountRow.count || 0
    });
  } catch (error) {
    console.error('Erro em /api/stats:', error);
    return res.status(500).json({ error: 'Erro ao carregar estatísticas.' });
  }
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint não encontrado', path: req.originalUrl });
});

app.use(express.static(path.join(__dirname)));

app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor iniciado em http://localhost:${port}`);
});
