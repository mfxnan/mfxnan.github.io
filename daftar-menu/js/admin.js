(() => {
    const $ = id => document.getElementById(id);
    const SUPABASE_URL = 'https://ulpckwlazrnhxvjthlgh.supabase.co';
    const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_sxy7RSWC7Lo5ggQyPTvjRA_fH_xdsLJ';
    const client = window.supabase?.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    let menu = [];
    const fmt = n => 'Rp' + Number(n).toLocaleString('id-ID');
    const msg = (id, text) => $(id).textContent = text;
    const show = (id, yes = true) => $(id).classList.toggle('hidden', !yes);
    async function initAuth() {
        if (!client) { msg('authStatus', 'Library Supabase gagal dimuat. Periksa koneksi internet.'); return; }
        msg('authStatus', 'Memeriksa sesi admin...');
        const { data, error } = await client.auth.getSession();
        if (error) { msg('authStatus', 'Gagal membaca sesi: ' + error.message); return; }
        if (data.session) await afterLogin();
        else { show('editorPanel', false); show('listPanel', false); msg('authStatus', 'Masukkan email dan password admin Supabase.'); }
    }
    async function afterLogin() {
        const { data, error } = await client.auth.getUser();
        if (error || !data.user) { msg('authStatus', 'Sesi tidak valid. Login ulang.'); return; }
        msg('authStatus', 'Login sebagai ' + data.user.email + '. Jika UID bukan admin yang diizinkan RLS, operasi database akan ditolak.');
        show('logoutBtn', true); show('editorPanel', true); show('listPanel', true);
        await refresh();
    }
    async function login() {
        if (!client) { msg('authStatus', 'Hubungkan Supabase dulu.'); return; }
        const { data, error } = await client.auth.signInWithPassword({ email: $('email').value.trim(), password: $('password').value });
        if (error) { msg('authStatus', 'Login gagal: ' + error.message); return; }
        await afterLogin();
    }
    async function logout() { if (client) await client.auth.signOut(); show('editorPanel', false); show('listPanel', false); show('logoutBtn', false); msg('authStatus', 'Kamu sudah logout.'); }
    async function refresh() {
        if (!client) return;
        msg('listStatus', 'Memuat menu...');
        const { data, error } = await client.from('menus').select('*').order('sort_order', { ascending: true }).order('name');
        if (error) { msg('listStatus', 'Gagal membaca menu: ' + error.message + '\nPeriksa SQL, RLS, dan koneksi.'); return; }
        menu = data || []; renderList(); msg('listStatus', 'Berhasil memuat ' + menu.length + ' baris menu.');
    }
    function renderList() {
        const q = $('filter').value.toLocaleLowerCase('id-ID').trim();
        const rows = $('rows'); rows.replaceChildren();
        menu.filter(x => (x.name + ' ' + (x.display_category || x.category) + ' ' + x.description).toLocaleLowerCase('id-ID').includes(q)).forEach(x => {
            const tr = document.createElement('tr');
            const td1 = document.createElement('td'); td1.textContent = x.name + '\n' + x.description;
            const td2 = document.createElement('td'); td2.textContent = x.display_category || x.category;
            const td3 = document.createElement('td'); td3.textContent = fmt(x.price);
            const td4 = document.createElement('td'); td4.textContent = x.updated_at ? new Date(x.updated_at).toLocaleString('id-ID') : '—';
            const td5 = document.createElement('td'); const edit = document.createElement('button'); edit.textContent = 'Edit'; edit.onclick = () => editItem(x);
            const del = document.createElement('button'); del.textContent = x.active ? 'Nonaktifkan' : 'Aktifkan'; del.className = x.active ? 'danger' : 'secondary'; del.style.marginLeft = '5px'; del.onclick = () => toggleActive(x);
            td5.append(edit, del); tr.append(td1, td2, td3, td4, td5); rows.append(tr);
        });
    }
    function editItem(x) {
        $('itemId').value = x.id;
        $('name').value = x.name;
        $('category').value = x.display_category || x.category;
        $('sourceCategory').value = x.category || '';
        $('description').value = x.description || '';
        $('imageUrl').value = x.image_url || '';
        $('price').value = x.price;
        $('searchTerms').value = x.search_terms || '';
        $('saveBtn').textContent = 'Simpan perubahan';
        window.scrollTo({ top: $('editorPanel').offsetTop, behavior: 'smooth' });
    }
    function clearForm() { $('itemId').value = ''; $('name').value = ''; $('sourceCategory').value = ''; $('description').value = ''; $('imageUrl').value = ''; $('price').value = ''; $('searchTerms').value = ''; $('saveBtn').textContent = 'Simpan menu'; msg('saveStatus', 'Form dikosongkan.'); }
    async function save() {
        const name = $('name').value.trim(), price = Number($('price').value), category = $('category').value;
        if (!name || $('price').value === '' || !Number.isSafeInteger(price) || price < 0) { msg('saveStatus', 'Nama wajib diisi dan harga harus bilangan bulat nol atau lebih.'); return; }
        const imageUrl = $('imageUrl').value.trim();
        if (imageUrl) {
            try {
                const parsedImageUrl = new URL(imageUrl);
                if (!['http:', 'https:'].includes(parsedImageUrl.protocol)) throw new Error();
            } catch {
                msg('saveStatus', 'URL gambar harus berupa alamat publik HTTP atau HTTPS yang valid.');
                return;
            }
        }
        const displayCategory = category;
        const payload = {
            name,
            price,
            category: $('sourceCategory').value.trim() || displayCategory,
            display_category: displayCategory,
            description: $('description').value.trim(),
            image_url: imageUrl || null,
            search_terms: $('searchTerms').value.trim(),
            active: true,
            updated_at: new Date().toISOString()
        };
        const id = $('itemId').value; msg('saveStatus', 'Menyimpan...');
        const result = id ? await client.from('menus').update(payload).eq('id', id).select().single() : await client.from('menus').insert(payload).select().single();
        if (result.error) { msg('saveStatus', 'Gagal menyimpan: ' + result.error.message); return; }
        msg('saveStatus', 'Berhasil disimpan: ' + result.data.name + ' — ' + fmt(result.data.price));
        clearForm(); await refresh();
    }
    async function toggleActive(x) {
        const nextActive = !x.active;
        const action = nextActive ? 'aktifkan' : 'nonaktifkan';
        if (!confirm(`${action[0].toUpperCase()}${action.slice(1)} "${x.name}"?`)) return;
        const { error } = await client.from('menus').update({ active: nextActive, updated_at: new Date().toISOString() }).eq('id', x.id);
        if (error) { msg('listStatus', 'Gagal: ' + error.message); return; } await refresh();
    }
    function exportJson() {
        const blob = new Blob([JSON.stringify(menu, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'rc-ks-tubun-menu-backup.json'; a.click(); URL.revokeObjectURL(a.href);
    }
    $('loginBtn').onclick = login; $('logoutBtn').onclick = logout;
    $('refreshBtn').onclick = refresh; $('saveBtn').onclick = save; $('clearBtn').onclick = clearForm;
    $('filter').oninput = renderList; $('exportBtn').onclick = exportJson;
    document.addEventListener('keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) && ['+', '=', '-', '_', '0'].includes(event.key)) {
            event.preventDefault();
        }
    });
    initAuth();
})();
