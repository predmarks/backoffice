'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: string;
}

interface TopicChatProps {
  topicId: string;
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

export function TopicChat({ topicId }: TopicChatProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch(`/api/topics/${topicId}/chat`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations ?? []);
      }
    } catch {
      // ignore
    }
  }, [topicId]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleNewConversation() {
    setActiveConvId(null);
    setMessages([]);
    setError(null);
  }

  function handleLoadConversation(conv: Conversation) {
    setActiveConvId(conv.id);
    setMessages(conv.messages);
    setError(null);
  }

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
      const res = await fetch(`/api/topics/${topicId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages,
          conversationId: activeConvId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error');
      }

      const { conversation, conversationId } = await res.json();
      if (conversation) {
        setMessages(conversation);
      }
      if (conversationId && !activeConvId) {
        setActiveConvId(conversationId);
      }
      fetchConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 flex flex-col h-[calc(100vh-8rem)]">
      {/* Conversation list header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
        <h3 className="text-sm font-medium text-gray-500">Chat</h3>
        <button
          onClick={handleNewConversation}
          className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer"
        >
          + Nueva
        </button>
      </div>

      {/* Past conversations (compact list) */}
      {conversations.length > 0 && (
        <div className="px-2 py-2 border-b border-gray-100 max-h-32 overflow-y-auto shrink-0">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => handleLoadConversation(conv)}
              className={`w-full text-left px-2 py-1 rounded text-xs truncate cursor-pointer transition-colors ${
                activeConvId === conv.id
                  ? 'bg-gray-100 text-gray-900 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {conv.title}
              <span className="text-gray-400 ml-1">{formatTime(conv.updatedAt)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {messages.length === 0 && !loading && (
          <div className="text-sm text-gray-400 text-center py-8">
            Iniciá una conversación sobre este tema
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`text-sm rounded px-3 py-2 ${
              msg.role === 'user'
                ? 'bg-blue-50 text-blue-900 ml-4'
                : 'bg-gray-50 text-gray-700 mr-4 prose prose-sm max-w-none'
            }`}
          >
            {msg.role === 'assistant' ? <ReactMarkdown>{msg.content}</ReactMarkdown> : msg.content}
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
      <div className="px-4 py-3 border-t border-gray-100 shrink-0">
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={messages.length === 0 ? 'Preguntá o comentá sobre este tema...' : 'Responder...'}
            disabled={loading}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-3 py-2 text-sm font-medium rounded-md bg-gray-200 hover:bg-gray-300 text-gray-800 disabled:opacity-50 transition-colors cursor-pointer"
          >
            Enviar
          </button>
        </form>
        {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
      </div>
    </div>
  );
}
