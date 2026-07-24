import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import {
  Sparkles, X, Send, Trash2,
  Bot, User as UserIcon, Loader2, ArrowRight
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
      {/* Floating Trigger Bubble Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-gradient-to-r from-primary-600 to-indigo-600 text-white shadow-xl shadow-primary-500/25 hover:shadow-2xl hover:scale-105 active:scale-95 smooth-hover flex items-center gap-2.5 cursor-pointer border border-white/20"
        title="Open AI Assistant"
      >
        <Sparkles className="w-5 h-5 animate-pulse" />
        <span className="font-bold text-xs pr-1">Ask Academix AI</span>
      </button>

      {/* Expandable Chat Drawer Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-96 h-[560px] max-h-[80vh] bg-white border border-slate-200/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary-500 to-indigo-500 flex items-center justify-center shadow-md">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-sm leading-none font-outfit">Academix AI Assistant</h3>
                <span className="text-[10px] font-semibold text-primary-300 block mt-1">
                  Live Data Context • {role}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleClearHistory}
                className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg smooth-hover cursor-pointer"
                title="Clear Chat History"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg smooth-hover cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Suggestions Bar */}
          <div className="p-2.5 bg-slate-50 border-b border-slate-100 flex gap-2 overflow-x-auto text-[11px] scrollbar-none">
            {suggestionChips.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(chip)}
                disabled={isStreaming}
                className="px-3 py-1 bg-white hover:bg-primary-50 text-slate-700 hover:text-primary-700 font-semibold rounded-full border border-slate-200/80 whitespace-nowrap smooth-hover shadow-2xs cursor-pointer"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Messages Body */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/50">
            {messages.map((msg, index) => {
              const isUser = msg.sender === 'USER';
              return (
                <div
                  key={index}
                  className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold ${
                    isUser ? 'bg-primary-600 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {isUser ? <UserIcon className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                  </div>

                  <div className={`max-w-[82%] space-y-2`}>
                    <div className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                      isUser
                        ? 'bg-primary-600 text-white rounded-tr-none shadow-sm'
                        : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-none shadow-xs'
                    }`}>
                      <p className="whitespace-pre-wrap">{msg.content || (isStreaming && index === messages.length - 1 ? '...' : '')}</p>
                    </div>

                    {/* Navigation Action Button Card */}
                    {msg.action && msg.action.type === 'navigate' && (
                      <div className="p-3 bg-primary-50/80 border border-primary-200 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="text-[11px] font-bold text-primary-900">Suggested Portal Action</p>
                          <span className="text-[9px] text-primary-600 uppercase font-bold">{msg.action.route.replace('-', ' ')}</span>
                        </div>
                        <button
                          onClick={() => handleActionClick(msg.action!.route)}
                          className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                        >
                          Go Now
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {isStreaming && (
              <div className="flex items-center gap-2 text-xs font-medium text-slate-400 pl-9">
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
              className="flex-1 px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-slate-50"
              disabled={isStreaming}
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || isStreaming}
              className="p-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl smooth-hover cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
