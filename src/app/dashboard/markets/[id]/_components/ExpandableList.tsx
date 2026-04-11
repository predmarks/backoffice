'use client';

import { useState, Children, type ReactNode } from 'react';

export function ExpandableList({ children, pageSize = 10 }: { children: ReactNode; pageSize?: number }) {
  const items = Children.toArray(children);
  const [visible, setVisible] = useState(pageSize);
  const remaining = items.length - visible;

  return (
    <>
      {items.slice(0, visible)}
      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setVisible((v) => v + pageSize)}
          className="mt-3 text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
        >
          Mostrar más ({remaining} restantes)
        </button>
      )}
    </>
  );
}
