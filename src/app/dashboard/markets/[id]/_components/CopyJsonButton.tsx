'use client';

import { useState } from 'react';

export function CopyJsonButton({ json }: { json: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="px-3 py-1 text-xs font-medium rounded border border-gray-300 hover:bg-gray-50 transition-colors"
    >
      {copied ? 'Copiado' : 'Copiar JSON'}
    </button>
  );
}
