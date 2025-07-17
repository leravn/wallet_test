// server.js
const express = require('express');
const cors = require('cors');             // ← import cors
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 4000;

// ── Add CORS before any routes ──
app.use(cors({
  origin: 'http://localhost:3000',        // allow only your React app
  methods: ['GET','POST'],                // allowed HTTP methods
  allowedHeaders: ['Content-Type'],       // allowed headers
}));

app.use(express.json());

const messagesDir = path.join(__dirname, 'messages');
if (!fs.existsSync(messagesDir)) fs.mkdirSync(messagesDir);

// GET all messages
app.get('/messages', async (req, res) => {
  const files = await fs.promises.readdir(messagesDir);
  const msgs = await Promise.all(
    files.map(f => fs.promises.readFile(path.join(messagesDir, f), 'utf8'))
  );
  const parsed = msgs.map(JSON.parse);
  parsed.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  res.json(parsed);
});

// POST a new message, with slow-mode: max 6 per minute per address
app.post('/messages', async (req, res) => {
  const { username, text, address } = req.body;
  if (!address || !text) return res.status(400).json({ error: 'Bad request' });

  const now = Date.now();
  const files = await fs.promises.readdir(messagesDir);
  let recentCount = 0;
  for (const file of files) {
    const data = await fs.promises.readFile(path.join(messagesDir, file), 'utf8');
    const msg = JSON.parse(data);
    if (msg.address === address && now - new Date(msg.timestamp).getTime() < 60_000) {
      recentCount++;
      if (recentCount >= 6) break;
    }
  }

  if (recentCount >= 6) {
    return res
      .status(429)
      .json({ error: 'Slow mode: you can only post 6 messages per minute.' });
  }

  const id = uuidv4();
  const message = { id, username, text, address, timestamp: new Date().toISOString() };
  await fs.promises.writeFile(
    path.join(messagesDir, `${id}.json`),
    JSON.stringify(message, null, 2)
  );
  res.json(message);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
