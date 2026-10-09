import { useEffect, useState } from 'react';
import { Banknote, ChevronDown, ChevronUp, Printer, Scissors, Trash2 } from 'lucide-react';
import { simDesktop, virtualPrinter } from '@/platform/desktop';

/** Printer virtual untuk simulasi aplikasi PC (mode demo): menampilkan hasil cetak ESC/POS sebagai teks. */
export function VirtualPrinterDock() {
  const [, force] = useState(0);
  const [open, setOpen] = useState(false);
  const [fresh, setFresh] = useState(false);
  // Tidak membuka sendiri supaya tidak menutupi tombol; cukup berkedip saat ada cetakan baru.
  useEffect(() => virtualPrinter.subscribe(() => { force((n) => n + 1); setFresh(true); }), []);
  if (!simDesktop.get()) return null;
  const jobs = virtualPrinter.jobs();
  const last = jobs[0];
  return (
    <div id="vprinter" className="no-print fixed bottom-4 left-4 z-[70] max-sm:hidden w-[min(300px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-surface shadow-xl lg:w-[224px]">
      <button id="vprinter-toggle" className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold" onClick={() => { setOpen((o) => !o); setFresh(false); }}>
        <Printer size={14} className={`text-brand ${fresh && !open ? 'animate-bounce' : ''}`} />Printer virtual <span className="font-normal text-muted">({jobs.length} cetakan)</span>
        <span className="ml-auto">{open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}</span>
      </button>
      {open && (
        <div className="border-t border-line">
          {!last ? <p className="p-3 text-xs text-muted">Belum ada yang dicetak.</p> : (
            <>
              <div className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-muted">
                <span className="truncate">{last.target}</span>
                {last.drawer && <span className="pill pill-ok"><Banknote size={11} />laci</span>}
                {last.cut && <span className="pill pill-mute"><Scissors size={11} />potong</span>}
                <button className="ml-auto" title="Bersihkan" onClick={() => virtualPrinter.clear()}><Trash2 size={13} /></button>
              </div>
              <pre id="vprinter-last" className="max-h-[50vh] overflow-auto whitespace-pre bg-white px-3 py-2 font-mono text-[10px] leading-tight text-black">{last.text}</pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}
