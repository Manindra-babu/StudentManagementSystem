import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import {
  Sparkles, X, Send, Trash2,
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

// Custom Premium Academic AI Logo Badge
const AIBotAvatar: React.FC<{ size?: number; className?: string }> = ({ size = 28, className = '' }) => (
  <div
    className={`relative flex items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 via-purple-600 to-indigo-600 text-white shadow-md shadow-violet-500/20 shrink-0 ${className}`}
    style={{ width: size, height: size }}
  >
    <svg width={size * 0.65} height={size * 0.65} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Graduation Cap Base */}
      <path d="M12 3L2 8L12 13L22 8L12 3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 9.5V15.5C5 15.5 8.5 18 12 18C15.5 18 19 15.5 19 15.5V9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* AI Sparkle Star Dot */}
      <circle cx="18.5" cy="5.5" r="2.5" fill="#F43F5E" />
      <path d="M18.5 3.5V7.5M16.5 5.5H20.5" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  </div>
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
                      // Check for action tag e.g. [ACTION:navigate:registration]
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
      {/* Floating Trigger Bubble Button with Violet Gradient & Glow */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white shadow-xl shadow-violet-600/35 hover:shadow-2xl hover:shadow-violet-600/50 hover:scale-105 active:scale-95 smooth-hover flex items-center gap-2.5 cursor-pointer border border-violet-400/30"
        title="Open AI Assistant"
      >
        <Sparkles className="w-5 h-5 animate-pulse text-amber-300" />
        <span className="font-bold text-xs pr-1 tracking-wide">Ask Academix AI</span>
      </button>

      {/* Expandable Chat Drawer Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-96 h-[570px] max-h-[82vh] bg-white border border-violet-200/60 rounded-3xl shadow-2xl shadow-violet-900/15 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Violet Dark Glass Header */}
          <div className="p-4 bg-gradient-to-r from-slate-950 via-violet-950 to-indigo-950 text-white flex items-center justify-between border-b border-violet-800/40">
            <div className="flex items-center gap-3">
              <AIBotAvatar size={36} />
              <div>
                <h3 className="font-extrabold text-sm leading-none font-outfit tracking-tight text-white">Academix AI Assistant</h3>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-bold text-violet-200 tracking-wider uppercase">
                    Live Data Context • {role}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleClearHistory}
                className="p-1.5 hover:bg-violet-800/40 text-violet-300 hover:text-white rounded-xl smooth-hover cursor-pointer"
                title="Clear Chat History"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-violet-800/40 text-violet-300 hover:text-white rounded-xl smooth-hover cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Suggestion Prompt Chips with Subtle Violet Theme */}
          <div className="p-2.5 bg-violet-50/60 border-b border-violet-100 flex gap-2 overflow-x-auto text-[11px] scrollbar-none">
            {suggestionChips.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(chip)}
                disabled={isStreaming}
                className="px-3 py-1.5 bg-white hover:bg-gradient-to-r hover:from-violet-600 hover:to-indigo-600 text-violet-900 hover:text-white font-semibold rounded-full border border-violet-200/90 whitespace-nowrap smooth-hover shadow-2xs cursor-pointer active:scale-95"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Messages Body */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/60">
            {messages.map((msg, index) => {
              const isUser = msg.sender === 'USER';
              return (
                <div
                  key={index}
                  className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {isUser ? (
                    <div className="w-7 h-7 rounded-xl bg-violet-100 border border-violet-200 text-violet-700 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold shadow-xs">
                      <UserIcon className="w-3.5 h-3.5" />
                    </div>
                  ) : (
                    <AIBotAvatar size={28} />
                  )}

                  <div className="max-w-[82%] space-y-2">
                    <div className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                      isUser
                        ? 'bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white rounded-tr-xs shadow-md shadow-violet-500/10 font-medium'
                        : 'bg-white text-slate-800 border border-violet-100/90 rounded-tl-xs shadow-xs font-normal'
                    }`}>
                      <p className="whitespace-pre-wrap">{msg.content || (isStreaming && index === messages.length - 1 ? '...' : '')}</p>
                    </div>

                    {/* Navigation Action Card */}
                    {msg.action && msg.action.type === 'navigate' && (
                      <div className="p-3 bg-gradient-to-r from-violet-50 via-purple-50 to-indigo-50 border border-violet-200/90 rounded-2xl flex items-center justify-between shadow-xs">
                        <div>
                          <p className="text-[11px] font-bold text-violet-950">Suggested Action</p>
                          <span className="text-[9px] text-violet-600 font-extrabold uppercase tracking-wider">{msg.action.route.replace('-', ' ')}</span>
                        </div>
                        <button
                          onClick={() => handleActionClick(msg.action!.route)}
                          className="px-3 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl text-[10px] font-bold flex items-center gap-1 shadow-xs cursor-pointer smooth-hover active:scale-95"
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
              <div className="flex items-center gap-2 text-xs font-semibold text-violet-600 pl-9">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-600" />
                <span>Academix AI is typing...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <form
            onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
            className="p-3 bg-white border-t border-violet-100 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask about attendance, courses, grades..."
              className="flex-1 px-3.5 py-2.5 border border-violet-200/80 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/25 focus:border-violet-500 bg-violet-50/30 placeholder:text-slate-400"
              disabled={isStreaming}
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || isStreaming}
              className="p-2.5 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:opacity-95 text-white rounded-2xl smooth-hover cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-violet-500/20 active:scale-95"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
