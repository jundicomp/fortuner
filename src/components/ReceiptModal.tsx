import { ImageDown, Loader2, MessageCircle, Printer } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { ReceiptBody, type ReceiptData, type ReceiptShop } from '@/components/Receipt';
import { saveReceiptImage, shareReceiptWa, waNumber } from '@/lib/share';

interface Props {
  d: ReceiptData; shop: ReceiptShop; width: 58 | 80;
  title: ReactNode; subtitle?: ReactNode; children?: ReactNode;
  printLabel: string; onPrint: () => void;
  closeLabel: ReactNode; onClose: () => void;
  waTemplate?: string;
}

/**
 * Pratinjau nota sebagai informasi akhir + tombol Cetak, Kirim ke WhatsApp, Simpan JPEG.
 * Dipakai FO (setelah nota terbit), Kasir (setelah bayar), dan detail order (cetak ulang).
 */
export function ReceiptModal({ d, shop, width, title, subtitle, children, printLabel, onPrint, closeLabel, onClose, waTemplate }: Props) {
  const toast = useToast();
  const paper = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<'' | 'wa' | 'img'>('');
  const wa = waNumber(d.telp);

  const sendWa = async () => {
    if (!paper.current || busy) return;
    setBusy('wa');
    try {
      const r = await shareReceiptWa(paper.current, d, shop, waTemplate);
      if (r.mode === 'link') toast(r.copied ? 'WhatsApp dibuka. Gambar nota sudah tersalin: tempel (Ctrl+V) di chat lalu kirim.' : 'WhatsApp dibuka. Lampirkan gambar nota yang baru disimpan di folder Downloads.');
    } catch (e) { toast((e as Error).message || 'Gagal membuka WhatsApp.', 'err'); } finally { setBusy(''); }
  };
  const saveImg = async () => {
    if (!paper.current || busy) return;
    setBusy('img');
    try { const p = await saveReceiptImage(paper.current, d); toast(`Gambar disimpan: ${p.split(/[\\/]/).pop()}`); }
    catch (e) { toast((e as Error).message || 'Gagal menyimpan gambar.', 'err'); } finally { setBusy(''); }
  };

  return (
    <Modal open onClose={onClose} size="lg" title={title} subtitle={subtitle}>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex justify-center rounded-xl bg-sunk p-4">
          <div className="max-h-[62vh] overflow-y-auto shadow-lg">
            <div ref={paper} id="receipt-paper" className="bg-white p-4" style={{ width: width === 58 ? 250 : 330 }}>
              <ReceiptBody d={d} shop={shop} width={width} />
            </div>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-2.5">
          {children}
          <button id="rcpt-print" className="btn btn-dark mt-1 py-3 text-base" onClick={onPrint} autoFocus><Printer size={18} />{printLabel}</button>
          <button id="rcpt-wa" className="btn btn-wa py-3 text-base" onClick={sendWa} disabled={!wa || !!busy} title={wa ? '' : 'Nomor WhatsApp konsumen belum diisi'}>
            {busy === 'wa' ? <Loader2 size={18} className="animate-spin" /> : <MessageCircle size={18} />}
            {wa ? `Kirim ke WhatsApp · ${d.telp}` : 'WhatsApp (nomor belum ada)'}
          </button>
          <button id="rcpt-img" className="btn py-2.5" onClick={saveImg} disabled={!!busy}>
            {busy === 'img' ? <Loader2 size={16} className="animate-spin" /> : <ImageDown size={16} />}Simpan gambar (JPEG)
          </button>
          <p className="text-[11px] leading-relaxed text-muted">
            {wa ? 'WhatsApp terbuka ke nomor konsumen dengan pesan siap kirim. Gambar nota ikut tersalin, tinggal tempel (Ctrl+V) lalu kirim.' : 'Isi nomor telepon/WA di data konsumen supaya nota bisa dikirim lewat WhatsApp.'}
          </p>
          <button id="rcpt-close" className="btn btn-ghost mt-auto" onClick={onClose}>{closeLabel} <span className="kbd">Esc</span></button>
        </div>
      </div>
    </Modal>
  );
}
