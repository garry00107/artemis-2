import { useState, useRef, useEffect } from 'react';

export default function ChatPanel({ messages, onlineCount, onSend }) {
  const [username, setUsername] = useState(() => localStorage.getItem('artemis2-username') || '');
  const [showUsernameModal, setShowUsernameModal] = useState(!localStorage.getItem('artemis2-username'));
  const [inputText, setInputText] = useState('');
  const [tempUsername, setTempUsername] = useState('');
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  // Detect manual scroll
  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const { scrollHeight, scrollTop, clientHeight } = container;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 60);
  };

  const handleSetUsername = () => {
    const name = tempUsername.trim().slice(0, 20);
    if (name) {
      setUsername(name);
      localStorage.setItem('artemis2-username', name);
      setShowUsernameModal(false);
    }
  };

  const handleSend = () => {
    if (inputText.trim() && username) {
      onSend(username, inputText);
      setInputText('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="panel chat-panel">
      <div className="panel-header">
        <span className="panel-title">
          <span className="dot"></span>
          Mission Chat
        </span>
        <span className="chat-online">
          <span className="green-dot"></span>
          {onlineCount} watching
        </span>
      </div>

      {/* Messages */}
      <div
        className="chat-messages"
        ref={messagesContainerRef}
        onScroll={handleScroll}
      >
        {/* Welcome message */}
        <div className="chat-message system">
          <div className="chat-username">MISSION CONTROL</div>
          <div className="chat-text">
            Welcome to the Artemis II mission watch party! 🚀 Follow Orion's journey to the Moon and back.
          </div>
        </div>

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`chat-message ${msg.isSystem ? 'system' : ''}`}
          >
            <div className="chat-username">{msg.username}</div>
            <div className="chat-text">{msg.text}</div>
            <div className="chat-time">
              {new Date(msg.time).toLocaleTimeString()}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom indicator */}
      {!autoScroll && (
        <button
          style={{
            position: 'absolute',
            bottom: '64px',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '11px',
            padding: '4px 12px',
            borderRadius: '12px',
            border: '1px solid rgba(79, 195, 247, 0.3)',
            background: 'rgba(12, 16, 32, 0.9)',
            color: '#4fc3f7',
            cursor: 'pointer',
            zIndex: 10,
            fontFamily: 'var(--font-sans)',
          }}
          onClick={() => {
            setAutoScroll(true);
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          ↓ New messages
        </button>
      )}

      {/* Input */}
      <div className="chat-input-area">
        <input
          className="chat-input"
          type="text"
          placeholder={username ? `Message as ${username}...` : 'Set your username first'}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!username}
          maxLength={500}
        />
        <button
          className="chat-send-btn"
          onClick={handleSend}
          disabled={!username || !inputText.trim()}
        >
          Send
        </button>
      </div>

      {/* Username Modal */}
      {showUsernameModal && (
        <div className="username-modal-overlay">
          <div className="username-modal">
            <h2>🚀 Join Mission Chat</h2>
            <p>Pick a callsign to start chatting with other Artemis II watchers.</p>
            <input
              type="text"
              placeholder="Your callsign..."
              value={tempUsername}
              onChange={(e) => setTempUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSetUsername()}
              maxLength={20}
              autoFocus
            />
            <button onClick={handleSetUsername}>
              Enter Mission Chat
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
