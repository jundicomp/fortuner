import { useQuery } from '@tanstack/react-query';
import { Banknote, Cable, Network, Printer, RefreshCw, Save, Usb, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ErrorBox, Field, PageHeader, Switch } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { ReceiptBody, type ReceiptData } from '@/components/Receipt';
import { useAuth } from '@/auth/AuthContext';
import { useSettings } from '@/lib/queries';
import { colsOf, listPrinters, openDrawer, printerSettings, testPrint, type PrinterSettings } from '@/platform/printer';
import { simDesktop } from '@/platform/desktop';

const AUTO_SPK = 'fortuner-autoprint-spk';
const AUTO_KW = 'fortuner-autoprint-kwitansi';
const lsGet = (k: string, def: boolean) => { try { const v = localStorage.getItem(k); return v === null ? def : v === '1'; } catch { return def; } };
const lsSet = (k: string, v: boolean) => { try { localStorage.setItem(k, v ? '1' : '0'); } catch { /* abaikan */ } };

const SAMPLE: ReceiptData = {
  jenis: 'kwitansi', nomor: 'FT-K1-1026-0014', waktu: new Date().toISOString(), customer: 'Contoh Konsumen', cs: 'Sari',
  items: [{ nama: 'Art carton 260 A3+', qty: 50, harga: 2100, subtotal: 105000 }, { nama: 'Stiker kromo + cutting', qty: 20, harga: 4000, subtotal: 80000 }],
  total: 185000, payments: [{ label: 'Bayar Tunai', nominal: 185000 }], sisa: 0, diterima: 200000, kembalian: 15000,
};

/**
 * Printer struk & laci uang untuk PC ini. Disimpan di PC (bukan server) karena tiap meja punya printer sendiri.
 * Owner/admin (hak ubah Perangkat) bisa mengubah; user lain hanya bisa melihat dan tes cetak.
 */
export function PrinterPage() {
  const { can } = useAuth();
  const toast = useToast();
  const settings = useSettings();
  const ro = !can('pengaturan.perangkat', 'ubah');
  const [f, setF] = useState<PrinterSettings>(printerSettings.get());
  const [saved, setSaved] = useState(JSON.stringify(printerSettings.get()));
  const [autoSpk, setAutoSpk] = useState(lsGet(AUTO_SPK, false));
  const [autoKw, setAutoKw] = useState(lsGet(AUTO_KW, true));
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState<unknown>(null);
  const printers = useQuery({ queryKey: ['printers'], queryFn: listPrinters, retry: 0, staleTime: 60e3 });
  const set = <K extends keyof PrinterSettings>(k: K, v: PrinterSettings[K]) => setF((x) => ({ ...x, [k]: v }));
  const dirty = JSON.stringify(f) !== saved;
  const shop = settings.data?.nama_usaha || 'Fortuner';
  useEffect(() => { if (!f.printer && printers.data?.length && !ro) { const pos = printers.data.find((p) => /pos|thermal|receipt|58|80|tm-/i.test(p)); if (pos) set('printer', pos); } }, [printers.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => { printerSettings.set(f); setSaved(JSON.stringify(f)); toast('Pengaturan printer disimpan di PC ini'); };
  const run = async (key: string, fn: () => Promise<void>, ok: string) => {
    setErr(null); setBusy(key);
    try { await fn(); toast(ok); } catch (e) { setErr(e); } finally { setBusy(''); }
  };
  const ready = f.koneksi === 'usb' ? !!f.printer : !!f.host.trim();

  return (
    <>
      <PageHeader title="Printer & Laci" desc={<>Pengaturan ini tersimpan di PC ini saja. Struk dan SPK dicetak langsung ke printer thermal tanpa jendela print.{ro && <b className="text-warn"> Hanya owner/admin yang bisa mengubah; Anda tetap bisa tes cetak.</b>}</>}
        actions={!ro && <button id="printer-save" className="btn btn-primary" disabled={!dirty} onClick={save}><Save size={15} />{dirty ? 'Simpan' : 'Tersimpan'}</button>} />
      {simDesktop.get() && <div className="mb-4 rounded-lg border border-dashed border-brand/50 bg-brand/5 px-4 py-2.5 text-sm">Simulasi aplikasi PC: daftar printer dan hasil cetak memakai <b>printer virtual</b> (lihat panel di kiri bawah).</div>}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr_auto]">
        <section className="card flex flex-col gap-4 p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold"><Printer size={16} />Printer struk</h2>
          <div>
            <div className="mb-1.5 text-[13px] font-semibold">Sambungan</div>
            <div className="grid grid-cols-2 gap-2" role="group">
              {([['usb', 'USB', Usb], ['lan', 'LAN / Wi-Fi', Network]] as const).map(([k, l, I]) => (
                <button key={k} id={`pr-koneksi-${k}`} type="button" disabled={ro} onClick={() => set('koneksi', k)} className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${f.koneksi === k ? 'border-brand bg-brand text-white' : 'border-line'}`}><I size={15} />{l}</button>
              ))}
            </div>
          </div>
          {f.koneksi === 'usb' ? (
            <Field label="Printer" hint={printers.error ? `Daftar printer tidak terbaca: ${(printers.error as Error).message}` : 'Printer yang terpasang di Windows. Printer thermal baru: pasang driver bawaannya dulu.'}>
              <div className="flex gap-2">
                <select id="pr-printer" className="input" disabled={ro} value={f.printer} onChange={(e) => set('printer', e.target.value)}>
                  <option value="">– pilih printer –</option>
                  {(printers.data || []).map((p) => <option key={p} value={p}>{p}</option>)}
                  {f.printer && !(printers.data || []).includes(f.printer) && <option value={f.printer}>{f.printer} (tidak terdeteksi)</option>}
                </select>
                <button type="button" className="btn shrink-0 px-2.5" title="Cari ulang printer" onClick={() => printers.refetch()}><RefreshCw size={15} className={printers.isFetching ? 'animate-spin' : ''} /></button>
              </div>
            </Field>
          ) : (
            <div className="grid grid-cols-[1fr_90px] gap-3">
              <Field label="Alamat IP printer" hint="Lihat di struk self-test printer (tahan tombol FEED saat menyalakan)."><input id="pr-host" className="input font-mono" disabled={ro} placeholder="192.168.1.50" value={f.host} onChange={(e) => set('host', e.target.value.trim())} /></Field>
              <Field label="Port"><input id="pr-port" className="input font-mono" disabled={ro} inputMode="numeric" value={f.port} onChange={(e) => set('port', Number(e.target.value.replace(/\D/g, '')) || 9100)} /></Field>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Lebar kertas">
              <div className="grid grid-cols-2 gap-1.5">
                {([58, 80] as const).map((w) => <button key={w} id={`pr-lebar-${w}`} type="button" disabled={ro} onClick={() => set('lebar', w)} className={`rounded-lg border py-2 text-sm font-semibold ${f.lebar === w ? 'border-brand bg-brand text-white' : 'border-line'}`}>{w} mm</button>)}
              </div>
            </Field>
            <Field label="Karakter per baris" hint={`Sekarang ${colsOf(f)}. Ganti kalau baris tes terpotong.`}>
              <select id="pr-kolom" className="input" disabled={ro} value={f.kolom} onChange={(e) => set('kolom', Number(e.target.value))}>
                <option value={0}>Otomatis</option><option value={32}>32 (58 mm)</option><option value={42}>42</option><option value={48}>48 (80 mm)</option>
              </select>
            </Field>
            <Field label="Salinan SPK (FO)"><input id="pr-sal-spk" className="input" type="number" min={1} max={3} disabled={ro} value={f.salinan_spk} onChange={(e) => set('salinan_spk', Math.max(1, Math.min(3, Number(e.target.value) || 1)))} /></Field>
            <Field label="Salinan kwitansi"><input id="pr-sal-kw" className="input" type="number" min={1} max={3} disabled={ro} value={f.salinan_kwitansi} onChange={(e) => set('salinan_kwitansi', Math.max(1, Math.min(3, Number(e.target.value) || 1)))} /></Field>
          </div>
          <Switch id="pr-barcode" disabled={ro} checked={f.barcode} onChange={(v) => set('barcode', v)} label="Barcode nomor nota di SPK (untuk discan kasir)" />
          <Switch id="pr-potong" disabled={ro} checked={f.potong} onChange={(v) => set('potong', v)} label="Potong kertas otomatis (printer dengan auto-cutter)" />
          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            <button id="pr-test" className="btn btn-dark" disabled={!ready || !!busy} onClick={() => run('test', () => testPrint(shop, f), `Tes cetak dikirim ke ${f.koneksi === 'lan' ? f.host : f.printer}`)}><Printer size={15} />{busy === 'test' ? 'Mengirim…' : 'Tes cetak'}</button>
            {!ready && <span className="self-center text-xs text-muted">{f.koneksi === 'usb' ? 'Pilih printer dulu.' : 'Isi IP printer dulu.'}</span>}
          </div>
        </section>

        <div className="flex flex-col gap-4">
          <section className="card flex flex-col gap-3 p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold"><Banknote size={16} />Laci uang</h2>
            <p className="-mt-1 text-xs text-muted"><Cable size={12} className="mr-1 inline" />Laci disambung ke printer dengan kabel RJ11; printer yang mengirim sinyal buka.</p>
            <Switch id="pr-laci" disabled={ro} checked={f.laci} onChange={(v) => set('laci', v)} label="PC ini memakai laci uang" />
            <Switch id="pr-laci-tunai" disabled={ro || !f.laci} checked={f.laci_tunai} onChange={(v) => set('laci_tunai', v)} label="Buka otomatis saat pembayaran tunai (transfer/QRIS tidak)" />
            <Switch id="pr-laci-manual" disabled={ro || !f.laci} checked={f.laci_manual} onChange={(v) => set('laci_manual', v)} label='Tampilkan tombol "Buka laci" di halaman Kasir' />
            <button id="pr-test-laci" className="btn self-start" disabled={!ready || !f.laci || !!busy} onClick={() => run('laci', () => openDrawer(f), 'Perintah buka laci dikirim')}><Zap size={15} />Tes buka laci</button>
          </section>
          <section className="card flex flex-col gap-3 p-5">
            <h2 className="text-sm font-bold">Cetak otomatis</h2>
            <Switch id="pr-auto-spk" checked={autoSpk} onChange={(v) => { setAutoSpk(v); lsSet(AUTO_SPK, v); }} label="Front Office: cetak SPK setelah nota disimpan" />
            <Switch id="pr-auto-kw" checked={autoKw} onChange={(v) => { setAutoKw(v); lsSet(AUTO_KW, v); }} label="Kasir: cetak kwitansi setelah pembayaran" />
            <p className="text-xs text-muted">Sama dengan centang "cetak otomatis" di halaman FO dan Kasir.</p>
          </section>
          <ErrorBox error={err} />
        </div>

        <section className="card hidden self-start p-4 xl:block">
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Pratinjau {f.lebar} mm</div>
          <div className="bg-white p-3 shadow-inner" style={{ width: f.lebar === 58 ? 230 : 310 }}><ReceiptBody d={SAMPLE} shop={{ nama: shop, alamat: settings.data?.alamat, telp: settings.data?.telp, catatan: settings.data?.catatan_struk }} width={f.lebar} /></div>
        </section>
      </div>
      {!ro && dirty && <div className="mt-4 text-right text-sm font-semibold text-warn">Ada perubahan yang belum disimpan.</div>}
    </>
  );
}
