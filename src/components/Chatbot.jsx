import { useEffect, useRef, useState } from 'react';
import { MessageCircle, RotateCcw, Send, Sparkles, X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const historyKey = 'glossedbyridhi-chat-history';
const greeting = {
  id: 'welcome',
  role: 'assistant',
  content: "Hi, lovely! I'm your GlossedByRidhi style assistant. Ask me about nail designs, services, or getting ready for an appointment.",
};

function loadHistory() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(historyKey) || 'null');
    if (
      Array.isArray(saved) &&
      saved.every(
        (message) =>
          message &&
          (message.role === 'user' || message.role === 'assistant') &&
          typeof message.content === 'string',
      )
    ) {
      return saved.length ? saved : [greeting];
    }
  } catch (error) {
    console.error('Unable to load chat history:', error);
  }

  return [greeting];
}

export default function Chatbot() {
  const [messages, setMessages] = useState(loadHistory);
  const [isOpen, setIsOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [draft, setDraft] = useState('');
  const transcriptRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(historyKey, JSON.stringify(messages));
      setHistoryError('');
    } catch (storageError) {
      console.error('Unable to save chat history:', storageError);
      setHistoryError('Your chat is available until you leave this page, but could not be saved for this session.');
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight });
      inputRef.current?.focus();
    }
  }, [isOpen, messages, isSending]);

  async function sendMessage(value, appendUser = true) {
    const message = value.trim();
    if (!message || isSending) return;

    if (appendUser) {
      setMessages((current) => [
        ...current,
        { id: `${Date.now()}-user`, role: 'user', content: message },
      ]);
      setDraft('');
    }
    setError('');
    setIsSending(true);

    try {
      const priorMessages = messages.filter(
        (previousMessage) => previousMessage.id !== greeting.id,
      );
      if (
        !appendUser &&
        priorMessages.at(-1)?.role === 'user' &&
        priorMessages.at(-1)?.content === message
      ) {
        priorMessages.pop();
      }
      const history = priorMessages
        .slice(-10)
        .map(({ role, content }) => ({ role, content }));
      const { data, error: invocationError } = await supabase.functions.invoke(
        'glossedbyridhi-chat',
        { body: { message, history } },
      );

      if (invocationError) {
        throw new Error(invocationError.message || 'Unable to reach the chat service.');
      }
      if (typeof data?.reply !== 'string' || !data.reply.trim()) {
        throw new Error(data?.error || 'The chat service returned an empty reply. Please try again.');
      }

      setMessages((current) => [
        ...current,
        { id: `${Date.now()}-assistant`, role: 'assistant', content: data.reply.trim() },
      ]);
    } catch (requestError) {
      console.error('Chat request failed:', requestError);
      setError(requestError instanceof Error ? requestError.message : 'Your message could not be sent. Please try again.');
    } finally {
      setIsSending(false);
    }
  }

  function startNewChat() {
    setMessages([greeting]);
    setError('');
    setDraft('');
    try {
      sessionStorage.removeItem(historyKey);
    } catch (storageError) {
      console.error('Unable to clear chat history:', storageError);
      setHistoryError('Chat history could not be cleared from this session.');
    }
  }

  return (
    <aside className="chatbot" aria-label="GlossedByRidhi chat assistant">
      {isOpen && (
        <section id="chat-panel" className="chat-panel" role="dialog" aria-modal="false" aria-labelledby="chat-title">
          <header className="chat-header">
            <div className="chat-brand">
              <span className="chat-avatar"><Sparkles size={18} aria-hidden="true" /></span>
              <div>
                <h2 id="chat-title">A little nail talk</h2>
                <p><span className="chat-online" /> GlossedByRidhi assistant</p>
              </div>
            </div>
            <div className="chat-header-actions">
              <button type="button" className="chat-icon-button" onClick={startNewChat} aria-label="Start a new chat" title="Start a new chat" disabled={isSending}>
                <RotateCcw size={17} aria-hidden="true" />
              </button>
              <button type="button" className="chat-icon-button" onClick={() => setIsOpen(false)} aria-label="Close chat">
                <X size={19} aria-hidden="true" />
              </button>
            </div>
          </header>

          <div className="chat-transcript" ref={transcriptRef} aria-live="polite" aria-relevant="additions text">
            <p className="chat-day-label">YOUR GLOSSED MOMENT</p>
            {messages.map((message) => (
              <div className={`chat-message-row ${message.role}`} key={message.id}>
                {message.role === 'assistant' && (
                  <span className="chat-message-avatar" aria-hidden="true"><Sparkles size={13} /></span>
                )}
                <p className="chat-message">{message.content}</p>
              </div>
            ))}
            {isSending && (
              <div className="chat-message-row assistant" role="status" aria-label="Assistant is typing">
                <span className="chat-message-avatar" aria-hidden="true"><Sparkles size={13} /></span>
                <p className="chat-message chat-typing"><span /><span /><span /></p>
              </div>
            )}
          </div>

          {messages.length === 1 && !isSending && (
            <div className="chat-suggestions" aria-label="Suggested questions">
              <button type="button" onClick={() => sendMessage('Help me find a nail style.')}>Find my nail style</button>
              <button type="button" onClick={() => sendMessage('What should I know before booking?')}>Booking questions</button>
            </div>
          )}

          {error && (
            <div className="chat-error" role="alert">
              <span>{error}</span>
              <button type="button" onClick={() => sendMessage(messages.at(-1)?.content, false)} disabled={isSending}>
                Try again
              </button>
            </div>
          )}
          {historyError && <p className="chat-storage-warning" role="status">{historyError}</p>}

          <form
            className="chat-composer"
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage(draft);
            }}
          >
            <label className="chat-sr-only" htmlFor="chat-message">Write your message</label>
            <textarea
              id="chat-message"
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage(draft);
                }
              }}
              placeholder="Ask me anything…"
              rows={1}
              maxLength={1000}
              disabled={isSending}
            />
            <button type="submit" className="chat-send" aria-label="Send message" disabled={!draft.trim() || isSending}>
              <Send size={17} aria-hidden="true" />
            </button>
          </form>
          <p className="chat-footnote">A friendly guide for your next glossed moment.</p>
        </section>
      )}

      <button
        type="button"
        className={`chat-launcher${isOpen ? ' is-open' : ''}`}
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls="chat-panel"
        aria-label={isOpen ? 'Close GlossedByRidhi chat' : 'Chat with GlossedByRidhi'}
      >
        {isOpen ? <X size={22} aria-hidden="true" /> : <MessageCircle size={23} aria-hidden="true" />}
        {!isOpen && <span>Ask our nail assistant</span>}
      </button>
    </aside>
  );
}
