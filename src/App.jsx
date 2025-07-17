/* global BigInt */
import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { LaserEyesProvider, useLaserEyes } from '@omnisat/lasereyes-react';
import { MAINNET, XVERSE, UNISAT } from '@omnisat/lasereyes-core';
import { initEccLib, Psbt, networks, address as baddress } from 'bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';

// Initialize ECC for Taproot/P2TR support
initEccLib(ecc);

const API_URL     = 'http://localhost:4000';
const ORDINALS_API = 'https://api.hiro.so/ordinals/v1/inscriptions';
const UTXOS_API    = addr => `https://blockstream.info/api/address/${addr}/utxo`;

function renderMetadata(obj, parentKey = '') {
  return Object.entries(obj).map(([key, val]) => {
    const fullKey = parentKey ? `${parentKey}.${key}` : key;
    if (val && typeof val === 'object') {
      return (
        <div key={fullKey}>
          <strong>{key}:</strong>
          <div className="nested-metadata">
            {renderMetadata(val, fullKey)}
          </div>
        </div>
      );
    }
    return (
      <div key={fullKey}>
        <strong>{key}:</strong> {String(val)}
      </div>
    );
  });
}

function MessageBoard({ address }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const listRef                 = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/messages`);
        setMessages(await res.json());
      } catch (e) {
        console.error('Failed to load messages:', e);
      }
    })();
  }, []);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handlePost = async () => {
    if (!address || !input.trim()) return;
    const username = address.slice(-4);

    try {
      const res = await fetch(`${API_URL}/messages`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username, text: input.trim(), address }),
      });

      if (res.status === 429) {
        const { error } = await res.json();
        alert(error);
        return;
      }
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        alert(error || 'Failed to post message');
        return;
      }

      const msg = await res.json();
      setMessages(prev => [...prev, msg]);
      setInput('');
    } catch (e) {
      console.error('Network error posting message:', e);
      alert('Network error: could not connect to server.');
    }
  };

  return (
    <div className="message-board">
      <h2>Message Board</h2>
      <ul className="message-list" ref={listRef}>
        {messages.map(msg => (
          <li key={msg.id}>
            <span className="username">user{msg.username}:</span>
            <span>{msg.text}</span>
            <span className="timestamp">
              ({new Date(msg.timestamp).toLocaleString()})
            </span>
          </li>
        ))}
      </ul>
      <div className="post-form">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handlePost()}
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

function InscriptionsViewer({ address }) {
  const [inscriptions, setInscriptions] = useState([]);
  const [selected, setSelected]         = useState([]);
  const [filterId, setFilterId]         = useState('');
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');

  const loadInscriptions = async () => {
    if (!address) return;
    setLoading(true);
    setError('');
    try {
      // 1) Fetch inscriptions
      let all = [], limit = 60, offset = 0, total = 0;
      do {
        const res = await fetch(
          `${ORDINALS_API}?address=${address}&limit=${limit}&offset=${offset}`
        );
        if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
        const js = await res.json();
        total = js.total;
        all.push(...(js.results || []));
        offset += limit;
      } while (offset < total);

      // 2) Parse outpoint from location
      const withOutpoints = all.map(insc => {
        const [txid, voutStr] = insc.location.split(':');
        return { ...insc, txid, vout: parseInt(voutStr, 10) };
      });

      // 3) Fetch UTXOs
      const utxoRes = await fetch(UTXOS_API(address));
      if (!utxoRes.ok) throw new Error(`UTXO fetch failed (${utxoRes.status})`);
      const utxos = await utxoRes.json();

      // 4) Merge real UTXO value + scriptPubKey
      const merged = await Promise.all(
        withOutpoints.map(async insc => {
          const u = utxos.find(u => u.txid === insc.txid && u.vout === insc.vout);
          if (!u) return { ...insc, value: null, scriptHex: null };
          const txRes = await fetch(`https://blockstream.info/api/tx/${insc.txid}`);
          if (!txRes.ok) throw new Error(`Tx fetch failed (${txRes.status})`);
          const txJson = await txRes.json();
          const v = txJson.vout[insc.vout];
          return {
            ...insc,
            value: v.value,
            scriptHex: v.scriptpubkey,
          };
        })
      );
      setInscriptions(merged);
    } catch (e) {
      console.error(e);
      setError('Error loading inscriptions or UTXOs');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = id =>
    setSelected(sel => (sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]));

  const handleGenerateTx = () => {
    if (!address || selected.length === 0) return;

    const psbt = new Psbt({ network: networks.bitcoin });
    let totalInput = 0n;

    selected.forEach(id => {
      const insc = inscriptions.find(i => i.id === id);
      if (!insc?.txid || insc.vout == null || insc.value == null || !insc.scriptHex) return;

      psbt.addInput({
        hash: insc.txid,
        index: insc.vout,
        witnessUtxo: {
          script: Buffer.from(insc.scriptHex, 'hex'),
          value: BigInt(insc.value),
        },
      });
      totalInput += BigInt(insc.value);
    });

    if (totalInput === 0n) {
      console.error('No sats available—cannot build transaction.');
      return;
    }

    const outScript = baddress.toOutputScript(address, networks.bitcoin);
    psbt.addOutput({ script: outScript, value: totalInput });

    console.log('Unsigned PSBT hex:', psbt.toHex());
  };

  const visible = filterId
    ? inscriptions.filter(i => i.parent === filterId || i.delegate === filterId)
    : inscriptions;
  const totalValue = selected.reduce((sum, id) => {
    const insc = inscriptions.find(i => i.id === id);
    return sum + (Number(insc?.value) || 0);
  }, 0);

  return (
    <div className="inscriptions-section">
      <button onClick={loadInscriptions} disabled={!address || loading}>
        {loading ? 'Loading…' : 'Load Inscriptions'}
      </button>
      {error && <p className="error-text">{error}</p>}

      <div className="filter-section">
        <input
          className="filter-input"
          type="text"
          placeholder="Filter by parent or delegate ID"
          value={filterId}
          onChange={e => setFilterId(e.target.value.trim())}
        />
        {filterId && <button onClick={() => setFilterId('')}>Clear</button>}
      </div>

      <div className="select-section">
        <button
          onClick={() => setSelected(visible.map(i => i.id))}
          disabled={!visible.length}
        >
          Select All
        </button>
        {selected.length > 0 && (
          <>
            <button onClick={() => setSelected([])}>Clear Selected</button>
            <button onClick={handleGenerateTx}>Generate Tx</button>
          </>
        )}
      </div>

      {selected.length > 0 && (
        <div className="recycle-section">
          <div><strong>Selected IDs:</strong> {selected.join(', ')}</div>
          <div><strong>Total Value:</strong> {totalValue} sats</div>
        </div>
      )}

      <div className="inscriptions-grid">
        {visible.map(insc => (
          <div
            key={insc.id}
            className={`inscription-item ${selected.includes(insc.id) ? 'selected' : ''}`}
            onClick={() => toggleSelect(insc.id)}
          >
            <div className="insc-value">{insc.value ?? '—'}</div>
            <iframe
              src={`https://ordinals.com/preview/${insc.id}`}
              title={insc.id}
              frameBorder="0"
              sandbox="allow-scripts allow-same-origin"
            />
            <div className="insc-metadata">
              <div><strong>ID:</strong> {insc.id}</div>
              {insc.mediaType && <div><strong>Type:</strong> {insc.mediaType}</div>}
              {renderMetadata(insc.metadata || {})}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AppContent({ onDisconnect }) {
  const { connect, disconnect, connected, address } = useLaserEyes();
  return (
    <div className="App">
      <div className="connect-buttons">
        {!connected ? (
          <>
            <button onClick={() => connect(XVERSE)}>Connect Xverse</button>
            <button onClick={() => connect(UNISAT)}>Connect Unisat</button>
          </>
        ) : (
          <div className="login-header">
            <span>…{address.slice(-8)}</span>{' '}
            <button onClick={disconnect}>Disconnect</button>
          </div>
        )}
      </div>
      <MessageBoard address={address} />
      <InscriptionsViewer address={address} />
    </div>
  );
}

export default function App() {
  const [providerKey, setProviderKey] = useState(0);
  return (
    <LaserEyesProvider key={providerKey} config={{ network: MAINNET }}>
      <AppContent onDisconnect={() => setProviderKey(k => k + 1)} />
    </LaserEyesProvider>
  );
}
