# Fortuner POS

Sistem kasir, order, produksi, dan keuangan untuk percetakan. Frontend React (GitHub Pages), backend Google Apps Script, database Google Sheets.

**Status: Tahap 1, 2, 4, 5 selesai · Tahap 3 (aplikasi desktop) siap diuji di PC Windows · Tahap 6 (go-live) berikutnya**
- Tahap 1: login, role & hak akses, daftar perangkat kantor, sidebar, tabel standar, Master Data (produk + harga matriks + riwayat harga, konsumen, supplier, mesin, metode bayar), Pengaturan, Log aktivitas.
- Tahap 2: **Front Office** (terima desain, buat nota/SPK dengan harga otomatis dari matriks, tanpa menerima uang, cetak SPK) dan **Kasir** (antrian nota menunggu bayar, cari/scan nomor nota, lunas/DP/nominal, kembalian, cetak kwitansi 58/80 mm), Order (bayar berkali-kali, diambil, batal, cetak ulang), Piutang (umur & per konsumen), mode offline (antrian kirim + sinkron otomatis), Dashboard angka harian + grafik 14 hari.
- Tahap 4: **Produksi** (papan Antrian/Proses/Selesai per mesin, urut janji selesai, tanda terlambat), **Mesin & Operator** (counter masuk/tutup, reject, batal, selisih vs klik nota FO, riwayat), **Kas** (tutup kasir per kasir × metode vs uang fisik/mutasi bank, wajib keterangan bila selisih; buku kas kecil dengan saldo berjalan).
- Tahap 5: **Pengeluaran** (belanja bahan & operasional per kategori, lunas atau hutang; belanja bahan bisa memperbarui harga beli per lembar tanpa mengubah nota lama), **Hutang Supplier** (tagihan, cicilan, jatuh tempo), **Laporan** (omzet, uang masuk, piutang, arus kas, laba kotor & perkiraan laba bersih khusus hak *Laporan laba*, rincian per produk/CS/mesin/metode/konsumen/kategori, export semua ke satu file Excel), Dashboard ditambah omzet bulan ini vs bulan lalu, produk terlaris, dan hutang jatuh tempo.
- Tahap 3: **Aplikasi desktop Windows** (Tauri) untuk PC FO & kasir: installer, ID perangkat dari mesin, pendaftaran PC dari layar login, cetak SPK/kwitansi langsung ke printer thermal USB atau LAN (ESC/POS, barcode nomor nota, potong kertas, salinan), laci uang (otomatis saat tunai / tombol manual tercatat di log), role per PC, batas jumlah perangkat, menu Koneksi server, pembaruan otomatis dari GitHub Releases, jalan otomatis saat Windows menyala, data demo otomatis dibuang saat pindah ke server asli.

## Coba tanpa server (mode demo)

```bash
npm install
npm run dev        # buka http://localhost:5173 — tanpa VITE_API_URL otomatis mode demo
```

Mode demo menjalankan logika server yang sama persis di browser (data di localStorage). Akun demo: `owner`, `admin`, `cs`, `kasir`, `operator`, `keuangan`, password = username + `123`. CS dan kasir ditolak sampai perangkat didaftarkan di **Pengaturan → Perangkat**.

## Struktur

```
src/
  server/          Logika server SATU SUMBER (TypeScript)
    core.ts        Semua aksi API: login, perangkat, master, harga, user, role, log
    schema.ts      Daftar sheet & kolom database
    gasStore.ts    Penyimpanan Google Sheets (dipakai Apps Script)
    mockStore.ts   Penyimpanan localStorage (dipakai mode demo)
    gasEntry.ts    doPost/doGet/setup untuk Apps Script
  lib/
    api.ts         Klien API (fetch ke Apps Script, atau server tiruan saat demo)
    pricing.ts     Logika harga matriks (dipakai kasir & server)
    modules.ts     Daftar modul + hak akses awal per role
  platform/        Jembatan ke aplikasi desktop: ID perangkat, printer, pembaruan
  lib/escpos.ts    Penyusun perintah printer thermal (ESC/POS)
src-tauri/         Aplikasi desktop (Rust/Tauri): cetak RAW/LAN, ID mesin, updater
  components/table DataTable: cari, filter, rentang tanggal, pagination, export Excel
  pages/           Halaman
apps-script/       HASIL BUILD untuk ditempel ke Apps Script (npm run build:gas)
private/           Data asli (tidak ikut git) — mis. file import produk
```

`apps-script/Code.gs` dibuat dari `src/server/*.ts`. Jangan edit `Code.gs` langsung; ubah TypeScript-nya lalu jalankan `npm run build:gas`.

## Setup produksi (sekali)

### 1. Google (akun khusus usaha)
1. Login ke akun Google khusus usaha. Buat Google Sheet baru, beri nama mis. **Fortuner POS Database**.
2. Di sheet itu: **Ekstensi → Apps Script**.
3. Hapus isi `Code.gs`, tempel isi `apps-script/Code.gs` dari repo ini.
4. **Project Settings (ikon gerigi) → centang "Show appsscript.json"**, lalu buka `appsscript.json` dan ganti isinya dengan `apps-script/appsscript.json`.
5. (Disarankan) **Project Settings → Script Properties → Add**: `OWNER_PASSWORD` = password awal owner. Tanpa ini password awal `fortuner123`.
6. Pilih fungsi `setup` di toolbar → **Run** → izinkan akses. Semua sheet dan data dasar dibuat. Jalankan juga `pasangTriggerBackup` untuk backup harian ke Drive.
7. **Deploy → New deployment → Web app**: Execute as **Me**, Who has access **Anyone** → Deploy. Salin URL yang berakhiran `/exec`.

> Spreadsheet database jangan dibagikan ke staf. Staf hanya mengakses lewat aplikasi; semua akses dicek di Apps Script.

### 2. GitHub Pages
1. Push repo ini ke GitHub (repo publik, branch `main`).
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. **Settings → Secrets and variables → Actions → Variables → New repository variable**: `VITE_API_URL` = URL `/exec` dari langkah 1.7. (Opsional `VITE_APP_NAME`.)
4. Buka tab **Actions**, jalankan "Deploy ke GitHub Pages" (atau push apa saja). Situs ada di `https://<user>.github.io/<repo>/`.

### 3. Mulai pakai
1. Login `owner` + password awal → wajib ganti password.
2. **Pengaturan → Umum**: nama usaha, alamat, telepon, harga banyak mulai qty 26.
3. **Pengaturan → User**: buat akun staf. CS & kasir: aktifkan "Khusus perangkat kantor".
4. Di tiap PC kantor: login sebagai owner/admin → **Pengaturan → Perangkat → Daftarkan perangkat ini**, isi kode PC (K1, K2, …). Atau biarkan staf mencoba login dulu, lalu setujui permintaannya.
5. **Master Data → Produk & Harga → Import Excel**: pakai file dari folder `private/` (dibuat dari sheet "Basis data").

## Memperbarui backend
> **Setiap pembaruan backend (Tahap 4: `machine_counters`, `petty_cash`, `cash_deposits`; Tahap 5: `expense_categories`, `expenses`, `supplier_bills`, `bill_payments`):** jalankan `setup` lagi setelah menempel `Code.gs`.
>
> **Dari Tahap 1 ke Tahap 2:** setelah menempel `Code.gs` baru, jalankan `setup` sekali lagi (menambah kolom `nomor`, `catatan`, `desain`, `janji_selesai` di sheet `orders`), lalu deploy versi baru.
> Hak akses: role CS punya modul **Front Office** (buat order), role Kasir punya modul **Kasir** (terima pembayaran). Owner/admin punya keduanya. Bisa diubah di Pengaturan → Hak Akses.

1. Ubah `src/server/*.ts`, lalu `npm run build:gas`.
2. Tempel `apps-script/Code.gs` baru ke editor Apps Script.
3. **Deploy → Manage deployments → (pensil) Edit → Version: New version → Deploy**. URL tetap sama.
4. Bila ada sheet/kolom baru di `schema.ts`, jalankan `setup` lagi (aman, data tidak terhapus).

## Nomor nota & mode offline
- Format `FT-K1-1026-0001`: awalan, kode PC, bulan-tahun, nomor urut per PC per bulan.
- PC yang terdaftar (Pengaturan → Perangkat) membuat nomornya sendiri, jadi tetap bisa membuat nota saat internet mati. Nota masuk antrian kirim dan terkirim otomatis (cek koneksi tiap 30 detik) atau lewat tombol **Sinkron sekarang** di header.
- Perangkat yang tidak terdaftar (HP/laptop owner) dinomori server dengan kode `W` (ubah lewat setting `kode_pc_web`) dan hanya bisa membuat nota saat online.
- Kirim ulang aman: server menolak ID nota/pembayaran yang sudah ada. Bila nomor offline ternyata sudah terpakai, server memberi nomor baru dan aplikasi memberi tahu.
- Nota offline memakai harga yang tersimpan di perangkat saat itu dan diberi tanda "dibuat offline".
- Keluar (logout) diblokir selama antrian belum kosong. Jangan hapus data situs browser di PC kasir.
- Panel sinkron punya pilihan **Simulasi internet mati** untuk mencoba alur offline.

## Aturan penting
- **Harga tidak pernah ditimpa.** Perubahan harga menambah baris `price_history` dengan `berlaku_mulai`; baris sebelumnya diberi `berlaku_sampai`. Tanggal yang sama dengan harga terakhir = koreksi. Mulai Tahap 2, setiap item nota menyimpan salinan harganya sendiri.
- **Repo publik**: jangan menaruh data konsumen, ID spreadsheet, atau rahasia apa pun di kode. Data asli hanya di Google Sheets dan folder `private/` (di-ignore git).
- Semua penulisan memakai `LockService`, jadi aman dipakai beberapa kasir bersamaan.

## Perintah
| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Jalankan lokal (demo bila `VITE_API_URL` kosong) |
| `npm run build` | Build untuk GitHub Pages ke `dist/` |
| `npm run build:demo` | Build demo satu file HTML ke `dist-demo/` |
| `npm run build:gas` | Bundle backend ke `apps-script/Code.gs` |
| `npm run typecheck` | Cek TypeScript |

## Aplikasi desktop (PC Front Office & Kasir)

Installer Windows dibuat otomatis oleh GitHub Actions (workflow **Rilis aplikasi desktop**). Tidak perlu memasang Rust/Visual Studio di komputer sendiri.

### Sekali saja: kunci pembaruan otomatis (disarankan)
Tanpa kunci ini installer tetap jadi, tapi PC tidak bisa memperbarui diri sendiri.
1. Di komputer yang ada Node.js, di folder repo: `npx tauri signer generate -w fortuner.key` (isi password, simpan baik-baik). Terbentuk `fortuner.key` (rahasia) dan `fortuner.key.pub`. **Jangan commit dua file ini.**
2. GitHub → Settings → Secrets and variables → Actions:
   - **Secrets**: `TAURI_SIGNING_PRIVATE_KEY` = isi `fortuner.key`; `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` = password tadi.
   - **Variables**: `TAURI_UPDATER_PUBKEY` = isi `fortuner.key.pub`.
3. Simpan `fortuner.key` + password di tempat aman (mis. Google Drive akun usaha). Kalau hilang, PC yang sudah terpasang harus dipasang ulang manual.

### Membuat / memperbarui installer
1. Naikkan `"version"` di `package.json` (mis. 1.0.0 → 1.0.1). Versi tidak boleh sama dengan rilis sebelumnya.
2. Push, lalu tab **Actions → Rilis aplikasi desktop → Run workflow**. Sekitar 10–15 menit.
3. Hasilnya di **Releases**: `Fortuner POS_x.y.z_x64-setup.exe`. PC yang sudah terpasang menawarkan pembaruan sendiri (tombol "Versi x.y.z" di header).

Alamat server diambil dari variabel `VITE_API_URL` saat build. Kalau kosong, installer berjalan dalam **mode demo** (data latihan di PC itu saja). Saat PC kemudian tersambung ke server asli (versi baru dengan `VITE_API_URL`, atau owner/admin mengisi **Aplikasi PC Ini → Koneksi server**), data demo, antrian offline demo, dan sesi lama otomatis dibuang. Pengaturan printer tetap.

### Memasang di PC kantor
1. Unduh `..._x64-setup.exe` dari Releases, jalankan. Windows SmartScreen mungkin memperingatkan (installer belum bersertifikat berbayar): **More info → Run anyway**. Terpasang untuk user Windows itu (tanpa hak admin), shortcut di Desktop.
2. Di layar login: isi **Kode PC** usulan (K1, K2, …) dan lokasi. Kasir/CS login sekali → permintaan masuk. Owner/admin menyetujui di **Pengaturan → Perangkat** (bisa dari HP), boleh sekalian membatasi **role yang boleh login** di PC itu. Atau owner/admin login langsung di PC itu → Pengaturan → Perangkat → Daftarkan perangkat ini.
3. **Pengaturan → Printer & Laci** (owner/admin): pilih printer (USB) atau isi IP (LAN, port 9100), lebar kertas, salinan, laci. Klik **Tes cetak**. Kalau baris angka tes terpotong, ubah "Karakter per baris".
4. **Pengaturan → Aplikasi PC Ini**: nyalakan "Buka otomatis saat Windows menyala".

Printer harus mendukung ESC/POS (hampir semua printer kasir thermal). Printer USB perlu drivernya terpasang di Windows (muncul di Settings → Printers). Laci uang disambung ke printer dengan kabel RJ11.

### Mencoba tanpa PC Windows
Di demo (browser), buka panel status koneksi di header → centang **Simulasi aplikasi PC**. Menu Printer & Laci dan Aplikasi PC Ini muncul, hasil cetak tampil di **printer virtual** (kiri bawah).

### Pengembangan
`npm run desktop:dev` (butuh Rust + prasyarat Tauri). Uji Rust: `cd src-tauri && cargo test` (termasuk uji kirim ke printer LAN tiruan).

## Tahap berikutnya
6. Migrasi data & go-live (termasuk perintah owner "Bersihkan transaksi uji coba" dengan backup otomatis).
