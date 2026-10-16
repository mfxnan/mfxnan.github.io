# Rocket Chicken KS Tubun

Katalog ini menggunakan halaman statis, Supabase Database, Supabase Auth, dan Supabase Storage. Halaman katalog dan admin memakai tabel `public.menus`. URL project dan publishable key sudah diatur di `index.html` dan `admin.html`. Publishable key memang digunakan di browser; jangan pernah memasukkan `service_role` key ke file frontend.

## 1. Siapkan Supabase

1. Buka project Supabase yang URL-nya digunakan di `index.html` dan `admin.html`.
2. Buka **SQL Editor**, buat query baru, lalu jalankan SQL setup di bawah.
3. Buka **Authentication > Users**, buat akun admin dan verifikasi emailnya.
4. Berikan hak admin dengan SQL pada bagian **Beri hak admin** di bawah.
5. Di **Authentication > URL Configuration**, masukkan URL situs ke **Site URL** dan **Redirect URLs**.

### Tabel, akses, dan penyimpanan foto

SQL ini membuat tabel yang dipakai kode saat ini, yaitu `menus`, bukan tabel lama `menu_items`. Jika tabel `menus` sudah ada, SQL menambahkan kolom pendukung yang belum tersedia. Kolom inti `id`, `name`, `category`, dan `price` harus sudah ada.

```sql
create extension if not exists pgcrypto;

create table if not exists public.menus (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  category text not null,
  display_category text,
  price integer not null check (price >= 0),
  image_url text,
  active boolean not null default true,
  search_terms text not null default '',
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.menus add column if not exists description text not null default '';
alter table public.menus add column if not exists display_category text;
alter table public.menus add column if not exists image_url text;
alter table public.menus add column if not exists active boolean not null default true;
alter table public.menus add column if not exists search_terms text not null default '';
alter table public.menus add column if not exists sort_order integer not null default 0;
alter table public.menus add column if not exists updated_at timestamptz not null default now();

create index if not exists menus_public_order_idx
  on public.menus (active, sort_order, name);

create table if not exists public.menu_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

alter table public.menus enable row level security;
alter table public.menu_admins enable row level security;

revoke all on public.menus from anon, authenticated;
grant select on public.menus to anon, authenticated;
grant insert, update on public.menus to authenticated;
revoke all on public.menu_admins from anon, authenticated;
grant select on public.menu_admins to authenticated;

create or replace function public.is_menu_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.menu_admins
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_menu_admin() from public;
grant execute on function public.is_menu_admin() to anon, authenticated;

drop policy if exists "Public can read active menus" on public.menus;
create policy "Public can read active menus"
  on public.menus for select to anon, authenticated
  using (active or (select public.is_menu_admin()));

drop policy if exists "Admins can add menus" on public.menus;
create policy "Admins can add menus"
  on public.menus for insert to authenticated
  with check ((select public.is_menu_admin()));

drop policy if exists "Admins can update menus" on public.menus;
create policy "Admins can update menus"
  on public.menus for update to authenticated
  using ((select public.is_menu_admin()))
  with check ((select public.is_menu_admin()));

drop policy if exists "Admins can read own admin record" on public.menu_admins;
create policy "Admins can read own admin record"
  on public.menu_admins for select to authenticated
  using (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-images',
  'menu-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view menu photos" on storage.objects;
create policy "Public can view menu photos"
  on storage.objects for select to public
  using (bucket_id = 'menu-images');

drop policy if exists "Admins can upload menu photos" on storage.objects;
create policy "Admins can upload menu photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'menu-images' and (select public.is_menu_admin()));

drop policy if exists "Admins can update menu photos" on storage.objects;
create policy "Admins can update menu photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'menu-images' and (select public.is_menu_admin()))
  with check (bucket_id = 'menu-images' and (select public.is_menu_admin()));

drop policy if exists "Admins can delete menu photos" on storage.objects;
create policy "Admins can delete menu photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'menu-images' and (select public.is_menu_admin()));
```

### Beri hak admin

Setelah akun dibuat di Supabase Auth, ganti email contoh lalu jalankan query ini. Hanya akun yang terdaftar di `menu_admins` yang dapat menambah atau mengubah menu dan mengelola foto di Storage.

```sql
insert into public.menu_admins (user_id)
select id from auth.users where email = lower('admin@outlet.example')
on conflict (user_id) do nothing;
```

### Mengganti foto menu

Panel admin menerima URL gambar publik saat menambah atau mengedit menu. Kolom ini opsional; biarkan kosong jika menu belum memiliki foto.

1. Siapkan URL langsung ke gambar dari host publik. Gambar bisa disimpan di repo, misalnya `https://mfxnan.github.io/daftar-menu/asset/img/nama-menu.jpg`, atau diunggah ke **Storage > menu-images** di Supabase lalu salin **Public URL**. Bucket Supabase menerima JPG, PNG, WebP, atau GIF hingga 5 MB.
2. Buka `/daftar-menu/admin.html`, login, lalu tambah menu atau klik **Edit** pada menu yang fotonya ingin diganti.
3. Tempel URL pada **URL gambar (opsional)**, lalu klik **Simpan menu** atau **Simpan perubahan**.
4. Muat ulang katalog untuk memeriksa hasilnya. Kosongkan URL saat mengedit menu dan simpan untuk menghapus gambar dari kartu menu.

URL harus dapat diakses publik melalui HTTP/HTTPS dan langsung menuju file gambar, bukan halaman berbagi. Rasio yang disarankan adalah `1,35:1` (contoh `1350 × 1000` piksel); gambar lain tetap bisa dipakai, tetapi akan dipotong agar sesuai kartu menu.

## 2. Atur kontak outlet

Nilai `outletWhatsApp` di `index.html` saat ini sudah diisi. Jika nomor berubah, gunakan format internasional tanpa `+`, spasi, atau tanda baca; contoh: `62` diikuti nomor outlet.

## 3. Deploy ke GitHub Pages

1. Pastikan perubahan `daftar-menu/index.html`, `daftar-menu/admin.html`, dan panduan ini sudah masuk ke branch yang akan dipublikasikan.
2. Di GitHub, buka repository **Settings > Pages**.
3. Pada **Build and deployment**, pilih **Deploy from a branch**, pilih branch publikasi (umumnya `main`) dan folder `/ (root)`, lalu simpan.
4. Setelah deployment selesai, katalog tersedia di `https://mfxnan.github.io/daftar-menu/` dan panel admin di `https://mfxnan.github.io/daftar-menu/admin.html`.
5. Masukkan kedua URL tersebut ke **Redirect URLs** Supabase. Gunakan URL katalog sebagai **Site URL**. Jika memakai custom domain atau nama owner berbeda, sesuaikan dengan URL yang tampil di Settings.

## 4. Verifikasi

1. Buka URL katalog dan pastikan status menunjukkan menu berhasil dimuat.
2. Buka URL admin, login dengan akun yang UID-nya sudah terdaftar di `menu_admins`, lalu pastikan daftar menu tampil.
3. Uji tambah/edit menu dengan URL gambar kosong dan terisi, serta aktifkan/nonaktifkan menu. Panel admin tidak memiliki aksi hapus.
4. Pastikan foto tampil pada kartu menu publik setelah menyimpan URL gambar.
5. Uji pencarian, kategori, tampilan ponsel, dan tombol WhatsApp.

Jika katalog atau panel admin melaporkan error, periksa project Supabase, nama/kolom tabel `menus`, kebijakan RLS, akun admin, serta URL dan publishable key di kedua file HTML. Jangan menonaktifkan RLS atau mengekspos `service_role` key untuk mengatasi error.
