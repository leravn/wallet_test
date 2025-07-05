import React, { useState, useEffect } from 'react';
import './App.css';
import { LaserEyesProvider, useLaserEyes } from '@omnisat/lasereyes-react';
import { MAINNET, XVERSE, UNISAT } from '@omnisat/lasereyes-core';

const API_URL = 'http://localhost:4000';

function MessageBoard({ address }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/messages`);
        const data = await res.json();
        setMessages(data);
      } catch (err) {
        console.error(err);
      }
    })();
  }, []);

  const handlePost = async () => {
    if (!address || !input.trim()) return;
    const username = address.slice(-4);
    const payload = { username, text: input.trim(), address };
    try {
      const res = await fetch(`${API_URL}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const msg = await res.json();
      setMessages(prev => [...prev, msg]);
      setInput('');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="message-board">
      <h2>Message Board</h2>
      {messages.length === 0 ? (
        <p><em>No messages yet.</em></p>
      ) : (
        <ul className="message-list">
          {messages.map(msg => (
            <li key={msg.id}>
              <span className="username">user{msg.username}:</span>
              <span>{msg.text}</span>
              <span className="timestamp">({new Date(msg.timestamp).toLocaleString()})</span>
            </li>
          ))}
        </ul>
      )}
      <div className="post-form">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handlePost(); }}
          placeholder={address ? 'Type your message…' : 'Connect wallet to post messages'}
          disabled={!address}
        />
        <button onClick={handlePost} disabled={!address || !input.trim()}>
          Post
        </button>
      </div>
    </div>
  );
}

function AppContent({ onDisconnect }) {
  const { connect, disconnect, connected, address } = useLaserEyes();

  const handleConnect = async provider => {
    try {
      await connect(provider);
    } catch (err) {
      console.error('Connection failed:', err);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch (err) {
      console.error('Disconnect failed', err);
    }
    onDisconnect();
  };

  return (
    <div className="App">
      <div className="connect-buttons">
        {!connected ? (
          <>
            <button onClick={() => handleConnect(XVERSE)}>Connect Xverse</button>
            <button onClick={() => handleConnect(UNISAT)}>Connect Unisat</button>
          </>
        ) : (
          <div className="login-header">
            <span className="address">…{address.slice(-8)}</span>
            <button onClick={handleDisconnect}>Disconnect</button>
          </div>
        )}
      </div>
      <MessageBoard address={address} />
    </div>
  );
}

export default function App() {
  const [providerKey, setProviderKey] = useState(0);
  const resetProvider = () => setProviderKey(k => k + 1);

  return (
    <LaserEyesProvider key={providerKey} config={{ network: MAINNET }}>
      <AppContent onDisconnect={resetProvider} />
    </LaserEyesProvider>
  );
}
