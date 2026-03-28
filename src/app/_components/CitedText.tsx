'use client';

import React from 'react';

const CITE_REGEX = /<cite\s+index="([^"]*)">([\s\S]*?)<\/cite>/g;

export function CitedText({ children, className }: { children: string; className?: string }) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = CITE_REGEX.exec(children)) !== null) {
    if (match.index > lastIndex) {
      parts.push(children.slice(lastIndex, match.index));
    }
    parts.push(
      <span key={match.index} className="bg-blue-50 border-b border-blue-200 rounded-sm px-0.5">
        {match[2]}
      </span>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < children.length) {
    parts.push(children.slice(lastIndex));
  }

  // Reset regex state
  CITE_REGEX.lastIndex = 0;

  return <span className={className}>{parts}</span>;
}
