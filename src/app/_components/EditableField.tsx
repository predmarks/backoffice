'use client';

import { useState, useRef, useEffect } from 'react';
import { Markdown } from './Markdown';

interface EditableFieldProps {
  marketId: string;
  field: string;
  value: string;
  type?: 'text' | 'textarea' | 'datetime' | 'date';
  className?: string;
  displayValue?: string;
  renderMarkdown?: boolean;
}

export function EditableField({
  marketId,
  field,
  value,
  type = 'text',
  className = '',
  displayValue,
  renderMarkdown = false,
}: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if ('select' in inputRef.current) inputRef.current.select();
    }
  }, [editing]);

  async function save() {
    if (current === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      let payload: Record<string, unknown> = { [field]: current };
      if (field === 'endTimestamp') {
        payload = { endTimestamp: Math.floor(new Date(current).getTime() / 1000) };
      }
      const res = await fetch(`/api/markets/${marketId}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Save failed');
      setEditing(false);
      window.location.reload();
    } catch {
      // revert on error
      setCurrent(value);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setCurrent(value);
      setEditing(false);
    }
    if (e.key === 'Enter' && type !== 'textarea') {
      save();
    }
  }

  if (!editing) {
    return (
      <div
        onClick={() => setEditing(true)}
        className={`cursor-pointer hover:bg-yellow-50 hover:outline hover:outline-1 hover:outline-yellow-300 rounded px-0.5 -mx-0.5 transition-colors ${className}`}
        title="Click para editar"
      >
        {displayValue
          ? <span>{displayValue}</span>
          : current
            ? (renderMarkdown ? <Markdown>{current}</Markdown> : <span>{current}</span>)
            : <span className="text-gray-400 italic">Sin contenido</span>
        }
      </div>
    );
  }

  const inputClass = 'w-full px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400';

  return (
    <div className="space-y-1">
      {type === 'textarea' ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={save}
          disabled={saving}
          rows={4}
          className={inputClass}
        />
      ) : type === 'datetime' ? (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="datetime-local"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={save}
          disabled={saving}
          className={inputClass}
        />
      ) : type === 'date' ? (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="date"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={save}
          disabled={saving}
          className={inputClass}
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={save}
          disabled={saving}
          className={inputClass}
        />
      )}
    </div>
  );
}
