import { isDesktop } from '@/platform/desktop';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { MENU, type MenuGroup, type MenuItem } from './menu';
import { useAuth } from '@/auth/AuthContext';

interface Props { collapsed: boolean; mobileOpen: boolean; onCloseMobile: () => void; appName: string }

const isActivePath = (path: string, current: string) => (path === '/' ? current === '/' : current.startsWith(path));

/**
 * Sidebar tanpa gulir:
 * - Grup yang isinya lebih dari satu menu dibuat akordeon; hanya satu grup terbuka sekaligus (grup halaman aktif terbuka otomatis).
 * - Mode ikon (lebar 72px): tiap grup jadi satu ikon; menu di dalamnya muncul sebagai panel di samping saat ikon disentuh/diarahkan.
 */
export function Sidebar({ collapsed, mobileOpen, onCloseMobile, appName }: Props) {
  const { can } = useAuth();
  const { pathname } = useLocation();
  const groups = MENU.map((g) => ({ ...g, items: g.items.filter((i) => can(i.perm) && (!i.desktop || isDesktop())) })).filter((g) => g.items.length);
  const narrow = collapsed && !mobileOpen; // drawer HP selalu lebar penuh
  const activeGroup = groups.find((g) => g.items.some((i) => isActivePath(i.path, pathname)))?.label || '';
  const [openGroup, setOpenGroup] = useState(activeGroup);
  const [flyout, setFlyout] = useState('');

  useEffect(() => { setOpenGroup(activeGroup); setFlyout(''); }, [activeGroup, pathname]);

  return (
    <>
      <div className={`fixed inset-0 z-30 bg-black/50 lg:hidden ${mobileOpen ? '' : 'hidden'}`} onClick={onCloseMobile} />
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-side text-side-ink transition-[width,transform] duration-200
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 ${narrow ? 'lg:w-[72px]' : 'lg:w-[248px]'} w-[264px]`}
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Menu utama"
      >
        <div className={`flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-5 ${narrow ? 'lg:justify-center lg:px-0' : ''}`}>
          <Logo />
          <div className={`min-w-0 ${narrow ? 'lg:hidden' : ''}`}>
            <div className="truncate text-[15px] font-extrabold leading-tight text-white">{appName}</div>
            <div className="text-[11px] font-medium text-white/50">Sistem percetakan</div>
          </div>
          <button className="ml-auto rounded-lg p-1.5 text-white/60 hover:bg-white/10 lg:hidden" onClick={onCloseMobile} aria-label="Tutup menu"><X size={18} /></button>
        </div>

        {/* overflow-y-auto hanya cadangan untuk layar yang sangat pendek; pada tinggi normal menu muat tanpa gulir */}
        <nav className={`flex flex-1 flex-col gap-0.5 py-3 ${narrow ? 'lg:overflow-visible' : 'overflow-y-auto overflow-x-hidden'} [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
          {groups.map((g) =>
            g.items.length === 1 ? (
              <Link key={g.label} item={g.items[0]} narrow={narrow} onNavigate={onCloseMobile} />
            ) : narrow ? (
              <FlyoutGroup key={g.label} group={g} active={g.label === activeGroup} open={flyout === g.label}
                onOpen={() => setFlyout(g.label)} onClose={() => setFlyout((f) => (f === g.label ? '' : f))} onNavigate={onCloseMobile} />
            ) : (
              <AccordionGroup key={g.label} group={g} active={g.label === activeGroup} open={openGroup === g.label}
                onToggle={() => setOpenGroup((o) => (o === g.label ? '' : g.label))} onNavigate={onCloseMobile} />
            ),
          )}
        </nav>
      </aside>
    </>
  );
}

const linkBase = 'group relative mx-3 flex items-center gap-3 rounded-lg px-3 text-[13.5px] font-semibold transition';

function Link({ item, narrow, onNavigate, nested }: { item: MenuItem; narrow?: boolean; onNavigate: () => void; nested?: boolean }) {
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      onClick={onNavigate}
      className={({ isActive }) =>
        `${linkBase} ${nested ? 'py-[7px] pl-11 text-[13px]' : 'py-2'} ${isActive ? 'bg-brand text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'} ${narrow ? 'lg:justify-center lg:px-0' : ''}`
      }
    >
      {!nested && <item.icon size={19} className="shrink-0" strokeWidth={2} />}
      <span className={`truncate ${narrow ? 'lg:hidden' : ''}`}>{item.label}</span>
      {item.tahap && <span className={`ml-auto rounded bg-white/10 px-1.5 text-[10px] font-bold text-white/50 ${narrow ? 'lg:hidden' : ''}`}>T{item.tahap}</span>}
      {narrow && <Tip>{item.label}</Tip>}
    </NavLink>
  );
}

function AccordionGroup({ group, active, open, onToggle, onNavigate }: { group: MenuGroup; active: boolean; open: boolean; onToggle: () => void; onNavigate: () => void }) {
  const Icon = group.icon || group.items[0].icon;
  return (
    <div>
      <button type="button" onClick={onToggle} aria-expanded={open}
        className={`${linkBase} w-[calc(100%-1.5rem)] py-2 ${active && !open ? 'text-brand' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}>
        <Icon size={19} className="shrink-0" strokeWidth={2} />
        <span className="truncate">{group.label}</span>
        {active && !open && <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />}
        <ChevronDown size={15} className={`ml-auto shrink-0 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`grid transition-[grid-template-rows] duration-200 ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="flex flex-col gap-0.5 pb-1 pt-0.5">
            {group.items.map((i) => <Link key={i.path} item={i} nested onNavigate={onNavigate} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

function FlyoutGroup({ group, active, open, onOpen, onClose, onNavigate }: { group: MenuGroup; active: boolean; open: boolean; onOpen: () => void; onClose: () => void; onNavigate: () => void }) {
  const Icon = group.icon || group.items[0].icon;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open, onClose]);
  return (
    <div ref={ref} className="relative" onMouseEnter={onOpen} onMouseLeave={onClose}>
      <button type="button" onClick={() => (open ? onClose() : onOpen())} aria-expanded={open} aria-label={group.label}
        className={`${linkBase} w-[calc(100%-1.5rem)] justify-center px-0 py-2 ${active ? 'bg-brand text-white' : open ? 'bg-white/10 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}>
        <Icon size={19} strokeWidth={2} />
      </button>
      {open && (
        // pl-3 = jembatan tak terlihat supaya kursor bisa pindah ke panel tanpa menutupnya
        <div className="absolute left-full top-0 z-50 pl-3">
          <div className="w-56 rounded-xl border border-white/10 bg-side py-2 shadow-2xl">
            <div className="px-4 pb-1.5 pt-0.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-white/40">{group.label}</div>
            {group.items.map((i) => (
              <NavLink key={i.path} to={i.path} onClick={() => { onClose(); onNavigate(); }}
                className={({ isActive }) => `mx-2 flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-semibold ${isActive ? 'bg-brand text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}>
                <i.icon size={17} className="shrink-0" />
                <span className="truncate">{i.label}</span>
                {i.tahap && <span className="ml-auto rounded bg-white/10 px-1.5 text-[10px] font-bold text-white/50">T{i.tahap}</span>}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-ink px-2.5 py-1.5 text-xs font-semibold text-canvas opacity-0 shadow-lg transition group-hover:opacity-100 lg:block">
      {children}
    </span>
  );
}

export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="shrink-0">
      <rect width="40" height="40" rx="10" fill="#F26B1D" />
      <path d="M12 11h16v4.2H17v4.3h9.5v4.2H17V30h-5z" fill="#fff" />
      <circle cx="29" cy="28" r="3" fill="#111" />
    </svg>
  );
}
