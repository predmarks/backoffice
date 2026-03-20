'use client';

import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface FeedbackEntry {
  text: string;
  createdAt: string;
  conversation: ChatMessage[] | null;
}

interface HumanFeedbackProps {
  marketId: string;
  feedback: FeedbackEntry[];
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date(iso));
}

export function HumanFeedback({ marketId, feedback }: HumanFeedbackProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: input.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/markets/${marketId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error');
      }

      const { reply, conversation } = await res.json();
      // Use the full conversation from server (includes assistant reply)
      if (conversation) {
        setMessages(conversation);
      } else {
        setMessages([...updatedMessages, { role: 'assistant', content: reply }]);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  // Combine saved conversations and current messages for display
  const savedConversations = feedback.filter((f) => f.conversation && f.conversation.length > 0);
  const hasCurrentChat = messages.length > 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col">
      <h3 className="text-sm font-medium text-gray-500 mb-3">Feedback</h3>

      <div className="space-y-3 mb-3 overflow-y-auto max-h-[60vh]">
        {/* Saved conversations */}
        {savedConversations.map((entry, i) => (
          <div key={i}>
            <p className="text-xs text-gray-400 mb-1">{formatTime(entry.createdAt)}</p>
            <div className="space-y-1.5">
              {entry.conversation!.map((msg, j) => (
                <div
                  key={j}
                  className={`text-sm rounded px-3 py-2 ${
                    msg.role === 'user'
                      ? 'bg-blue-50 text-blue-900 ml-4'
                      : 'bg-gray-50 text-gray-700 mr-4'
                  }`}
                >
                  {msg.content}
                </div>
              ))}
            </div>
            {i < savedConversations.length - 1 && (
              <hr className="my-3 border-gray-100" />
            )}
          </div>
        ))}

        {/* Saved feedback without conversations (legacy) */}
        {feedback.filter((f) => !f.conversation || f.conversation.length === 0).map((entry, i) => (
          <div key={`legacy-${i}`} className="text-sm bg-gray-50 rounded p-2">
            <p className="text-gray-700">{entry.text}</p>
            <p className="text-xs text-gray-400 mt-1">{formatTime(entry.createdAt)}</p>
          </div>
        ))}

        {/* Separator between saved and current */}
        {savedConversations.length > 0 && hasCurrentChat && (
          <hr className="my-2 border-gray-200" />
        )}

        {/* Current chat messages */}
        {messages.map((msg, i) => (
          <div
            key={`current-${i}`}
            className={`text-sm rounded px-3 py-2 ${
              msg.role === 'user'
                ? 'bg-blue-50 text-blue-900 ml-4'
                : 'bg-gray-50 text-gray-700 mr-4'
            }`}
          >
            {msg.content}
          </div>
        ))}

        {loading && (
          <div className="text-sm text-gray-400 mr-4 px-3 py-2">
            Pensando...
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={messages.length === 0 ? 'Dar feedback...' : 'Responder...'}
          disabled={loading}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-3 py-2 text-sm font-medium rounded-md bg-gray-200 hover:bg-gray-300 text-gray-800 disabled:opacity-50 transition-colors"
        >
          Enviar
        </button>
      </form>
      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
    </div>
  );
}
