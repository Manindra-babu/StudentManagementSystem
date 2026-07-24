import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import {
  X, Send, Trash2,
  User as UserIcon, Loader2, ArrowRight
} from 'lucide-react';

interface ChatMessage {
  id?: string;
  sender: 'USER' | 'ASSISTANT';
  content: string;
  action?: { type: string; route: string } | null;
  timestamp?: string;
}

interface ChatWidgetProps {
  onNavigate?: (route: string) => void;
}

// Mini Project Logo Icon for Bot Avatar & Trigger
const ProjectBotIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="shrink-0"
  >
    {/* Lightbulb rays */}
    <path d="M 28 35 L 22 28" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />
    <path d="M 38 24 L 38 15" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />
    <path d="M 52 30 L 60 22" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />

    {/* Lightbulb */}
    <path
      d="M 38 28 C 29 28 22 35 22 44 C 22 50 25 55 29 58 L 29 64 C 29 66 31 68 33 68 L 43 68 C 45 68 47 66 47 64 L 47 58 C 51 55 54 50 54 44 C 54 35 47 28 38 28 Z"
      fill="#FBBF24"
      stroke="#1E293B"
      strokeWidth="3.5"
      strokeLinejoin="round"
    />
    <path d="M 31 68 L 45 68" stroke="#1E293B" strokeWidth="3.5" strokeLinecap="round" />

    {/* Stack of Books */}
    <rect x="42" y="90" width="70" height="14" rx="3" fill="#0D9488" stroke="#1E293B" strokeWidth="3.5" />
    <rect x="44" y="74" width="66" height="14" rx="3" fill="#E11D48" stroke="#1E293B" strokeWidth="3.5" />
    <rect x="40" y="58" width="72" height="14" rx="3" fill="#1E3A8A" stroke="#1E293B" strokeWidth="3.5" />
    <rect x="46" y="42" width="62" height="14" rx="3" fill="#475569" stroke="#1E293B" strokeWidth="3.5" />

    {/* Graduation Cap */}
    <path d="M 77 18 L 115 32 L 77 44 L 39 32 Z" fill="#1E293B" stroke="#0F172A" strokeWidth="3.5" strokeLinejoin="round" />
    <path d="M 77 31 L 110 44 L 110 58" stroke="#D97706" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="110" cy="60" r="3.5" fill="#D97706" />

    {/* Pencil */}
    <g transform="translate(12, 68) rotate(-40)">
      <rect x="0" y="12" width="12" height="28" fill="#DC2626" stroke="#1E293B" strokeWidth="2.5" />
      <path d="M 0 40 L 6 52 L 12 40 Z" fill="#FDE68A" stroke="#1E293B" strokeWidth="2.5" strokeLinejoin="round" />
    </g>
  </svg>
);

export const ChatWidget: React.FC<ChatWidgetProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const role = user?.role || 'STUDENT';

  // Role-based quick prompt chips
  const suggestionChips = role === 'STUDENT' ? [
    'Check my attendance %',
    "What's due this week?",
    'Am I eligible to register for courses?'
  ] : role === 'LECTURER' ? [
    'Who is below 75% attendance?',
    'What do I need to grade?',
    'How do I generate a QR code?'
  ] : [
    'Department sections overview',
    'Faculty roster & section assignments',
    'Fee collection breakdown'
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  // Load chat history when widget opens
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      loadHistory();
    }
  }, [isOpen]);

  const loadHistory = async () => {
    try {
      const res = await axios.get('/api/chat/history');
      if (res.data.messages && res.data.messages.length > 0) {
        setConversationId(res.data.conversationId);
        setMessages(res.data.messages);
      } else {
        // Default welcome message
        setMessages([{
          sender: 'ASSISTANT',
          content: `Hi ${user?.profile?.name || 'there'}! I'm your Academix AI Assistant. I have live access to your portal records. How can I help you today?`
        }]);
      }
    } catch (err) {
      console.warn('Could not load chat history:', err);
    }
  };

  const handleClearHistory = async () => {
    try {
      await axios.delete('/api/chat/history');
      setConversationId(null);
      setMessages([{
        sender: 'ASSISTANT',
        content: `Chat history cleared. How can I assist you with your portal data?`
      }]);
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputMessage.trim();
    if (!query || isStreaming) return;

    if (!textToSend) setInputMessage('');

    // Append user message immediately
    const userMsg: ChatMessage = { sender: 'USER', content: query };
    setMessages(prev => [...prev, userMsg]);
    setIsStreaming(true);

    // Prepare placeholder assistant message for streaming
    setMessages(prev => [...prev, { sender: 'ASSISTANT', content: '' }]);

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: query, conversationId })
      });

      if (!response.ok) {
        throw new Error('Failed to start response stream');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      let assistantText = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.replace('data: ', '').trim();
              if (dataStr === '[DONE]') break;
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.text) {
                  assistantText += parsed.text;
                  setMessages(prev => {
                    const updated = [...prev];
                    const lastIdx = updated.length - 1;
                    if (updated[lastIdx]?.sender === 'ASSISTANT') {
                      let actionObj = null;
                      const actionMatch = assistantText.match(/\[ACTION:([a-zA-Z0-9_-]+):([a-zA-Z0-9_-]+)\]/);
                      if (actionMatch) {
                        actionObj = { type: actionMatch[1], route: actionMatch[2] };
                      }
                      const cleanContent = assistantText.replace(/\[ACTION:[^\]]+\]/g, '').trim();
                      updated[lastIdx] = { sender: 'ASSISTANT', content: cleanContent, action: actionObj };
                    }
                    return updated;
                  });
                }
              } catch (e) {
                // Ignore parse chunk glitches
              }
            }
          }
        }
      }
    } catch (error) {
      setMessages(prev => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (updated[lastIdx]?.sender === 'ASSISTANT') {
          updated[lastIdx] = {
            sender: 'ASSISTANT',
            content: "I'm having trouble connecting to the AI inference service right now. Please try again in a moment."
          };
        }
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const handleActionClick = (route: string) => {
    if (onNavigate) {
      onNavigate(route);
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Sleek Circular Floating Bot Pop-up Button matching Project Logo */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-slate-900 border-2 border-primary-500 shadow-xl shadow-slate-900/30 flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer group"
        title="Academix AI Assistant"
      >
        <div className="relative flex items-center justify-center">
          <ProjectBotIcon size={32} />
          {/* Active Status Pulse Dot */}
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900 animate-pulse" />
        </div>
      </button>

      {/* Expandable Chat Drawer Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-96 h-[570px] max-h-[82vh] bg-white border border-slate-200/90 rounded-3xl shadow-2xl shadow-slate-900/20 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Slate Dark Header Matching System Theme */}
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center shadow-inner">
                <ProjectBotIcon size={26} />
              </div>
              <div>
                <h3 className="font-extrabold text-sm leading-none font-outfit tracking-tight text-white">Academix AI</h3>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-bold text-slate-300 tracking-wider uppercase">
                    Live Data Context • {role}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleClearHistory}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
                title="Clear Chat History"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Clean Suggestion Prompt Chips */}
          <div className="p-2.5 bg-slate-50 border-b border-slate-100 flex gap-2 overflow-x-auto text-[11px] scrollbar-none">
            {suggestionChips.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(chip)}
                disabled={isStreaming}
                className="px-3 py-1.5 bg-white hover:bg-primary-600 text-slate-700 hover:text-white font-semibold rounded-full border border-slate-200 whitespace-nowrap transition-colors shadow-2xs cursor-pointer active:scale-95"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Messages Body */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/70">
            {messages.map((msg, index) => {
              const isUser = msg.sender === 'USER';
              return (
                <div
                  key={index}
                  className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {isUser ? (
                    <div className="w-7 h-7 rounded-xl bg-primary-600 text-white flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold shadow-xs">
                      <UserIcon className="w-3.5 h-3.5" />
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-xl bg-slate-200 border border-slate-300/80 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                      <ProjectBotIcon size={18} />
                    </div>
                  )}

                  <div className="max-w-[82%] space-y-2">
                    <div className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                      isUser
                        ? 'bg-primary-600 text-white rounded-tr-xs shadow-sm font-medium'
                        : 'bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs shadow-2xs font-normal'
                    }`}>
                      <p className="whitespace-pre-wrap">{msg.content || (isStreaming && index === messages.length - 1 ? '...' : '')}</p>
                    </div>

                    {/* Navigation Action Card */}
                    {msg.action && msg.action.type === 'navigate' && (
                      <div className="p-3 bg-primary-50/80 border border-primary-200 rounded-2xl flex items-center justify-between shadow-2xs">
                        <div>
                          <p className="text-[11px] font-bold text-slate-900">Suggested Action</p>
                          <span className="text-[9px] text-primary-700 font-extrabold uppercase tracking-wider">{msg.action.route.replace('-', ' ')}</span>
                        </div>
                        <button
                          onClick={() => handleActionClick(msg.action!.route)}
                          className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-[10px] font-bold flex items-center gap-1 shadow-xs cursor-pointer transition-all active:scale-95"
                        >
                          Open Desk
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {isStreaming && (
              <div className="flex items-center gap-2 text-xs font-semibold text-primary-600 pl-9">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-600" />
                <span>Academix AI is typing...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <form
            onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
            className="p-3 bg-white border-t border-slate-100 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask about attendance, courses, grades..."
              className="flex-1 px-3.5 py-2.5 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-primary-500/25 focus:border-primary-500 bg-slate-50 placeholder:text-slate-400"
              disabled={isStreaming}
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || isStreaming}
              className="p-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs active:scale-95"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
