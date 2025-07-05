# Xverse/Unisat Message Board Prototype

This is a simple prototype that demonstrates how to connect an Xverse or Unisat Bitcoin wallet via the LaserEyes library, post messages to a shared board, and store them in a local JSON-based backend.

---

## Prerequisites

* **Node.js**: v14 or later (tested on v23.5.0)
* **npm**: v6 or later (tested on v9.5.1)
* **Xverse** and/or **Unisat** browser extensions installed and unlocked

---

## Project Structure

```
project-root/
├── server.js             # Express backend for storing messages
├── messages/             # Auto-created; JSON files per message
└── src/
    ├── App.js            # React frontend with LaserEyes integration
    └── index.js          # CRA entrypoint
```

---

## Installation

1. **Clone or copy** this repository to your machine:

   ```bash
   git clone <repo-url> my-message-board
   cd my-message-board
   ```

2. **Install backend dependencies**:

    npm install express body-parser nanoid


3. **Install frontend dependencies** (in the same folder):

    npm install


---

## Running the Prototype

### 1. Start the backend server

In your project root:

node server.js

You should see:

Server running on http://localhost:4000

All messages are stored under the `messages/` directory as individual JSON files.

### 2. Start the React frontend

In a separate terminal (same directory):

npm start

This runs CRA’s dev server default: [http://localhost:3000]. Your browser will open automatically or you can visit the URL manually.

---

## Usage

1. **View messages**: The board loads and displays all prior messages, even if not connected.
2. **Connect wallet**: Click **Connect Xverse** or **Connect Unisat**. Approve the popup in your wallet extension.
3. **Post message**:

   * Type your text in the input field.
   * Press **Enter** or click **Post**.
   * Messages are tagged with the last 4 characters of your Taproot address and timestamped.
4. **Disconnect**: Click **Disconnect** to log out; you can then reconnect with a different account (have to switch in wallet first) or provider.


## Notes & Troubleshooting

* If you cannot connect/disconnect properly, ensure your wallet extension is unlocked and on Mainnet.
* Messages persist across reloads and disconnects because they’re stored server-side.
* To clear all messages, delete the contents of the `messages/` folder.

---

## To-do

* Fix reconnect with a different account (have to switch in wallet first).
