const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const { nanoid } = require('nanoid');

const app = express();
const PORT = 4000;
const DATA_DIR = path.join(__dirname, 'messages');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

app.use(bodyParser.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.get('/messages', (req, res) => {
  const files = fs.readdirSync(DATA_DIR);
  const msgs = files
    .map(name => JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8')))
    .sort((a, b) => a.timestamp - b.timestamp);
  res.json(msgs);
});

app.post('/messages', (req, res) => {
  const { username, text, address } = req.body;
  if (!username || !text || !address) {
    return res.status(400).json({ error: 'username, text, and address required' });
  }
  const timestamp = Date.now();
  const id = nanoid();
  const msg = { id, username, text, address, timestamp };
  fs.writeFileSync(
    path.join(DATA_DIR, `${timestamp}-${id}.json`),
    JSON.stringify(msg, null, 2)
  );
  res.status(201).json(msg);
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
