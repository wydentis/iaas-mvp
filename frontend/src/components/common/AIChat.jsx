import { useState, useEffect, useRef } from 'react';
import { WebSocketClient } from '../../utils/websocket';
import './AIChat.css';

export const AIChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen && !isConnected) {
      connectWebSocket();
    }
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const connectWebSocket = async () => {
    const token = localStorage.getItem('access_token');
    const ws = new WebSocketClient('ws://localhost:8080/ai/chat', token);
    
    try {
      await ws.connect();
      setIsConnected(true);
      
      ws.on('message', (data) => {
        if (data.status === 'success') {
          setMessages(prev => [...prev, { type: 'ai', text: data.response }]);
        } else if (data.status === 'error') {
          setMessages(prev => [...prev, { type: 'error', text: data.error }]);
        }
      });

      ws.on('close', () => {
        setIsConnected(false);
      });

      wsRef.current = ws;
    } catch (error) {
      console.error('WebSocket connection failed:', error);
    }
  };

  const sendMessage = () => {
    if (!input.trim() || !isConnected) return;

    setMessages(prev => [...prev, { type: 'user', text: input }]);
    wsRef.current.send({ message: input });
    setInput('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      <button 
        className="ai-chat-toggle" 
        onClick={() => setIsOpen(!isOpen)}
      >
        💬 Спросить у ИИ
      </button>

      {isOpen && (
        <div className="ai-chat-window">
          <div className="ai-chat-header">
            <h3>AI Консультант</h3>
            <button onClick={() => setIsOpen(false)}>✕</button>
          </div>

          <div className="ai-chat-messages">
            {messages.length === 0 && (
              <div className="ai-chat-welcome">
                Здравствуйте! Чем могу помочь с выбором конфигурации сервера?
              </div>
            )}
            {messages.map((msg, idx) => (
              <div key={idx} className={`ai-chat-message ai-chat-${msg.type}`}>
                {msg.text}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="ai-chat-input">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Введите ваш вопрос..."
              disabled={!isConnected}
            />
            <button onClick={sendMessage} disabled={!isConnected || !input.trim()}>
              Отправить
            </button>
          </div>
        </div>
      )}
    </>
  );
};
