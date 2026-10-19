const CONFIG = {
    supabaseUrl: 'https://ulpckwlazrnhxvjthlgh.supabase.co',
    supabasePublishableKey: 'sb_publishable_sxy7RSWC7Lo5ggQyPTvjRA_fH_xdsLJ',
    outletWhatsApp: '6285725489277'
};

const MENU_TABLE = 'menus';
const supabaseClient = window.supabase?.createClient(CONFIG.supabaseUrl, CONFIG.supabasePublishableKey);
const menuGrid = document.getElementById('menuGrid');
const categoryList = document.getElementById('categoryList');
const statusLabel = document.getElementById('connectionStatus');
const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
let menuItems = [];
let activeCategory = '';
let categoryCarousel = null;
let toastTimeout;
const cart = new Map();

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove('visible'), 3600);
}

function setConnection(message, state = '') {
    statusLabel.textContent = message;
    statusLabel.className = `connection ${state}`;
}

function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

function renderCategories() {
    const categories = [...new Set(menuItems.map(item => item.category).filter(Boolean))];
    const categoryOrder = [
        'Paket Promo',
        'Paket Catering',
        'Paket Segar',
        'Lainnya',
        'Chicken Produk',
        'Paket Bucket',
        'Ayam Utuh',
        'Paket Rocket',
        'Paket Sehat',
        'Paket Roma',
        'Paket Geprek',
        'Paket Geprek Kosek',
        'Paket Geprek Matah',
        'Paket Geprek Terasi',
        'Paket Hot Cheesy',
        'Minuman'
    ];
    const categoryRanks = new Map(categoryOrder.map((category, index) => [category, index]));
    categories.sort((first, second) => {
        const firstRank = categoryRanks.get(first);
        const secondRank = categoryRanks.get(second);
        if (firstRank !== undefined && secondRank !== undefined) return firstRank - secondRank;
        if (firstRank !== undefined) return -1;
        if (secondRank !== undefined) return 1;
        return first.localeCompare(second, 'id', { sensitivity: 'base' });
    });
    if (!categories.includes(activeCategory)) activeCategory = categories[0] || '';
    categoryCarousel?.destroy();
    categoryCarousel = null;
    categoryList.replaceChildren();
    const selectCategory = category => {
        if (!categories.includes(category)) return;
        const changed = activeCategory !== category;
        activeCategory = category;
        categoryList.querySelectorAll('.category-button').forEach(categoryButton => {
            const isActive = categoryButton.dataset.category === activeCategory;
            categoryButton.classList.toggle('active', isActive);
            categoryButton.setAttribute('aria-pressed', String(isActive));
        });
        if (changed) renderMenu();
    };
    categories.forEach((category, index) => {
        const slide = makeElement('li', 'splide__slide');
        const button = makeElement('button', `category-button${activeCategory === category ? ' active' : ''}`, category);
        button.type = 'button';
        button.dataset.category = category;
        button.setAttribute('aria-pressed', String(activeCategory === category));
        button.addEventListener('click', () => {
            categoryCarousel?.go(index);
            selectCategory(category);
        });
        slide.append(button);
        categoryList.append(slide);
    });
    if (categories.length && window.Splide) {
        categoryCarousel = new window.Splide('#categoryCarousel', {
            type: 'slide',
            autoWidth: true,
            start: categories.indexOf(activeCategory),
            focus: 'center',
            trimSpace: false,
            drag: true,
            arrows: false,
            pagination: false,
            gap: '8px',
            padding: { left: '72px', right: '72px' },
            breakpoints: {
                850: { gap: '7px', padding: { left: '40px', right: '40px' } },
                620: { gap: '6px', padding: { left: '16px', right: '16px' } }
            }
        });
        categoryCarousel.on('moved', index => selectCategory(categories[index]));
        categoryCarousel.mount();
    }
}

function renderMenu() {
    const query = document.getElementById('searchInput').value.trim().toLocaleLowerCase('id-ID');
    const filtered = menuItems.filter(item => {
        const matchesCategory = item.category === activeCategory;
        const searchText = `${item.name || ''} ${item.description || ''} ${item.category || ''} ${item.search_terms || ''}`.toLocaleLowerCase('id-ID');
        return matchesCategory && searchText.includes(query);
    });
    if (['Paket Geprek', 'Chicken Produk'].includes(activeCategory)) {
        const itemRank = item => {
            const name = (item.name || '').toLocaleLowerCase('id-ID');
            const packageNumber = name.match(/\b(?:paket|geprek)\s*(?:no\.?\s*)?([1-3])\b/);
            if (packageNumber) return Number(packageNumber[1]) - 1;
            if (/\bsayap\b/.test(name)) return 3;
            if (/\bpaha\s*bawah\b/.test(name)) return 4;
            if (/\bdada\b|\bpaha\s*atas\b/.test(name)) return 5;
            return 6;
        };
        filtered.sort((first, second) => itemRank(first) - itemRank(second));
    }
    document.getElementById('resultCount').textContent = `${filtered.length} menu`;
    menuGrid.replaceChildren();

    if (!menuItems.length) {
        const empty = makeElement('div', 'empty-state');
        empty.append(makeElement('h3', '', 'Menu sedang disiapkan'));
        empty.append(makeElement('p', '', 'Daftar menu outlet KS Tubun belum tersedia. Coba muat ulang setelah beberapa saat.'));
        menuGrid.append(empty);
        return;
    }
    if (!filtered.length) {
        const empty = makeElement('div', 'empty-state');
        empty.append(makeElement('h3', '', 'Menu tidak ditemukan'));
        empty.append(makeElement('p', '', 'Coba kata pencarian atau kategori yang berbeda.'));
        menuGrid.append(empty);
        return;
    }

    filtered.forEach((item, index) => {
        const card = makeElement('article', 'menu-card');
        card.style.animationDelay = `${Math.min(index * 35, 210)}ms`;
        const photo = makeElement('div', 'menu-photo');
        if (item.image_url) {
            const image = document.createElement('img');
            image.src = item.image_url;
            image.alt = item.name;
            image.loading = 'lazy';
            image.onerror = () => {
                image.remove();
                photo.prepend(makeElement('div', 'photo-fallback', 'Foto menu'));
            };
            photo.append(image);
        } else {
            photo.append(makeElement('div', 'photo-fallback', 'Rocket Chicken'));
        }
        photo.append(makeElement('span', 'availability', 'Tersedia'));
        const content = makeElement('div', 'menu-content');
        content.append(makeElement('div', 'menu-category', item.category || 'Menu'));
        content.append(makeElement('h3', '', item.name));
        content.append(makeElement('p', 'menu-description', item.description || 'Menu Rocket Chicken favoritmu.'));
        const orderRow = makeElement('div', 'menu-order-row');
        orderRow.append(makeElement('div', 'menu-price', rupiah.format(item.price)));
        orderRow.append(createQuantityControl(item));
        content.append(orderRow);
        card.append(photo, content);
        menuGrid.append(card);
    });
}

function createQuantityControl(item) {
    const quantity = cart.get(String(item.id))?.quantity || 0;
    const control = makeElement('div', 'quantity-control');
    const decrease = makeElement('button', '', '−');
    decrease.type = 'button';
    decrease.disabled = quantity === 0;
    decrease.setAttribute('aria-label', `Kurangi ${item.name}`);
    decrease.addEventListener('click', () => changeQuantity(item, -1));
    const value = makeElement('span', 'quantity-value', String(quantity));
    value.setAttribute('aria-label', `Jumlah ${item.name}`);
    const increase = makeElement('button', '', '+');
    increase.type = 'button';
    increase.setAttribute('aria-label', `Tambah ${item.name}`);
    increase.addEventListener('click', () => changeQuantity(item, 1));
    control.append(decrease, value, increase);
    return control;
}

function changeQuantity(item, delta) {
    const key = String(item.id);
    const quantity = Math.max(0, (cart.get(key)?.quantity || 0) + delta);
    if (quantity === 0) cart.delete(key);
    else cart.set(key, { item, quantity });
    renderMenu();
    updateCartDock();
    if (document.getElementById('checkoutDialog').open) renderCartContents();
}

function getCartTotals() {
    return [...cart.values()].reduce((totals, entry) => ({
        count: totals.count + entry.quantity,
        subtotal: totals.subtotal + entry.quantity * entry.item.price
    }), { count: 0, subtotal: 0 });
}

function updateCartDock() {
    const { count, subtotal } = getCartTotals();
    document.getElementById('cartDock').hidden = count === 0;
    document.body.classList.toggle('cart-active', count > 0);
    document.getElementById('cartCount').textContent = `${count} item`;
    document.getElementById('cartSubtotal').textContent = rupiah.format(subtotal);
}

function renderCartContents() {
    const lines = document.getElementById('cartLines');
    lines.replaceChildren();
    if (cart.size === 0) {
        lines.append(makeElement('p', 'checkout-empty', 'Keranjang masih kosong. Tambahkan menu dari daftar terlebih dahulu.'));
    }
    cart.forEach(({ item, quantity }) => {
        const line = makeElement('div', 'cart-line');
        const main = makeElement('div', 'cart-line-main');
        main.append(makeElement('strong', '', item.name));
        main.append(makeElement('span', '', `${quantity} × ${rupiah.format(item.price)} = ${rupiah.format(quantity * item.price)}`));
        line.append(main, createQuantityControl(item));
        lines.append(line);
    });
    const { subtotal } = getCartTotals();
    document.getElementById('checkoutSubtotal').textContent = rupiah.format(subtotal);
    updatePaymentSummary(true);
    document.querySelector('#checkoutForm button[type="submit"]').disabled = cart.size === 0;
}

function updatePaymentSummary(clampToTotal = false) {
    const { subtotal } = getCartTotals();
    const downPaymentInput = document.getElementById('downPayment');
    downPaymentInput.max = String(subtotal);
    let downPayment = Number(downPaymentInput.value) || 0;
    if (clampToTotal && downPayment > subtotal) {
        downPayment = subtotal;
        downPaymentInput.value = String(downPayment);
    }
    document.getElementById('remainingPayment').textContent = rupiah.format(Math.max(0, subtotal - downPayment));
}

function syncFulfillmentFields() {
    const isDelivery = document.querySelector('input[name="fulfillment"]:checked').value === 'delivery';
    const deliveryAddressField = document.getElementById('deliveryAddressField');
    const deliveryAddress = document.getElementById('deliveryAddress');
    deliveryAddressField.hidden = !isDelivery;
    deliveryAddress.required = isDelivery;
}

function sendOrder(event) {
    event.preventDefault();
    if (cart.size === 0) return;
    const phone = CONFIG.outletWhatsApp.replace(/\D/g, '');
    if (!phone) {
        showToast('Nomor WhatsApp outlet belum dikonfigurasi.');
        return;
    }
    const form = new FormData(event.currentTarget);
    const customerPhone = String(form.get('customer_phone')).trim();
    const phoneDigits = customerPhone.replace(/\D/g, '');
    if (phoneDigits.length < 8 || phoneDigits.length > 15) {
        showToast('Periksa kembali nomor HP / WhatsApp pemesan.');
        document.getElementById('customerPhone').focus();
        return;
    }
    const { subtotal } = getCartTotals();
    const downPayment = Number(form.get('down_payment')) || 0;
    if (!Number.isSafeInteger(downPayment) || downPayment < 0 || downPayment > subtotal) {
        showToast('DP harus berupa angka antara Rp0 dan total pemesanan.');
        document.getElementById('downPayment').focus();
        return;
    }
    const isDelivery = form.get('fulfillment') === 'delivery';
    const fulfillment = isDelivery ? 'Diantar' : 'Ambil sendiri';
    const orderLines = [...cart.values()].map(({ item, quantity }, index) =>
        `${index + 1}. Nama paket/menu: ${item.name}\n    Jumlah: ${quantity}\n    Harga per box: ${rupiah.format(item.price)}`
    );
    const date = new Date(`${form.get('order_date')}T00:00:00`).toLocaleDateString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric'
    });
    const deliveryAddress = isDelivery ? String(form.get('delivery_address')).trim() : '-';
    const note = String(form.get('order_note')).trim() || '-';
    const message = [
        'Halo Rocket Chicken KS Tubun',
        '',
        'Saya ingin melakukan pemesanan dengan rincian berikut:',
        '',
        'DATA PEMESAN',
        `Nama: ${String(form.get('customer_name')).trim()}`,
        `No. HP: ${customerPhone}`,
        `Alamat: ${String(form.get('customer_address')).trim()}`,
        '',
        'DETAIL PESANAN',
        ...orderLines,
        '',
        'TOTAL PEMESANAN',
        `Total: ${rupiah.format(subtotal)}`,
        `DP: ${rupiah.format(downPayment)}`,
        `Sisa pembayaran: ${rupiah.format(subtotal - downPayment)}`,
        '',
        'JADWAL PESANAN',
        `Tanggal pesanan: ${date}`,
        `Jam pesanan: ${form.get('order_time')}`,
        '',
        'PENGAMBILAN/PENGANTARAN',
        `Metode: ${fulfillment}`,
        `Alamat pengantaran: ${deliveryAddress}`,
        ...(isDelivery ? ['Ongkir: dibahas melalui WhatsApp'] : []),
        `Catatan tambahan: ${note}`,
        '',
        'Terima kasih.'
    ].join('\n');
    window.location.href = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function normalizeMenuItem(item) {
    if (!item) return null;
    const categorySource = `${item.name || ''} ${item.description || ''} ${item.display_category || ''} ${item.category || ''}`.trim();
    const normalizedCategorySource = categorySource.toLocaleLowerCase('id-ID');
    let category = String(item.display_category || item.category || 'Lainnya').trim() || 'Lainnya';
    if (/geprek/.test(normalizedCategorySource)) {
        if (/kosek|bawang/.test(normalizedCategorySource)) category = 'Paket Geprek Kosek';
        else if (/matah/.test(normalizedCategorySource)) category = 'Paket Geprek Matah';
        else if (/terasi/.test(normalizedCategorySource)) category = 'Paket Geprek Terasi';
    }
    return {
        ...item,
        name: String(item.name || '').trim(),
        description: String(item.description || '').trim(),
        category,
        price: Number(item.price) || 0,
        image_url: safeImageUrl(item.image_url || ''),
        is_available: item.active !== undefined ? Boolean(item.active) : Boolean(item.is_available !== false),
        search_terms: String(item.search_terms || '').trim(),
        sort_order: Number(item.sort_order) || 0,
    };
}

async function loadMenu() {
    if (!supabaseClient) {
        setConnection('Koneksi menu tidak tersedia', 'error');
        menuItems = [];
        renderCategories();
        renderMenu();
        updateCartDock();
        return;
    }
    setConnection('Memuat menu...');
    menuGrid.innerHTML = '<div class="skeleton" aria-label="Memuat menu"></div>';
    const { data, error } = await supabaseClient
        .from(MENU_TABLE)
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true })
        .order('id', { ascending: true });
    if (error) {
        setConnection('Gagal memuat menu', 'error');
        menuItems = [];
        renderCategories();
        renderMenu();
        updateCartDock();
        showToast(`Menu belum dapat dimuat: ${error.message}`);
        return;
    }
    menuItems = (data || []).map(normalizeMenuItem).filter(Boolean);
    for (const [key, entry] of cart) {
        const refreshedItem = menuItems.find(item => String(item.id) === key);
        if (refreshedItem) cart.set(key, { ...entry, item: refreshedItem });
        else cart.delete(key);
    }
    setConnection('Menu diperbarui langsung', 'online');
    renderCategories();
    renderMenu();
    updateCartDock();
    if (document.getElementById('checkoutDialog').open) renderCartContents();
}

function safeImageUrl(url) {
    if (!url) return '';
    try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
    } catch {
        return '';
    }
}

document.getElementById('searchInput').addEventListener('input', renderMenu);
document.getElementById('refreshMenu').addEventListener('click', loadMenu);
document.getElementById('checkoutOpen').addEventListener('click', () => {
    renderCartContents();
    document.getElementById('checkoutDialog').showModal();
});
document.getElementById('checkoutClose').addEventListener('click', () => document.getElementById('checkoutDialog').close());
document.getElementById('checkoutForm').addEventListener('submit', sendOrder);
document.querySelectorAll('input[name="fulfillment"]').forEach(input => input.addEventListener('change', syncFulfillmentFields));
document.getElementById('checkoutDialog').addEventListener('click', event => {
    if (event.target === event.currentTarget) event.currentTarget.close();
});
document.getElementById('contactButton').addEventListener('click', event => {
    const phone = CONFIG.outletWhatsApp.replace(/\D/g, '');
    if (!phone) {
        event.preventDefault();
        showToast('Nomor WhatsApp outlet belum dikonfigurasi.');
        return;
    }
    event.currentTarget.href = `https://wa.me/${phone}?text=${encodeURIComponent('Halo Rocket Chicken KS Tubun, saya ingin bertanya tentang menu.')}`;
    event.currentTarget.target = '_blank';
    event.currentTarget.rel = 'noopener noreferrer';
});

const today = new Date();
const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
document.getElementById('orderDate').min = localToday;
document.getElementById('orderDate').value = localToday;
syncFulfillmentFields();
loadMenu();
