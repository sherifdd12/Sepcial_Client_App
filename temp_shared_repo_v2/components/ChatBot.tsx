import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, X, BrainCircuit, Bot, User, Sparkles } from 'lucide-react';
import { ExtractedDocument, ChatMessage } from '../types';
import { chatWithLegalAssistant } from '../services/geminiService';

interface ChatBotProps {
  context: ExtractedDocument;
}

export const ChatBot: React.FC<ChatBotProps> = ({ context }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', role: 'model', text: 'مرحباً! أنا مساعدك القانوني الذكي. يمكنك سؤالي أي تفاصيل عن القضايا المستخرجة.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isThinkingMode, setIsThinkingMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Convert internal messages to Gemini history format
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const responseText = await chatWithLegalAssistant(userMsg.text, context, history, isThinkingMode);
      
      const botMsg: ChatMessage = { 
        id: (Date.now() + 1).toString(), 
        role: 'model', 
        text: responseText,
        isThinking: isThinkingMode
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: 'عذراً، حدث خطأ في الاتصال بالخدمة.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end no-print">
      {/* Chat Window */}
      {isOpen && (
        <div className="bg-white w-80 md:w-96 h-[500px] rounded-2xl shadow-2xl border border-gray-200 mb-4 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-300">
          {/* Header */}
          <div className="bg-brand-600 p-4 flex justify-between items-center text-white">
            <div className="flex items-center gap-2">
              <Bot size={20} />
              <span className="font-bold">المساعد الذكي (Gemini)</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-brand-700 p-1 rounded transition">
              <X size={18} />
            </button>
          </div>

          {/* Thinking Mode Toggle */}
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-gray-600">
              <BrainCircuit size={14} className={isThinkingMode ? "text-purple-600" : "text-gray-400"} />
              <span>تحليل عميق (Thinking Mode)</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={isThinkingMode}
                onChange={(e) => setIsThinkingMode(e.target.checked)}
                className="sr-only peer" 
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div 
                  className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-brand-600 text-white rounded-br-none' 
                      : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'
                  }`}
                >
                  {msg.isThinking && (
                    <div className="flex items-center gap-1 text-[10px] text-purple-600 mb-1 font-bold">
                       <Sparkles size={10} />
                       تم التحليل باستخدام التفكير العميق
                    </div>
                  )}
                  {msg.text}
                </div>
              </div>
            ))}
            {isLoading && (
               <div className="flex justify-start">
                  <div className="bg-white p-3 rounded-2xl rounded-bl-none border border-gray-200 shadow-sm flex items-center gap-2">
                     <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                     <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                     <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
               </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 bg-white border-t border-gray-100 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={isThinkingMode ? "اطرح سؤالاً معقداً..." : "اكتب سؤالك هنا..."}
              className="flex-1 border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-brand-500 transition"
            />
            <button 
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white p-2 rounded-xl transition shadow-sm"
            >
              <Send size={18} className="rtl:rotate-180" />
            </button>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-brand-600 hover:bg-brand-700 text-white p-4 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95 flex items-center gap-2"
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
        {!isOpen && <span className="font-bold text-sm hidden md:inline">مساعد الذكاء الاصطناعي</span>}
      </button>
    </div>
  );
};
