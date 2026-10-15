# Rocket Chicken KS Tubun

Katalog ini memakai halaman statis, Supabase Database, Supabase Auth, dan Supabase Storage. URL project dan publishable key sudah diatur di `index.html`. Publishable key memang digunakan di browser; jangan pernah memasukkan `service_role` key ke file frontend.

## 1. Siapkan Supabase

1. Buka project `ulpckwlazrnhxvjthlgh` di Supabase.
2. Buka **SQL Editor**, buat query baru, lalu jalankan seluruh SQL di bawah.
3. Buka **Authentication > Users**, buat akun untuk admin outlet, dan verifikasi emailnya.
4. Ganti alamat pada query promosi admin di langkah 2 dengan email akun tersebut, lalu jalankan query itu secara terpisah.
5. Pada **Authentication > URL Configuration**, tambahkan URL situs yang akan dipakai ke **Site URL** dan **Redirect URLs**.

### Skema, RLS, dan bucket foto

```sql
create extension if not exists pgcrypto;

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  category text not null,
  price integer not null check (price >= 0),
  image_url text,
  is_available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists menu_items_public_order_idx
  on public.menu_items (is_available, sort_order, name);

create table if not exists public.menu_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

alter table public.menu_items enable row level security;
alter table public.menu_admins enable row level security;

revoke all on public.menu_items from anon, authenticated;
grant select on public.menu_items to anon, authenticated;
grant insert, update, delete on public.menu_items to authenticated;
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

drop policy if exists "Public can read available menu" on public.menu_items;
create policy "Public can read available menu"
  on public.menu_items for select to anon, authenticated
  using (is_available or (select public.is_menu_admin()));

drop policy if exists "Admins can add menu" on public.menu_items;
create policy "Admins can add menu"
  on public.menu_items for insert to authenticated
  with check ((select public.is_menu_admin()));

drop policy if exists "Admins can update menu" on public.menu_items;
create policy "Admins can update menu"
  on public.menu_items for update to authenticated
  using ((select public.is_menu_admin()))
  with check ((select public.is_menu_admin()));

drop policy if exists "Admins can delete menu" on public.menu_items;
create policy "Admins can delete menu"
  on public.menu_items for delete to authenticated
  using ((select public.is_menu_admin()));

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

Setelah akun dibuat di Supabase Auth, ganti email contoh ini dan jalankan di SQL Editor. Hanya akun yang ada di `menu_admins` yang dapat mengubah data atau mengunggah foto.

```sql
insert into public.menu_admins (user_id)
select id from auth.users where email = lower('admin@outlet.example')
on conflict (user_id) do nothing;
```

## 2. Atur kontak outlet

Di `index.html`, isi `outletWhatsApp` dengan nomor WhatsApp outlet dalam format internasional tanpa `+`, spasi, atau tanda baca. Contoh format: `62` diikuti nomor outlet. Sampai nomor itu diisi, tombol chat akan memberi tahu bahwa kontak belum dikonfigurasi.

## 3. Deploy ke GitHub Pages

1. Pastikan `daftar-menu/index.html` dan file ini sudah masuk ke branch yang akan dipublikasikan.
2. Di GitHub, buka repository **Settings > Pages**.
3. Pada **Build and deployment**, pilih **Deploy from a branch**, pilih branch publikasi (umumnya `main`) dan folder `/ (root)`, lalu simpan.
4. Setelah deployment selesai, halaman tersedia di `https://mfxnan.github.io/daftar-menu/`.
5. Tambahkan URL tersebut ke **Site URL** dan **Redirect URLs** Supabase. Jika repository memakai custom domain atau nama owner berbeda, gunakan URL GitHub Pages yang tampil di Settings.

## 4. Verifikasi

1. Buka URL halaman dan pastikan status katalog menunjukkan menu sudah terhubung.
2. Masuk lewat tombol **Admin**, lalu tambahkan produk dengan nama, kategori, harga, dan foto.
3. Pastikan produk tampil di katalog publik. Uji edit harga, sembunyikan/tampilkan produk, ganti foto, dan hapus produk.
4. Uji pencarian, kategori, tampilan ponsel, dan tombol WhatsApp setelah nomor outlet diatur.

Jika katalog melaporkan error saat dibuka, periksa bahwa SQL telah dijalankan, project Supabase aktif, serta URL dan publishable key di `index.html` benar. Jangan menyelesaikan masalah dengan menonaktifkan RLS atau mengekspos secret key.