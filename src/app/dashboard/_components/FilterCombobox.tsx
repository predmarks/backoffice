'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

export interface FilterGroup {
  key: string;
  label: string;
  options: { value: string; label: string; count: number }[];
}

export interface ActiveFilter {
  group: string;
  value: string;
  label: string;
}

interface FilterComboboxProps {
  groups: FilterGroup[];
  active: ActiveFilter[];
  onSelect: (group: string, value: string) => void;
  onRemove: (group: string) => void;
  placeholder?: string;
}

export function FilterCombobox({ groups, active, onSelect, onRemove, placeholder = 'Filtrar...' }: FilterComboboxProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const strip = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  // Build flat list of filtered options for keyboard nav
  const filtered = groups.flatMap(g => {
    const q = strip(query);
    const opts = g.options.filter(o => strip(o.label).includes(q));
    if (opts.length === 0) return [];
    return [
      { type: 'header' as const, group: g.key, label: g.label },
      ...opts.map(o => ({ type: 'option' as const, group: g.key, ...o })),
    ];
  });

  const optionItems = filtered.filter(f => f.type === 'option') as (
    { type: 'option'; group: string; value: string; label: string; count: number }
  )[];

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIdx < 0 || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${highlightIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightIdx]);

  const handleSelect = useCallback((group: string, value: string) => {
    onSelect(group, value);
    setQuery('');
    setOpen(false);
    setHighlightIdx(-1);
  }, [onSelect]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      setHighlightIdx(-1);
      return;
    }
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx(i => Math.min(i + 1, optionItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && highlightIdx >= 0 && highlightIdx < optionItems.length) {
      e.preventDefault();
      const item = optionItems[highlightIdx];
      handleSelect(item.group, item.value);
    }
  };

  // Map option items to their flat index for data-idx
  let optionCounter = -1;

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2 flex-wrap">
        {active.map(a => (
          <span
            key={a.group}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-gray-800 text-white"
          >
            {a.label}
            <button
              onClick={() => onRemove(a.group)}
              className="hover:text-gray-300 cursor-pointer"
              aria-label={`Quitar filtro ${a.label}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlightIdx(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={active.length > 0 ? 'Agregar filtro...' : placeholder}
          className="flex-1 min-w-[180px] px-3 py-1.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-gray-400"
        />
      </div>

      {open && filtered.length > 0 && (
        <div
          ref={listRef}
          className="absolute z-50 mt-1 w-full max-h-72 overflow-auto bg-white border border-gray-200 rounded-lg shadow-lg"
        >
          {filtered.map((item, i) => {
            if (item.type === 'header') {
              return (
                <div key={`h-${item.group}`} className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 bg-gray-50 sticky top-0">
                  {item.label}
                </div>
              );
            }
            optionCounter++;
            const idx = optionCounter;
            const isActive = active.some(a => a.group === item.group && a.value === item.value);
            return (
              <button
                key={`${item.group}-${item.value}`}
                data-idx={idx}
                onClick={() => handleSelect(item.group, item.value)}
                className={`w-full text-left px-3 py-1.5 text-sm cursor-pointer flex items-center justify-between ${
                  idx === highlightIdx ? 'bg-gray-100' : 'hover:bg-gray-50'
                } ${isActive ? 'font-medium text-gray-900' : 'text-gray-600'}`}
              >
                <span>{item.label}</span>
                <span className="text-xs text-gray-400">{item.count.toLocaleString()}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
