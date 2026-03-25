'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { logout } from '../login/actions';

const MERCADOS_LINKS = [
  { href: '/dashboard', label: 'Candidatos' },
  { href: '/dashboard/proposals', label: 'Propuestas' },
  { href: '/dashboard/open', label: 'Abiertos' },
  { href: '/dashboard/resolution', label: 'Resolucion' },
  { href: '/dashboard/archive', label: 'Archivo' },
];

const MERCADOS_PATHS = MERCADOS_LINKS.map((l) => l.href);

export function Nav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  // Close menu on navigation
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const isMercadosActive = MERCADOS_PATHS.some((p) =>
    p === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(p)
  );

  function navLink(href: string, label: string) {
    const isActive = href === pathname;
    return (
      <Link
        key={href}
        href={href}
        className={`text-sm ${isActive ? 'text-gray-900 font-medium' : 'text-gray-600 hover:text-gray-900'}`}
      >
        {label}
      </Link>
    );
  }

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3">
      <div className="flex items-center gap-6">
        <Link href="/dashboard" className="text-lg font-bold text-gray-900">
          Predmarks
        </Link>

        {navLink('/dashboard/signals', 'Senales')}
        {navLink('/dashboard/topics', 'Temas')}

        {/* Mercados dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className={`text-sm flex items-center gap-1 ${
              isMercadosActive ? 'text-gray-900 font-medium' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Mercados
            <span className="text-[10px]">{menuOpen ? '\u25B2' : '\u25BC'}</span>
          </button>
          {menuOpen && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg py-1 min-w-[160px] z-50">
              {MERCADOS_LINKS.map(({ href, label }) => {
                const isActive = href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`block px-4 py-1.5 text-sm ${
                      isActive
                        ? 'bg-gray-50 text-gray-900 font-medium'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {navLink('/dashboard/feedback', 'Feedback')}

        <form action={logout} className="ml-auto">
          <button
            type="submit"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Salir
          </button>
        </form>
      </div>
    </nav>
  );
}
