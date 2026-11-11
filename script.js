/* ==========================================
   EARTHLY TERRACOTTA POS — MAIN LOGIC
   ========================================== */

const defaultProducts = [
    { id: 1, name: 'Basmati Rice', sku: 'BEV-001', category: 'Coffee & Drinks', description: 'Premium long grain aromatic rice.', price: 68.00, stock: 120, image: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=150' },
    { id: 2, name: 'Whole Wheat Bread', sku: 'BAK-001', category: 'Bakery', description: 'Freshly baked whole grain sliced bread.', price: 52.00, stock: 85, image: 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=150' },
    { id: 3, name: 'Soft Drink', sku: 'BEV-002', category: 'Coffee & Drinks', description: 'Refreshing carbonated beverage.', price: 110.00, stock: 60, image: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=150' },
    { id: 4, name: 'Face Wash', sku: 'MER-001', category: 'Merchandise', description: 'Gentle exfoliating facial cleanser.', price: 220.00, stock: 40, image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=150' }
];

const defaultCategories = ['Coffee & Drinks', 'Bakery', 'Merchandise', 'Combos & Meals'];

const defaultCustomers = [
    { id: 1, name: 'Aman Kumar', phone: '+880 1919402119', email: 'aman@example.com', visits: 12, points: 150 },
    { id: 2, name: 'Sarah Jenkins', phone: '+1 555-0192', email: 'sarah.j@example.com', visits: 5, points: 65 }
];

// ---------- State ----------
let products = JSON.parse(localStorage.getItem('pos_products')) || defaultProducts;
let categories = JSON.parse(localStorage.getItem('pos_categories')) || defaultCategories;
let customers = JSON.parse(localStorage.getItem('pos_customers')) || defaultCustomers;
let transactions = JSON.parse(localStorage.getItem('pos_transactions')) || [];

// ---------- Settings (with safe migration) ----------
const SETTINGS_VERSION = 3;

const defaultSettings = {
    storeName: 'Artisan Cafe & Market',
    currency: 'SAR',
    taxRate: 15,
    primaryColor: '#C2410C',
    logo: '',
    version: SETTINGS_VERSION
};

const rawStoredSettings = JSON.parse(localStorage.getItem('pos_settings')) || {};

if (!rawStoredSettings.version || rawStoredSettings.version < SETTINGS_VERSION) {
    if (Number(rawStoredSettings.taxRate) === 5) {
        rawStoredSettings.taxRate = 15;
    }
    rawStoredSettings.version = SETTINGS_VERSION;
    localStorage.setItem('pos_settings', JSON.stringify(rawStoredSettings));
}

let settings = { ...defaultSettings, ...rawStoredSettings };

let cart = [];
let selectedCategory = 'all';
let currentPaymentMethod = 'Cash';
let heldOrders = [];
let loyaltyDiscount = 0;
let redeemedPoints = 0;

let manualDiscount = { type: 'fixed', value: 0 };

let salesChartInstance = null;
let paymentChartInstance = null;

// ---------- Boot ----------
document.addEventListener('DOMContentLoaded', () => {
    initSplashScreen();
    initTheme();
    initClock();
    initNavigation();
    initSalesModule();
    initInventoryModule();
    initCategoryModule();
    initCustomerModule();
    initReportsModule();
    initHardwareModule();
    initSettingsModule();
});

/* ==========================================
   3D SPLASH SCREEN (Three.js — self-destructing)
   ========================================== */
function initSplashScreen() {
    const splash = document.getElementById('splashScreen');
    if (!splash) return;

    // Only show once per browser session
    if (sessionStorage.getItem('pos_splash_shown')) {
        splash.remove();
        return;
    }
    sessionStorage.setItem('pos_splash_shown', '1');

    // Fallback: if Three.js didn't load or WebGL isn't available, skip 3D
    const canvas = document.getElementById('splashCanvas');
    if (typeof THREE === 'undefined' || !canvas) {
        splash.remove();
        return;
    }
    const testCtx = document.createElement('canvas').getContext('webgl');
    if (!testCtx) {
        splash.remove();
        return;
    }

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.z = 3.2;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(200, 200);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Rotating torus knot in primary color
    const geometry = new THREE.TorusKnotGeometry(0.7, 0.25, 128, 16);
    const material = new THREE.MeshStandardMaterial({
        color: 0xC2410C,
        metalness: 0.4,
        roughness: 0.3
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const keyLight = new THREE.PointLight(0xffffff, 2.5);
    keyLight.position.set(4, 4, 4);
    scene.add(keyLight);
    const rimLight = new THREE.PointLight(0xEA580C, 1.5);
    rimLight.position.set(-4, -2, -2);
    scene.add(rimLight);

    let animating = true;
    function animate() {
        if (!animating) return;
        requestAnimationFrame(animate);
        mesh.rotation.x += 0.012;
        mesh.rotation.y += 0.018;
        renderer.render(scene, camera);
    }
    animate();

    // Fade out after 1.8s, then dispose WebGL and remove from DOM
    setTimeout(() => {
        splash.style.opacity = '0';
        setTimeout(() => {
            animating = false;
            renderer.dispose();
            geometry.dispose();
            material.dispose();
            splash.remove();
        }, 400);
    }, 1800);
}

/* ==========================================
   THEME
   ========================================== */
function initTheme() {
    const savedTheme = localStorage.getItem('pos_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeButton(savedTheme);

    document.getElementById('themeToggle').addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('pos_theme', next);
        updateThemeButton(next);
    });
}

function updateThemeButton(theme) {
    const icon = document.getElementById('themeIcon');
    const text = document.getElementById('themeText');
    if (theme === 'dark') {
        icon.className = 'fa-solid fa-sun';
        text.textContent = 'Light Mode';
    } else {
        icon.className = 'fa-solid fa-moon';
        text.textContent = 'Dark Mode';
    }
}

/* ==========================================
   CLOCK
   ========================================== */
function initClock() {
    const clockEl = document.getElementById('liveClock');
    const tick = () => { clockEl.textContent = new Date().toLocaleTimeString(); };
    tick();
    setInterval(tick, 1000);
}

/* ==========================================
   NAVIGATION
   ========================================== */
function initNavigation() {
    const navButtons = document.querySelectorAll('.nav-item');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const titleEl = document.getElementById('currentTabTitle');
    const subtitleEl = document.getElementById('currentTabSubtitle');

    const subtitles = {
        sales: 'Process transactions and manage cart',
        inventory: 'Manage stock levels, descriptions, photos and pricing',
        customers: 'Track customer profiles, loyalty tiers & points',
        reports: 'Analyze daily performance and sales history',
        hardware: 'Configure barcode scanners, printers and drawers',
        settings: 'Manage store preferences and payment gateways'
    };

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            navButtons.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(tabId).classList.add('active');

            titleEl.textContent = btn.textContent.trim();
            subtitleEl.textContent = subtitles[tabId];

            if (tabId === 'reports') renderReports();
        });
    });
}

/* ==========================================
   SALES & CHECKOUT
   ========================================== */
function initSalesModule() {
    renderCategoryFilters();
    renderProductCatalog();
    renderCustomerDropdown();

    document.getElementById('productSearch').addEventListener('input', (e) => {
        renderProductCatalog(e.target.value, selectedCategory);
    });

    document.getElementById('clearCartBtn').addEventListener('click', () => {
        cart = [];
        resetDiscounts();
        renderCart();
    });

    document.getElementById('cartCustomerSelect').addEventListener('change', () => {
        loyaltyDiscount = 0;
        redeemedPoints = 0;
        updateLoyaltyRedeemUI();
        renderCart();
    });

    document.getElementById('redeemPointsBtn').addEventListener('click', () => {
        const custId = document.getElementById('cartCustomerSelect').value;
        if (!custId) return;
        const c = customers.find(item => item.id == custId);
        if (!c) return;

        if (c.points >= 100) {
            redeemedPoints = 100;
            loyaltyDiscount = 5.00;
            alert(`Successfully redeemed 100 points for ${settings.currency}5.00 discount!`);
            updateLoyaltyRedeemUI();
            renderCart();
        } else {
            alert('Insufficient points! Customer needs at least 100 points to redeem rewards.');
        }
    });

    document.getElementById('applyManualDiscBtn').addEventListener('click', () => {
        const val = parseFloat(document.getElementById('manualDiscInput').value) || 0;
        const type = document.getElementById('manualDiscType').value;
        manualDiscount = { type, value: Math.max(0, val) };
        renderCart();
    });

    document.getElementById('checkoutBtn').addEventListener('click', () => {
        if (cart.length === 0) { alert('Cart is empty!'); return; }
        openCheckoutModal();
    });

    document.getElementById('holdOrderBtn').addEventListener('click', () => {
        if (cart.length === 0) return;
        heldOrders.push([...cart]);
        cart = [];
        resetDiscounts();
        renderCart();
        alert('Order placed on hold successfully.');
    });
}

function renderCategoryFilters() {
    const container = document.getElementById('categoryFilters');
    container.innerHTML = `<button class="cat-btn ${selectedCategory === 'all' ? 'active' : ''}" data-cat="all">All Items</button>`;

    categories.forEach(cat => {
        container.innerHTML += `<button class="cat-btn ${selectedCategory === cat ? 'active' : ''}" data-cat="${cat}">${cat}</button>`;
    });

    container.querySelectorAll('.cat-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            container.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            selectedCategory = e.target.getAttribute('data-cat');
            renderProductCatalog(document.getElementById('productSearch').value, selectedCategory);
        });
    });
}

function resetDiscounts() {
    loyaltyDiscount = 0;
    redeemedPoints = 0;
    manualDiscount = { type: 'fixed', value: 0 };
    const input = document.getElementById('manualDiscInput');
    if (input) input.value = '';
}

function getManualDiscountAmount(subtotal) {
    if (!manualDiscount.value) return 0;
    if (manualDiscount.type === 'percent') return subtotal * (manualDiscount.value / 100);
    return Math.min(manualDiscount.value, subtotal);
}

function updateLoyaltyRedeemUI() {
    const custId = document.getElementById('cartCustomerSelect').value;
    const redeemBox = document.getElementById('loyaltyRedeemBox');
    const pointsText = document.getElementById('customerLoyaltyPointsText');
    const redeemBtn = document.getElementById('redeemPointsBtn');

    const manualOpt = document.getElementById('manualDiscCurrencyOpt');
    if (manualOpt) manualOpt.textContent = settings.currency;

    if (!custId) {
        redeemBox.style.display = 'none';
        return;
    }

    const c = customers.find(item => item.id == custId);
    if (!c) { redeemBox.style.display = 'none'; return; }

    redeemBox.style.display = 'flex';
    pointsText.textContent = `${c.points} pts available`;

    if (redeemedPoints > 0) {
        redeemBtn.textContent = `Redeemed (${redeemedPoints} pts)`;
        redeemBtn.disabled = true;
        redeemBtn.style.opacity = '0.6';
    } else {
        redeemBtn.textContent = `Redeem 100 pts (${settings.currency}5 Off)`;
        redeemBtn.disabled = false;
        redeemBtn.style.opacity = '1';
    }
}

function renderProductCatalog(search = '', category = 'all') {
    const grid = document.getElementById('posProductGrid');
    grid.innerHTML = '';

    const filtered = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
            || p.sku.toLowerCase().includes(search.toLowerCase())
            || (p.description && p.description.toLowerCase().includes(search.toLowerCase()));
        const matchesCat = category === 'all' || p.category === category;
        return matchesSearch && matchesCat;
    });

    if (filtered.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">No products found</p>';
        return;
    }

    filtered.forEach(p => {
        const card = document.createElement('div');
        card.className = 'product-card';

        const imgHtml = p.image
            ? `<div class="product-card-img"><img src="${p.image}" alt="${p.name}" onerror="this.parentElement.innerHTML='<i class=\\'fa-solid fa-box\\'></i>'"></div>`
            : `<div class="product-card-img-placeholder"><i class="fa-solid fa-box"></i></div>`;

        let priceText = `${settings.currency}${p.price.toFixed(2)}`;
        if (p.sizes && p.sizes.length > 0) {
            const minPrice = Math.min(...p.sizes.map(s => s.price));
            priceText = `From ${settings.currency}${minPrice.toFixed(2)}`;
        }

        card.innerHTML = `
            ${imgHtml}
            <div>
                <div class="product-card-title">${p.name}</div>
                ${p.description ? `<div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.2rem; display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${p.description}</div>` : ''}
                ${p.sizes && p.sizes.length > 0 ? `<div style="font-size:0.7rem; color:var(--primary); margin-top:0.2rem; font-weight:600;"><i class="fa-solid fa-layer-group"></i> ${p.sizes.length} sizes</div>` : ''}
            </div>
            <div class="product-card-footer">
                <span class="product-card-price">${priceText}</span>
                <span class="product-card-stock">Stock: ${p.stock}</span>
            </div>
        `;
        card.addEventListener('click', () => addToCart(p));
        grid.appendChild(card);
    });
}

function addToCart(product) {
    if (product.sizes && product.sizes.length > 0) {
        openSizeModal(product);
        return;
    }
    const existing = cart.find(item => item.id === product.id && !item.selectedSize);
    if (existing) {
        if (existing.qty < product.stock) existing.qty++;
        else alert('Not enough stock available!');
    } else {
        if (product.stock > 0) cart.push({ ...product, qty: 1 });
        else alert('Product is out of stock!');
    }
    renderCart();
}

function openSizeModal(product) {
    document.getElementById('sizeModalTitle').textContent = product.name;
    const container = document.getElementById('sizeOptionsContainer');
    container.innerHTML = '';
    product.sizes.forEach(size => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-secondary';
        btn.style.cssText = 'display: flex; justify-content: space-between; width: 100%; padding: 0.85rem 1rem; font-size: 0.95rem;';
        btn.innerHTML = `<span><strong>${size.label}</strong></span><span style="color: var(--primary); font-weight: 700;">${settings.currency}${size.price.toFixed(2)}</span>`;
        btn.addEventListener('click', () => {
            addToCartWithSize(product, size);
            closeModal('sizeModal');
        });
        container.appendChild(btn);
    });
    openModal('sizeModal');
}

function addToCartWithSize(product, size) {
    const existing = cart.find(item => item.id === product.id && item.selectedSize === size.label);
    if (existing) {
        if (existing.qty < product.stock) existing.qty++;
        else alert('Not enough stock available!');
    } else {
        if (product.stock > 0) {
            cart.push({ ...product, qty: 1, selectedSize: size.label, price: size.price });
        } else {
            alert('Product is out of stock!');
        }
    }
    renderCart();
}

function renderCart() {
    const list = document.getElementById('cartItemsList');
    list.innerHTML = '';

    if (cart.length === 0) {
        list.innerHTML = `
            <div class="empty-cart">
                <i class="fa-solid fa-basket-shopping"></i>
                <p>Your cart is empty</p>
                <span>Click products to add</span>
            </div>
        `;
        updateCartSummary();
        return;
    }

    cart.forEach((item, index) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'cart-item';
        const sizeTag = item.selectedSize
            ? ` <span style="color: var(--primary); font-weight: 600; font-size: 0.85rem;">(${item.selectedSize})</span>`
            : '';
        itemEl.innerHTML = `
            <div class="cart-item-info">
                <span>${item.name}${sizeTag}</span>
                <span>${settings.currency}${(item.price * item.qty).toFixed(2)}</span>
            </div>
            <div class="cart-item-controls">
                <span style="font-size: 0.8rem; color: var(--text-muted);">${settings.currency}${item.price.toFixed(2)} each</span>
                <div class="qty-controls">
                    <button class="qty-btn" onclick="updateQty(${index}, -1)">-</button>
                    <span>${item.qty}</span>
                    <button class="qty-btn" onclick="updateQty(${index}, 1)">+</button>
                    <button class="btn-text" onclick="removeFromCart(${index})" style="margin-left: 0.5rem;"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
        list.appendChild(itemEl);
    });

    updateCartSummary();
}

window.updateQty = function(index, delta) {
    if (!cart[index]) return;
    cart[index].qty += delta;
    if (cart[index].qty <= 0) cart.splice(index, 1);
    renderCart();
};

window.removeFromCart = function(index) {
    cart.splice(index, 1);
    renderCart();
};

// ---------- Totals (with round-up) ----------
function getCartTotals() {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const tax = subtotal * (settings.taxRate / 100);
    const totalDiscount = loyaltyDiscount + getManualDiscountAmount(subtotal);

    let rawTotal = subtotal + tax - totalDiscount;
    if (rawTotal < 0) rawTotal = 0;

    // Round UP to next whole number (no small coin/change available)
    const roundedTotal = Math.ceil(rawTotal);
    const roundOff = roundedTotal - rawTotal;

    return { subtotal, tax, totalDiscount, rawTotal, roundedTotal, roundOff };
}

function updateCartSummary() {
    const { subtotal, tax, totalDiscount, roundedTotal, roundOff } = getCartTotals();

    document.getElementById('cartTaxLabel').textContent = `VAT (${settings.taxRate}%)`;
    document.getElementById('cartSubtotal').textContent = `${settings.currency}${subtotal.toFixed(2)}`;
    document.getElementById('cartTax').textContent = `${settings.currency}${tax.toFixed(2)}`;

    const discRow = document.getElementById('discountRow');
    if (totalDiscount > 0) {
        discRow.style.display = 'flex';
        document.getElementById('cartDiscount').textContent = `-${settings.currency}${totalDiscount.toFixed(2)}`;
    } else {
        discRow.style.display = 'none';
    }

    const roundRow = document.getElementById('roundOffRow');
    if (roundRow) {
        if (roundOff > 0.0001) {
            roundRow.style.display = 'flex';
            document.getElementById('cartRoundOff').textContent = `+${settings.currency}${roundOff.toFixed(2)}`;
        } else {
            roundRow.style.display = 'none';
        }
    }

    document.getElementById('cartTotal').textContent = `${settings.currency}${roundedTotal.toFixed(2)}`;
}

function renderCustomerDropdown() {
    const select = document.getElementById('cartCustomerSelect');
    select.innerHTML = '<option value="">Walk-in Customer (Guest)</option>';
    customers.forEach(c => {
        select.innerHTML += `<option value="${c.id}">${c.name} (${c.phone}) - ${c.points} pts</option>`;
    });
}

/* ==========================================
   CATEGORY MANAGEMENT
   ========================================== */
function initCategoryModule() {
    document.getElementById('openManageCategoriesModal').addEventListener('click', () => {
        renderCategoryManagementList();
        openModal('categoriesModal');
    });

    document.getElementById('addNewCategoryBtn').addEventListener('click', () => {
        const input = document.getElementById('newCategoryInput');
        const catName = input.value.trim();
        if (!catName) return;
        if (categories.includes(catName)) { alert('Category already exists!'); return; }

        categories.push(catName);
        saveToLocalStorage();
        input.value = '';
        renderCategoryManagementList();
        renderCategoryDropdowns();
        renderCategoryFilters();
    });

    document.getElementById('editCategoryForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const oldName = document.getElementById('oldCategoryName').value;
        const newName = document.getElementById('updatedCategoryNameInput').value.trim();
        if (!newName) return;
        if (categories.includes(newName) && oldName !== newName) { alert('Category name already exists!'); return; }

        const idx = categories.indexOf(oldName);
        if (idx !== -1) categories[idx] = newName;
        products.forEach(p => { if (p.category === oldName) p.category = newName; });

        saveToLocalStorage();
        renderCategoryManagementList();
        renderCategoryDropdowns();
        renderCategoryFilters();
        renderInventoryTable();
        closeModal('editCategoryModal');
    });
}

function renderCategoryDropdowns() {
    const select = document.getElementById('prodCategory');
    if (!select) return;
    select.innerHTML = '';
    categories.forEach(cat => {
        select.innerHTML += `<option value="${cat}">${cat}</option>`;
    });
}

function renderCategoryManagementList() {
    const container = document.getElementById('categoryListContainer');
    container.innerHTML = '';

    categories.forEach(cat => {
        const item = document.createElement('div');
        item.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.75rem; background: var(--bg-main); border: 1px solid var(--border-color); border-radius: 6px;';
        item.innerHTML = `
            <span><strong>${cat}</strong></span>
            <div>
                <button class="btn-text" title="Edit Category" onclick="openEditCategoryModal('${cat.replace(/'/g, "\\'")}')"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-text" title="Delete Category" onclick="deleteCategory('${cat.replace(/'/g, "\\'")}')" style="color: var(--danger); margin-left: 0.75rem;"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        container.appendChild(item);
    });
}

window.openEditCategoryModal = function(catName) {
    document.getElementById('oldCategoryName').value = catName;
    document.getElementById('updatedCategoryNameInput').value = catName;
    openModal('editCategoryModal');
};

window.deleteCategory = function(catName) {
    if (categories.length <= 1) { alert('You must have at least one category.'); return; }
    if (!confirm(`Are you sure you want to delete category "${catName}"?`)) return;

    const fallbackCat = categories.find(c => c !== catName);
    products.forEach(p => { if (p.category === catName) p.category = fallbackCat; });

    categories = categories.filter(c => c !== catName);
    saveToLocalStorage();
    renderCategoryManagementList();
    renderCategoryDropdowns();
    renderCategoryFilters();
    renderInventoryTable();
};

/* ==========================================
   INVENTORY
   ========================================== */
function initInventoryModule() {
    renderInventoryTable();
    renderCategoryDropdowns();

    document.getElementById('invSearch').addEventListener('input', (e) => {
        renderInventoryTable(e.target.value);
    });

    document.getElementById('openAddProductModal').addEventListener('click', () => {
        document.getElementById('productModalTitle').textContent = 'Add New Product';
        document.getElementById('productForm').reset();
        document.getElementById('editProductId').value = '';
        document.getElementById('sizePricingSection').style.display = 'none';
        renderCategoryDropdowns();
        openModal('productModal');
    });

    document.getElementById('prodImageFile').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => { document.getElementById('prodImage').value = ev.target.result; };
        reader.readAsDataURL(file);
    });

    document.getElementById('prodHasSizes').addEventListener('change', (e) => {
        document.getElementById('sizePricingSection').style.display = e.target.checked ? 'block' : 'none';
    });

    document.getElementById('productForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('editProductId').value;
        const name = document.getElementById('prodName').value.trim();
        const sku = document.getElementById('prodSku').value.trim();
        const category = document.getElementById('prodCategory').value;
        const description = document.getElementById('prodDescription').value.trim();
        const price = parseFloat(document.getElementById('prodPrice').value);
        const stock = parseInt(document.getElementById('prodStock').value, 10);
        const image = document.getElementById('prodImage').value.trim();

        const hasSizes = document.getElementById('prodHasSizes').checked;
        let sizes = [];
        if (hasSizes) {
            const small = parseFloat(document.getElementById('prodSmallPrice').value) || 0;
            const medium = parseFloat(document.getElementById('prodMediumPrice').value) || 0;
            const large = parseFloat(document.getElementById('prodLargePrice').value) || 0;
            if (small <= 0 && medium <= 0 && large <= 0) {
                alert('Please set a price for at least one size.');
                return;
            }
            if (small > 0) sizes.push({ label: 'Small', price: small });
            if (medium > 0) sizes.push({ label: 'Medium', price: medium });
            if (large > 0) sizes.push({ label: 'Large', price: large });
        }

        if (id) {
            const p = products.find(item => item.id == id);
            if (p) {
                p.name = name; p.sku = sku; p.category = category;
                p.description = description; p.price = price; p.stock = stock;
                p.image = image;
                p.sizes = sizes;
            }
        } else {
            products.push({ id: Date.now(), name, sku, category, description, price, stock, image, sizes });
        }

        saveToLocalStorage();
        renderInventoryTable();
        renderProductCatalog();
        closeModal('productModal');
    });

    document.getElementById('stockForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const prodId = document.getElementById('stockProductId').value;
        const addQty = parseInt(document.getElementById('stockAddQty').value, 10) || 0;
        const p = products.find(item => item.id == prodId);
        if (!p) return;

        p.stock += addQty;
        saveToLocalStorage();
        renderInventoryTable();
        renderProductCatalog();
        closeModal('stockModal');
        alert(`Successfully added ${addQty} units to ${p.name}. New stock: ${p.stock}`);
    });
}

function renderInventoryTable(search = '') {
    const tbody = document.querySelector('#inventoryTable tbody');
    tbody.innerHTML = '';

    const filtered = products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase())
        || p.sku.toLowerCase().includes(search.toLowerCase())
        || (p.description && p.description.toLowerCase().includes(search.toLowerCase()))
    );

    filtered.forEach(p => {
        let statusBadge = '<span class="badge success">In Stock</span>';
        if (p.stock === 0) statusBadge = '<span class="badge danger">Out of Stock</span>';
        else if (p.stock < 10) statusBadge = '<span class="badge warning">Low Stock</span>';

        const thumbHtml = p.image
            ? `<div class="table-img"><img src="${p.image}" alt="" onerror="this.parentElement.innerHTML='<i class=\\'fa-solid fa-box\\'></i>'"></div>`
            : `<div class="table-img-placeholder"><i class="fa-solid fa-box"></i></div>`;

        let priceCell = `${settings.currency}${p.price.toFixed(2)}`;
        if (p.sizes && p.sizes.length > 0) {
            const minP = Math.min(...p.sizes.map(s => s.price));
            priceCell = `<span title="Base price" style="color: var(--text-muted); text-decoration: line-through; font-size: 0.75rem;">${settings.currency}${p.price.toFixed(2)}</span><br><strong>${settings.currency}${minP.toFixed(2)}+</strong>`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${thumbHtml}</td>
            <td><code>${p.sku}</code></td>
            <td>
                <strong>${p.name}</strong>
                ${p.sizes && p.sizes.length > 0 ? `<span class="badge success" style="margin-left: 0.5rem; font-size: 0.65rem;">${p.sizes.map(s => s.label).join(' / ')}</span>` : ''}
                <div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">${p.description ? p.description : '<span style="font-style:italic">No description/combo details</span>'}</div>
            </td>
            <td>${p.category}</td>
            <td>${priceCell}</td>
            <td>${p.stock}</td>
            <td>${statusBadge}</td>
            <td>
                <button class="btn-text" title="Add Stock" onclick="openAddStockModal(${p.id})"><i class="fa-solid fa-plus-circle" style="color: var(--success);"></i></button>
                <button class="btn-text" title="Edit Product" onclick="editProduct(${p.id})" style="margin-left: 0.5rem;"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-text" title="Delete Product" onclick="deleteProduct(${p.id})" style="color: var(--danger); margin-left: 0.5rem;"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.openAddStockModal = function(id) {
    const p = products.find(item => item.id === id);
    if (!p) return;
    document.getElementById('stockProductId').value = p.id;
    document.getElementById('stockProductName').value = p.name;
    document.getElementById('stockCurrentQty').value = p.stock;
    document.getElementById('stockAddQty').value = 10;
    openModal('stockModal');
};

window.editProduct = function(id) {
    const p = products.find(item => item.id === id);
    if (!p) return;
    renderCategoryDropdowns();
    document.getElementById('productModalTitle').textContent = 'Edit Product';
    document.getElementById('editProductId').value = p.id;
    document.getElementById('prodName').value = p.name;
    document.getElementById('prodSku').value = p.sku;
    document.getElementById('prodCategory').value = p.category;
    document.getElementById('prodDescription').value = p.description || '';
    document.getElementById('prodPrice').value = p.price;
    document.getElementById('prodStock').value = p.stock;
    document.getElementById('prodImage').value = p.image || '';
    document.getElementById('prodImageFile').value = '';

    const hasSizes = p.sizes && p.sizes.length > 0;
    document.getElementById('prodHasSizes').checked = hasSizes;
    document.getElementById('sizePricingSection').style.display = hasSizes ? 'block' : 'none';
    document.getElementById('prodSmallPrice').value = '';
    document.getElementById('prodMediumPrice').value = '';
    document.getElementById('prodLargePrice').value = '';
    if (hasSizes) {
        p.sizes.forEach(s => {
            if (s.label === 'Small')  document.getElementById('prodSmallPrice').value = s.price;
            if (s.label === 'Medium') document.getElementById('prodMediumPrice').value = s.price;
            if (s.label === 'Large')  document.getElementById('prodLargePrice').value = s.price;
        });
    }

    openModal('productModal');
};

window.deleteProduct = function(id) {
    if (!confirm('Are you sure you want to delete this product?')) return;
    products = products.filter(p => p.id !== id);
    saveToLocalStorage();
    renderInventoryTable();
    renderProductCatalog();
};

/* ==========================================
   CUSTOMERS & LOYALTY
   ========================================== */
function getCustomerTier(points) {
    if (points >= 250) return { name: 'VIP Gold', class: 'badge warning' };
    if (points >= 100) return { name: 'Silver Tier', class: 'badge success' };
    return { name: 'Bronze Member', class: 'badge' };
}

function initCustomerModule() {
    renderCustomerTable();

    document.getElementById('custSearch').addEventListener('input', (e) => {
        renderCustomerTable(e.target.value);
    });

    document.getElementById('openAddCustomerModal').addEventListener('click', () => {
        document.getElementById('customerForm').reset();
        openModal('customerModal');
    });

    document.getElementById('quickAddCustomerBtn').addEventListener('click', () => {
        document.getElementById('customerForm').reset();
        openModal('customerModal');
    });

    document.getElementById('customerForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('custName').value.trim();
        const phone = document.getElementById('custPhone').value.trim();
        const email = document.getElementById('custEmail').value.trim();

        customers.push({ id: Date.now(), name, phone, email, visits: 0, points: 0 });
        saveToLocalStorage();
        renderCustomerTable();
        renderCustomerDropdown();
        closeModal('customerModal');
    });

    document.getElementById('pointsForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const custId = document.getElementById('pointsCustId').value;
        const newPts = parseInt(document.getElementById('pointsNewValue').value, 10) || 0;
        const c = customers.find(item => item.id == custId);
        if (!c) return;

        c.points = newPts;
        saveToLocalStorage();
        renderCustomerTable();
        renderCustomerDropdown();
        closeModal('pointsModal');
        alert(`Successfully updated loyalty points for ${c.name} to ${c.points} pts.`);
    });
}

function renderCustomerTable(search = '') {
    const tbody = document.querySelector('#customersTable tbody');
    tbody.innerHTML = '';

    const filtered = customers.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
    );

    filtered.forEach(c => {
        const tier = getCustomerTier(c.points);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${c.name}</strong></td>
            <td>${c.phone}</td>
            <td>${c.email || '-'}</td>
            <td><span class="${tier.class}">${tier.name}</span></td>
            <td>${c.visits}</td>
            <td><strong>${c.points} pts</strong></td>
            <td>
                <button class="btn-text" title="Edit Points" onclick="openEditPointsModal(${c.id})"><i class="fa-solid fa-star" style="color: var(--warning);"></i></button>
                <button class="btn-text" title="Delete Customer" onclick="deleteCustomer(${c.id})" style="color: var(--danger); margin-left: 0.75rem;"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.openEditPointsModal = function(id) {
    const c = customers.find(item => item.id === id);
    if (!c) return;
    document.getElementById('pointsCustId').value = c.id;
    document.getElementById('pointsCustName').value = c.name;
    document.getElementById('pointsNewValue').value = c.points;
    openModal('pointsModal');
};

window.deleteCustomer = function(id) {
    if (!confirm('Delete customer record?')) return;
    customers = customers.filter(c => c.id !== id);
    saveToLocalStorage();
    renderCustomerTable();
    renderCustomerDropdown();
};

/* ==========================================
   CHECKOUT & PAYMENT
   ========================================== */
function openCheckoutModal() {
    const { roundedTotal } = getCartTotals();
    document.getElementById('modalDueAmount').textContent = `${settings.currency}${roundedTotal.toFixed(2)}`;
    document.getElementById('cashTenderedInput').value = roundedTotal.toFixed(2);
    document.getElementById('changeDueAmount').textContent = `${settings.currency}0.00`;

    document.querySelectorAll('.pay-method-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-method') === 'Cash');
    });
    currentPaymentMethod = 'Cash';
    document.getElementById('cashPaymentSection').style.display = 'flex';

    openModal('checkoutModal');
}

document.querySelectorAll('.pay-method-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.pay-method-btn').forEach(b => b.classList.remove('active'));
        const target = e.currentTarget;
        target.classList.add('active');
        currentPaymentMethod = target.getAttribute('data-method');
        document.getElementById('cashPaymentSection').style.display =
            currentPaymentMethod === 'Cash' ? 'flex' : 'none';
    });
});

document.getElementById('cashTenderedInput').addEventListener('input', (e) => {
    const { roundedTotal } = getCartTotals();
    const tendered = parseFloat(e.target.value) || 0;
    const change = tendered - roundedTotal;
    document.getElementById('changeDueAmount').textContent =
        `${settings.currency}${change >= 0 ? change.toFixed(2) : '0.00'}`;
});

document.getElementById('confirmPaymentBtn').addEventListener('click', () => {
    const { subtotal, tax, totalDiscount, roundedTotal, roundOff } = getCartTotals();

    cart.forEach(cartItem => {
        const p = products.find(prod => prod.id === cartItem.id);
        if (p) p.stock -= cartItem.qty;
    });

    const custId = document.getElementById('cartCustomerSelect').value;
    let custName = 'Walk-in';
    if (custId) {
        const c = customers.find(item => item.id == custId);
        if (c) {
            c.visits++;
            c.points = c.points - redeemedPoints + Math.floor(roundedTotal);
            custName = c.name;
        }
    }

    const tx = {
        invoiceNo: 'POS-' + Math.floor(1000 + Math.random() * 9000),
        time: new Date().toLocaleString(),
        customer: custName,
        items: [...cart],
        subtotal,
        tax,
        discount: totalDiscount,
        roundOff,
        total: roundedTotal,
        paymentMethod: currentPaymentMethod
    };

    transactions.unshift(tx);

    saveToLocalStorage();
    renderProductCatalog();
    renderInventoryTable();
    renderCustomerTable();
    renderCustomerDropdown();
    updateLoyaltyRedeemUI();

    cart = [];
    resetDiscounts();
    renderCart();
    closeModal('checkoutModal');

    printReceipt(tx);
});

/* ==========================================
   REPORTING
   ========================================== */
function initReportsModule() {
    document.getElementById('exportCsvBtn').addEventListener('click', exportTransactionsCSV);
}

function renderReports() {
    const todaySales = transactions.reduce((sum, tx) => sum + tx.total, 0);
    const itemsSold = transactions.reduce((sum, tx) => sum + tx.items.reduce((s, i) => s + i.qty, 0), 0);

    document.getElementById('reportTodaySales').textContent = `${settings.currency}${todaySales.toFixed(2)}`;
    document.getElementById('reportTxCount').textContent = transactions.length;
    document.getElementById('reportItemsSold').textContent = itemsSold;

    const tbody = document.querySelector('#transactionsTable tbody');
    tbody.innerHTML = '';
    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);">No transactions yet</td></tr>';
    } else {
        transactions.slice(0, 10).forEach(tx => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><code>${tx.invoiceNo}</code></td>
                <td>${tx.time}</td>
                <td>${tx.customer}</td>
                <td>${tx.items.reduce((s, i) => s + i.qty, 0)} items</td>
                <td><span class="badge success">${tx.paymentMethod}</span></td>
                <td><strong>${settings.currency}${tx.total.toFixed(2)}</strong></td>
                <td><button class="btn-text" onclick='printReceiptByInvoice("${tx.invoiceNo}")'><i class="fa-solid fa-print"></i></button></td>
            `;
            tbody.appendChild(tr);
        });
    }

    const productSalesMap = {};
    transactions.forEach(tx => {
        tx.items.forEach(item => {
            if (!productSalesMap[item.id]) productSalesMap[item.id] = { name: item.name, qty: 0, revenue: 0 };
            productSalesMap[item.id].qty += item.qty;
            productSalesMap[item.id].revenue += item.price * item.qty;
        });
    });
    const topSellingArr = Object.values(productSalesMap).sort((a, b) => b.qty - a.qty);
    const topTbody = document.querySelector('#topSellingTable tbody');
    topTbody.innerHTML = '';
    if (topSellingArr.length === 0) {
        topTbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);">No sales recorded yet</td></tr>';
    } else {
        topSellingArr.slice(0, 5).forEach(p => {
            topTbody.innerHTML += `
                <tr>
                    <td><strong>${p.name}</strong></td>
                    <td>${p.qty} units</td>
                    <td><strong>${settings.currency}${p.revenue.toFixed(2)}</strong></td>
                </tr>
            `;
        });
    }

    const lowStockTbody = document.querySelector('#lowStockReportTable tbody');
    lowStockTbody.innerHTML = '';
    const lowStockProducts = products.filter(p => p.stock < 15).sort((a, b) => a.stock - b.stock);
    if (lowStockProducts.length === 0) {
        lowStockTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);">All inventory levels are healthy!</td></tr>';
    } else {
        lowStockProducts.forEach(p => {
            const badge = p.stock === 0
                ? '<span class="badge danger">Out of Stock</span>'
                : '<span class="badge warning">Low Stock</span>';
            lowStockTbody.innerHTML += `
                <tr>
                    <td><strong>${p.name}</strong></td>
                    <td><code>${p.sku}</code></td>
                    <td>${p.stock}</td>
                    <td>${badge}</td>
                </tr>
            `;
        });
    }

    renderCharts();
}

function getLast7DaysSales() {
    const labels = [];
    const data = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 6; i >= 0; i--) {
        const day = new Date(today);
        day.setDate(day.getDate() - i);
        const dayEnd = new Date(day);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const dayTotal = transactions.reduce((sum, tx) => {
            const txDate = new Date(tx.time);
            return (txDate >= day && txDate < dayEnd) ? sum + tx.total : sum;
        }, 0);

        labels.push(day.toLocaleDateString('en', { weekday: 'short' }));
        data.push(dayTotal);
    }
    return { labels, data };
}

function renderCharts() {
    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#C2410C';
    const salesData = getLast7DaysSales();

    const ctx1 = document.getElementById('salesTrendChart').getContext('2d');
    if (salesChartInstance) salesChartInstance.destroy();

    salesChartInstance = new Chart(ctx1, {
        type: 'line',
        data: {
            labels: salesData.labels,
            datasets: [{
                label: 'Sales Revenue',
                data: salesData.data,
                borderColor: primaryColor,
                backgroundColor: 'rgba(194, 65, 12, 0.1)',
                fill: true,
                tension: 0.3
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    const ctx2 = document.getElementById('paymentMethodChart').getContext('2d');
    if (paymentChartInstance) paymentChartInstance.destroy();

    const cashCount = transactions.filter(t => t.paymentMethod === 'Cash').length;
    const cardCount = transactions.filter(t => t.paymentMethod === 'Card').length;
    const qrCount = transactions.filter(t => t.paymentMethod === 'QR Wallet').length;
    const hasData = cashCount + cardCount + qrCount > 0;

    paymentChartInstance = new Chart(ctx2, {
        type: 'doughnut',
        data: {
            labels: ['Cash', 'Card', 'QR Wallet'],
            datasets: [{
                data: hasData ? [cashCount, cardCount, qrCount] : [1, 0, 0],
                backgroundColor: ['#C2410C', '#65A30D', '#D97706']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function exportTransactionsCSV() {
    let csv = 'Invoice,Time,Customer,PaymentMethod,Total,RoundOff\n';
    transactions.forEach(t => {
        csv += `${t.invoiceNo},"${t.time}",${t.customer},${t.paymentMethod},${t.total.toFixed(2)},${(t.roundOff || 0).toFixed(2)}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pos_transactions_report.csv';
    a.click();
    window.URL.revokeObjectURL(url);
}

/* ==========================================
   HARDWARE
   ========================================== */
function initHardwareModule() {
    document.querySelectorAll('.test-hw-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const hw = e.target.getAttribute('data-hw');
            if (hw === 'scanner') alert('Barcode Scanner Test: Ready. Scan any product barcode.');
            if (hw === 'printer') {
                if (transactions.length > 0) printReceipt(transactions[0]);
                else alert('No transaction to print test receipt.');
            }
            if (hw === 'drawer') alert('Cash Drawer Kick Pulse sent successfully (RJ12 Connected).');
        });
    });
}

/* ==========================================
   SETTINGS & BRANDING
   ========================================== */
function adjustColorBrightness(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    let r = (num >> 16) + percent;
    let g = ((num >> 8) & 0x00FF) + percent;
    let b = (num & 0x0000FF) + percent;
    r = Math.min(255, Math.max(0, r));
    g = Math.min(255, Math.max(0, g));
    b = Math.min(255, Math.max(0, b));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function applyBrandingSettings() {
    if (settings.primaryColor) {
        document.documentElement.style.setProperty('--primary', settings.primaryColor);
        document.documentElement.style.setProperty('--primary-hover', adjustColorBrightness(settings.primaryColor, -20));
    }

    const setVal = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value;
    };
    setVal('storeNameInput', settings.storeName);
    setVal('currencyInput', settings.currency);
    setVal('taxRateInput', settings.taxRate);
    setVal('primaryColorInput', settings.primaryColor || '#C2410C');
    setVal('logoUrlInput', settings.logo || '');

    const brandIcon = document.getElementById('brandIcon');
    const brandLogoImg = document.getElementById('brandLogoImg');
    const brandTitleText = document.getElementById('brandTitleText');
    const receiptStoreName = document.getElementById('receiptStoreName');

    if (receiptStoreName) receiptStoreName.textContent = settings.storeName;
    if (brandTitleText) brandTitleText.textContent = settings.storeName;

    if (settings.logo) {
        brandLogoImg.src = settings.logo;
        brandLogoImg.style.display = 'block';
        if (brandIcon) brandIcon.style.display = 'none';
    } else {
        brandLogoImg.style.display = 'none';
        if (brandIcon) brandIcon.style.display = 'inline-block';
    }
}

function initSettingsModule() {
    applyBrandingSettings();

    const logoFileEl = document.getElementById('logoFile');
    if (logoFileEl) {
        logoFileEl.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => { document.getElementById('logoUrlInput').value = ev.target.result; };
            reader.readAsDataURL(file);
        });
    }

    document.getElementById('settingsForm').addEventListener('submit', (e) => {
        e.preventDefault();
        settings.storeName = document.getElementById('storeNameInput').value.trim() || 'My Store';
        settings.currency = document.getElementById('currencyInput').value;
        settings.taxRate = parseFloat(document.getElementById('taxRateInput').value) || 0;
        settings.primaryColor = document.getElementById('primaryColorInput').value;
        settings.logo = document.getElementById('logoUrlInput').value.trim();
        settings.version = SETTINGS_VERSION;

        saveToLocalStorage();
        applyBrandingSettings();
        renderProductCatalog(document.getElementById('productSearch').value, selectedCategory);
        renderCart();
        updateLoyaltyRedeemUI();
        alert('Settings, primary accent color, and store logo saved successfully!');
    });
}

/* ==========================================
   RECEIPT PRINTING
   ========================================== */
function printReceipt(tx) {
    document.getElementById('receiptStoreName').textContent = settings.storeName;
    document.getElementById('recInvoiceNo').textContent = tx.invoiceNo;
    document.getElementById('recDate').textContent = tx.time;
    document.getElementById('recCustomer').textContent = tx.customer;

    const tbody = document.getElementById('recItemsBody');
    tbody.innerHTML = '';

    const subtotal = tx.subtotal;
    const discount = tx.discount || 0;
    const taxableValue = Math.max(0, subtotal - discount);
    const tax = tx.tax;
    const grandTotal = taxableValue + tax;
    const roundOff = tx.roundOff || 0;
    const finalTotal = tx.total;

    tx.items.forEach(item => {
        const amt = item.price * item.qty;
        const itemName = item.selectedSize ? `${item.name} (${item.selectedSize})` : item.name;
        tbody.innerHTML += `
            <tr>
                <td colspan="4" style="padding-top: 3px; font-weight: bold;">${itemName}</td>
            </tr>
            <tr>
                <td style="color: #444; font-size: 9px; padding-left: 4px;">VAT: ${settings.taxRate}%</td>
                <td style="text-align: right;">${item.qty}</td>
                <td style="text-align: right;">${item.price.toFixed(2)}</td>
                <td style="text-align: right; font-weight: bold;">${amt.toFixed(2)}</td>
            </tr>
        `;
    });

    document.getElementById('recSubtotal').textContent = `${settings.currency}${subtotal.toFixed(2)}`;

    const recDiscRow = document.getElementById('recDiscountRow');
    if (discount > 0) {
        recDiscRow.style.display = 'flex';
        document.getElementById('recDiscount').textContent = `${settings.currency}${discount.toFixed(2)}`;
    } else {
        recDiscRow.style.display = 'none';
    }

    document.getElementById('recTaxableValue').textContent = `${settings.currency}${taxableValue.toFixed(2)}`;
    document.getElementById('recVatLabel').textContent = `VAT (${settings.taxRate}%)`;
    document.getElementById('recVatAmount').textContent = `${settings.currency}${tax.toFixed(2)}`;
    document.getElementById('recGrandTotal').textContent = `${settings.currency}${grandTotal.toFixed(2)}`;
    document.getElementById('recRoundOff').textContent = roundOff > 0.0001
        ? `+${settings.currency}${roundOff.toFixed(2)}`
        : '0.00';
    document.getElementById('recTotal').textContent = `${settings.currency}${finalTotal.toFixed(2)}`;

    window.print();
}

window.printReceiptByInvoice = function(invoiceNo) {
    const tx = transactions.find(t => t.invoiceNo === invoiceNo);
    if (tx) printReceipt(tx);
};

/* ==========================================
   MODAL HELPERS
   ========================================== */
function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
}

document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        if (modal) modal.classList.remove('active');
    });
});

document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
    });
});

/* ==========================================
   STORAGE
   ========================================== */
function saveToLocalStorage() {
    localStorage.setItem('pos_products', JSON.stringify(products));
    localStorage.setItem('pos_categories', JSON.stringify(categories));
    localStorage.setItem('pos_customers', JSON.stringify(customers));
    localStorage.setItem('pos_transactions', JSON.stringify(transactions));
    localStorage.setItem('pos_settings', JSON.stringify(settings));
}