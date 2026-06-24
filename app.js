function formatPrice(value) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function redirectTo(page) {
  window.location.href = page;
}

async function safeJson(response) {
  const text = await response.text();
  if (!text) {
    if (!response.ok) {
      throw new Error(`Erro ${response.status}: resposta vazia do servidor.`);
    }
    return {};
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Resposta inválida do servidor: ${text}`);
  }
}

async function handleResponse(response) {
  const json = await safeJson(response);
  if (!response.ok) {
    throw new Error(json.error || 'Erro inesperado do servidor.');
  }
  return json;
}

const api = {
  async login(email, password, role) {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ email, password, role })
    });
    return handleResponse(response);
  },
  async register(name, email, password, role) {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ name, email, password, role })
    });
    return handleResponse(response);
  },
  async logout() {
    const response = await fetch('/api/logout', {
      method: 'POST',
      credentials: 'same-origin'
    });
    return handleResponse(response);
  },
  async getSession() {
    const response = await fetch('/api/session', { credentials: 'same-origin' });
    return handleResponse(response);
  },
  async getMenu() {
    const response = await fetch('/api/menu', { credentials: 'same-origin' });
    return handleResponse(response);
  },
  async getOrders() {
    const response = await fetch('/api/orders', { credentials: 'same-origin' });
    return handleResponse(response);
  },
  async checkout(cart) {
    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ cart })
    });
    return handleResponse(response);
  },
  async addMenuItem(name, description, price) {
    // fallback: previous signature
    const response = await fetch('/api/menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ name, description, price })
    });
    return handleResponse(response);
  },
  async deleteMenuItem(id) {
    const response = await fetch(`/api/menu/${id}`, {
      method: 'DELETE',
      credentials: 'same-origin'
    });
    return handleResponse(response);
  },
  async getStats() {
    const response = await fetch('/api/stats', { credentials: 'same-origin' });
    return handleResponse(response);
  }
};

async function protectPage(requiredRole) {
  try {
    const session = await api.getSession();
    if (!session.authenticated || session.user.role !== requiredRole) {
      redirectTo('login.html');
      return null;
    }
    return session.user;
  } catch (error) {
    redirectTo('login.html');
    return null;
  }
}

function updateLoginUI(role) {
  const pageTitle = document.getElementById('pageTitle');
  const pageDescription = document.getElementById('pageDescription');
  const loginHint = document.getElementById('loginHint');
  const authContent = document.querySelector('.auth-content');
  const visualRoleBadge = document.getElementById('visualRoleBadge');
  const visualTitle = document.getElementById('visualCardTitle');
  const visualSubtitle = document.getElementById('visualCardSubtitle');
  const roleButtons = document.querySelectorAll('.role-button');
  const hiddenRoleInput = document.getElementById('role');

  pageTitle.textContent = role === 'dono' ? 'Login do Dono' : 'Login do Cliente';
  pageDescription.textContent = role === 'dono'
    ? 'Acesse o painel do dono e gerencie o cardápio e os pedidos.'
    : 'Acesse o dashboard do cliente para fazer pedidos e ver histórico.';
  loginHint.textContent = role === 'dono'
    ? 'Use dono@pizzaria.com / donopizza ou registre seu próprio e-mail caso não exista um dono.'
    : 'Use seu próprio e-mail para se cadastrar e fazer login como cliente.';

  if (authContent) {
    authContent.classList.toggle('role-dono', role === 'dono');
    authContent.classList.toggle('role-cliente', role === 'cliente');
  }

  roleButtons.forEach((button) => {
    const isActive = button.dataset.role === role;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', isActive.toString());
  });

  if (hiddenRoleInput) {
    hiddenRoleInput.value = role;
  }

  if (visualRoleBadge) {
    visualRoleBadge.textContent = role === 'dono' ? 'Dono' : 'Cliente';
  }

  if (visualTitle && visualSubtitle) {
    if (role === 'dono') {
      visualTitle.textContent = 'Painel do dono pronto para gerenciar';
      visualSubtitle.textContent = 'Use a plataforma para editar cardápio, visualizar pedidos e ações estratégicas.';
    } else {
      visualTitle.textContent = 'Faça pedidos com agilidade';
      visualSubtitle.textContent = 'Encontre sua pizza, use ofertas exclusivas e realize pedidos sem complicação.';
    }
  }
}

async function setupLoginPage() {
  try {
    const session = await api.getSession();
    if (session.authenticated) {
      redirectTo(session.user.role === 'dono' ? 'admin.html' : 'dashboard.html');
      return;
    }
  } catch (error) {
    // continuar na página de login
  }

  const urlParams = new URLSearchParams(window.location.search);
  const roleParam = urlParams.get('role') || 'cliente';
  const roleButtons = document.querySelectorAll('.role-button');
  const roleInput = document.getElementById('role');

  roleButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const selectedRole = button.dataset.role;
      if (roleInput) {
        roleInput.value = selectedRole;
      }
      updateLoginUI(selectedRole);
    });
  });

  if (roleInput) {
    roleInput.value = roleParam;
  }
  updateLoginUI(roleParam);

  const form = document.getElementById('loginForm');
  const message = document.getElementById('loginMessage');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.textContent = '';

    const email = form.email.value.trim().toLowerCase();
    const password = form.password.value.trim();
    const role = form.role.value || document.getElementById('role')?.value;

    try {
      const result = await api.login(email, password, role);
      redirectTo(result.user.role === 'dono' ? 'admin.html' : 'dashboard.html');
    } catch (error) {
      message.textContent = error.message;
    }
  });
}

async function setupRegisterPage() {
  const form = document.getElementById('registerForm');
  const message = document.getElementById('registerMessage');
  const roleInputs = document.querySelectorAll('input[name="role"]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.textContent = '';

    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim().toLowerCase();
    const password = document.getElementById('password').value.trim();
    const role = Array.from(roleInputs).find((input) => input.checked)?.value || 'cliente';

    try {
      await api.register(name, email, password, role);
      message.style.color = '#1c7c54';
      message.textContent = 'Cadastro realizado com sucesso! Redirecionando para login...';
      setTimeout(() => redirectTo('login.html'), 1800);
    } catch (error) {
      message.style.color = '#d93735';
      message.textContent = error.message;
    }
  });
}

async function setupDashboardPage() {
  const session = await protectPage('cliente');
  if (!session) return;

  document.getElementById('userName').textContent = session.name;
  document.getElementById('logoutButton').addEventListener('click', logout);

  const menuGrid = document.getElementById('menuGrid');
  const cartArea = document.getElementById('cartArea');
  const historyArea = document.getElementById('historyArea');
  const message = document.getElementById('pageMessage');

  let cart = [];

  function renderCart() {
    if (cart.length === 0) {
      cartArea.innerHTML = '<p>Adicione itens do cardápio para ver aqui.</p>';
      return;
    }

    cartArea.innerHTML = cart
      .map((item) => {
        return `
          <div class="cart-item">
            <div>
              <strong>${item.name}</strong>
              <p>${item.quantity} x ${formatPrice(item.price)}</p>
            </div>
            <input id="Endereço" type="text" placeholder="Coloque seu endereço:" required>
            <button data-remove="${item.id}">Remover</button>
          </div>
        `;
      })
      .join('') + `
      <div style="margin-top:1rem; display:flex; justify-content:space-between; align-items:center; gap:1rem; flex-wrap:wrap;">
        <strong>Total: ${formatPrice(cart.reduce((sum, item) => sum + item.price * item.quantity, 0))}</strong>
        <button class="button" id="checkoutButton">Finalizar pedido</button>
      </div>
    `;

    cartArea.querySelectorAll('[data-remove]').forEach((button) => {
      button.addEventListener('click', () => {
        cart = cart.filter((item) => item.id !== Number(button.dataset.remove));
        renderCart();
      });
    });

    document.getElementById('checkoutButton').addEventListener('click', async () => {
      try {
        await api.checkout(cart);
        cart = [];
        renderCart();
        await renderHistory();
        message.style.color = '#1c7c54';
        message.textContent = 'Pedido realizado com sucesso!';
      } catch (error) {
        message.style.color = '#d93735';
        message.textContent = error.message;
      }
    });
  }

  async function renderHistory() {
    try {
      const result = await api.getOrders();
      const orders = result.orders;
      if (!orders || orders.length === 0) {
        historyArea.innerHTML = '<p>Você ainda não realizou pedidos.</p>';
        return;
      }
      historyArea.innerHTML = orders
        .map((order) => {
          return `
            <div class="order-item">
              <div>
                <strong>Pedido ${order.id}</strong>
                <p>${order.date}</p>
              </div>
              <span>${formatPrice(order.total)}</span>
            </div>
          `;
        })
        .join('');
    } catch (error) {
      historyArea.innerHTML = '<p>Erro ao carregar histórico.</p>';
    }
  }

  try {
    const menuResult = await api.getMenu();
    menuGrid.innerHTML = menuResult.menu
      .map((item) => {
        const imageBlock = item.image_url
          ? `<div class="card-image"><img src="${item.image_url}" alt="${item.name}" /></div>`
          : '';
        return `
          <article class="card">
            ${imageBlock}
            <h3>${item.name}</h3>
            <p>${item.description}</p>
            <div class="card-footer">
              <span>${formatPrice(item.price)}</span>
              <button class="button button-secondary" data-add="${item.id}">Adicionar</button>
            </div>
          </article>
        `;
      })
      .join('');

    menuGrid.querySelectorAll('[data-add]').forEach((button) => {
      button.addEventListener('click', () => {
        const itemId = Number(button.dataset.add);
        const item = menuResult.menu.find((entry) => entry.id === itemId);
        if (!item) return;
        const existing = cart.find((entry) => entry.id === itemId);
        if (existing) {
          existing.quantity += 1;
        } else {
          cart.push({ ...item, quantity: 1 });
        }
        renderCart();
      });
    });

    renderCart();
    await renderHistory();
  } catch (error) {
    menuGrid.innerHTML = '<p>Erro ao carregar cardápio.</p>';
  }
}

async function setupAdminPage() {
  const session = await protectPage('dono');
  if (!session) return;

  document.getElementById('logoutButton').addEventListener('click', logout);
  const menuCards = document.getElementById('menuCards');
  const menuCount = document.getElementById('menuCount');
  const totalOrders = document.getElementById('totalOrders');
  const totalRevenue = document.getElementById('totalRevenue');
  const recentOrders = document.getElementById('recentOrders');
  const addItemForm = document.getElementById('addItemForm');
  const editItemIdInput = document.getElementById('editItemId');
  const currentImageUrlInput = document.getElementById('currentImageUrl');
  const itemFormTitle = document.getElementById('itemFormTitle');
  const submitItemButton = document.getElementById('submitItemButton');
  const cancelEditButton = document.getElementById('cancelEditButton');
  const imageDropzone = document.getElementById('imageDropzone');
  const itemImageInput = document.getElementById('itemImage');
  const imagePreview = document.getElementById('imagePreview');
  const imagePreviewImg = imagePreview.querySelector('img');
  const clearImageButton = document.getElementById('clearImageButton');
  const uploadImageMessage = document.getElementById('uploadImageMessage');
  const message = document.getElementById('pageMessage');
  let selectedImageFile = null;

  function updateImagePreview(file) {
    if (!file) {
      imagePreview.classList.add('hidden');
      uploadImageMessage.textContent = '';
      selectedImageFile = null;
      return;
    }

    selectedImageFile = file;
    const previewURL = URL.createObjectURL(file);
    imagePreviewImg.src = previewURL;
    imagePreviewImg.alt = `Prévia de ${file.name}`;
    imagePreview.classList.remove('hidden');
    uploadImageMessage.textContent = `Imagem pronta: ${file.name} (${Math.round(file.size / 1024)} KB)`;
  }

  function clearImageSelection() {
    itemImageInput.value = '';
    updateImagePreview(null);
  }

  function handleImageFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      uploadImageMessage.textContent = 'Por favor selecione um arquivo de imagem válido.';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      uploadImageMessage.textContent = 'A imagem deve ter no máximo 10 MB.';
      return;
    }
    updateImagePreview(file);
  }

  function enterEditMode(item) {
    editItemIdInput.value = item.id;
    currentImageUrlInput.value = item.image_url || '';
    document.getElementById('itemName').value = item.name;
    document.getElementById('itemDescription').value = item.description;
    document.getElementById('itemPrice').value = item.price;
    selectedImageFile = null;
    if (item.image_url) {
      imagePreviewImg.src = item.image_url;
      imagePreviewImg.alt = `Prévia de ${item.name}`;
      imagePreview.classList.remove('hidden');
      uploadImageMessage.textContent = 'Imagem atual do produto.';
    } else {
      imagePreview.classList.add('hidden');
      uploadImageMessage.textContent = '';
    }
    itemFormTitle.textContent = 'Editar item';
    submitItemButton.textContent = 'Salvar alterações';
    cancelEditButton.classList.remove('hidden');

    const formSection = document.getElementById('itemName');
    if (formSection) {
      formSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      formSection.focus();
    }
  }

  function resetItemForm() {
    editItemIdInput.value = '';
    currentImageUrlInput.value = '';
    addItemForm.reset();
    selectedImageFile = null;
    imagePreview.classList.add('hidden');
    uploadImageMessage.textContent = '';
    itemFormTitle.textContent = 'Adicionar novo item';
    submitItemButton.textContent = 'Adicionar';
    cancelEditButton.classList.add('hidden');
  }

  imageDropzone.addEventListener('click', () => itemImageInput.click());
  imageDropzone.addEventListener('dragover', (event) => {
    event.preventDefault();
    imageDropzone.classList.add('dragover');
  });
  imageDropzone.addEventListener('dragleave', () => {
    imageDropzone.classList.remove('dragover');
  });
  imageDropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    imageDropzone.classList.remove('dragover');
    const file = event.dataTransfer.files[0];
    handleImageFile(file);
  });

  itemImageInput.addEventListener('change', () => {
    handleImageFile(itemImageInput.files[0]);
  });

  clearImageButton.addEventListener('click', clearImageSelection);

  cancelEditButton.addEventListener('click', resetItemForm);

  async function loadAdminData() {
    try {
      const [menuResult, ordersResult, statsResult] = await Promise.all([
        api.getMenu(),
        api.getOrders(),
        api.getStats()
      ]);

      menuCards.innerHTML = menuResult.menu
        .map((item) => {
          const thumb = item.image_url
            ? `<div class="menu-item-thumb"><img src="${item.image_url}" alt="${item.name}" /></div>`
            : `<div class="menu-item-thumb menu-item-thumb-empty">Sem imagem</div>`;
          return `
            <article class="menu-item-card">
              ${thumb}
              <div class="menu-item-details">
                <div>
                  <strong>${item.name}</strong>
                  <p>${item.description}</p>
                </div>
                <div class="menu-item-meta">
                  <span>${formatPrice(item.price)}</span>
                  <div class="menu-item-actions">
                    <button type="button" class="button button-secondary" data-edit="${item.id}">Editar</button>
                    <button type="button" class="button button-secondary" data-delete="${item.id}">Excluir</button>
                  </div>
                </div>
              </div>
            </article>
          `;
        })
        .join('');

      menuCards.querySelectorAll('[data-edit]').forEach((button) => {
        button.addEventListener('click', () => {
          const itemId = Number(button.dataset.edit);
          const item = menuResult.menu.find((entry) => entry.id === itemId);
          if (!item) return;
          enterEditMode(item);
        });
      });

      menuCards.querySelectorAll('[data-delete]').forEach((button) => {
        button.addEventListener('click', async () => {
          try {
            await api.deleteMenuItem(Number(button.dataset.delete));
            await loadAdminData();
          } catch (error) {
            message.style.color = '#d93735';
            message.textContent = error.message;
          }
        });
      });

      menuCount.textContent = statsResult.menuCount;
      totalOrders.textContent = statsResult.totalOrders;
      totalRevenue.textContent = formatPrice(statsResult.totalRevenue);

      if (!ordersResult.orders || ordersResult.orders.length === 0) {
        recentOrders.innerHTML = '<p>Não há pedidos registrados ainda.</p>';
      } else {
        recentOrders.innerHTML = ordersResult.orders
          .slice(0, 5)
          .map((order) => {
            return `
              <div class="order-item">
                <div>
                  <strong>Pedido ${order.id}</strong>
                  <p>${order.date}</p>
                </div>
                <span>${formatPrice(order.total)}</span>
              </div>
            `;
          })
          .join('');
      }
    } catch (error) {
      menuCards.innerHTML = '<p>Erro ao carregar cardápio.</p>';
      recentOrders.innerHTML = '<p>Falha ao carregar pedidos.</p>';
    }
  }

  addItemForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.textContent = '';

    const name = document.getElementById('itemName').value.trim();
    const description = document.getElementById('itemDescription').value.trim();
    const price = Number(document.getElementById('itemPrice').value);
    const editItemId = editItemIdInput.value;
    const currentImageUrl = currentImageUrlInput.value;

    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('description', description);
      formData.append('price', String(price));
      formData.append('currentImageUrl', currentImageUrl);
      if (selectedImageFile) {
        formData.append('image', selectedImageFile, selectedImageFile.name);
      }

      const method = editItemId ? 'PUT' : 'POST';
      const url = editItemId ? `/api/menu/${editItemId}` : '/api/menu';

      const response = await fetch(url, {
        method,
        credentials: 'same-origin',
        body: formData
      });
      await handleResponse(response);

      resetItemForm();
      await loadAdminData();
    } catch (error) {
      message.style.color = '#d93735';
      message.textContent = error.message;
    }
  });

  await loadAdminData();
}

async function logout() {
  try {
    await api.logout();
  } catch (error) {
    console.warn('Logout falhou:', error.message);
  }
  redirectTo('login.html');
}

const page = window.location.pathname.split('/').pop();
if (page === 'login.html') {
  setupLoginPage();
}
async function setupIndexPage() {
  const menuHighlights = document.getElementById('menuHighlights');
  if (!menuHighlights) return;

  try {
    const menuResult = await api.getMenu();
    if (!menuResult.menu || menuResult.menu.length === 0) {
      menuHighlights.innerHTML = '<p>Não há itens no cardápio no momento.</p>';
      return;
    }

    menuHighlights.innerHTML = menuResult.menu
      .map((item) => {
        const imageBlock = item.image_url
          ? `<div class="card-image"><img src="${item.image_url}" alt="${item.name}" /></div>`
          : '';
        return `
          <article class="card">
            ${imageBlock}
            <h3>${item.name}</h3>
            <p>${item.description}</p>
            <span>${formatPrice(item.price)}</span>
          </article>
        `;
      })
      .join('');
  } catch (error) {
    menuHighlights.innerHTML = '<p>Erro ao carregar cardápio.</p>';
  }
}

if (page === 'register.html') {
  setupRegisterPage();
}
if (page === 'dashboard.html') {
  setupDashboardPage();
}
if (page === 'admin.html') {
  setupAdminPage();
}
if (page === 'index.html' || page === '') {
  setupIndexPage();
}
