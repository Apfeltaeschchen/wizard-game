process.env.WIZARD_DB_PATH = ':memory:';
const assert = require('assert');
const http = require('http');
const ioClient = require('socket.io-client');

console.log('--- STARTE AUTH & SOCKET.IO INTEGRATIONSTEST ---');

// Starte lokalen Server auf freiem Port
const express = require('express');
const { Server } = require('socket.io');
const dbModule = require('../server/database');

const app = express();
app.use(express.json());

app.post('/api/auth/register', (req, res) => {
  const { username, password, avatar_id } = req.body || {};
  const result = dbModule.registerUser(username, password, avatar_id);
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const result = dbModule.loginUser(username, password);
  if (!result.success) return res.status(401).json(result);
  res.json(result);
});

app.get('/api/auth/me', (req, res) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.query.token;
  const user = dbModule.getUserByToken(token);
  if (!user) return res.status(401).json({ success: false });
  res.json({ success: true, user });
});

app.get('/api/leaderboard', (req, res) => {
  res.json({ success: true, leaderboard: dbModule.getLeaderboard(10) });
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (token) {
    const user = dbModule.getUserByToken(token);
    if (user) socket.user = user;
  }
  next();
});

io.on('connection', (socket) => {
  socket.on('whoami', (callback) => {
    callback({
      authenticated: !!socket.user,
      user: socket.user || null
    });
  });
});

server.listen(0, () => {
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  const testUser = `Hero_${Date.now()}`;

  async function runIntegration() {
    try {
      // 1. Registrieren via HTTP
      const regRes = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: testUser, password: 'password123', avatar_id: 'wizard_red' })
      });
      const regData = await regRes.json();
      assert.strictEqual(regData.success, true, 'Registrierung HTTP erfolgreich');
      assert.ok(regData.token, 'Token vorhanden');
      console.log(`✓ 1. HTTP Registrierung erfolgreich für ${testUser}`);

      // 2. Auth Profile abrufen via GET /api/auth/me
      const meRes = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${regData.token}` }
      });
      const meData = await meRes.json();
      assert.strictEqual(meData.success, true);
      assert.strictEqual(meData.user.username, testUser);
      assert.strictEqual(meData.user.avatar_id, 'wizard_red');
      console.log('✓ 2. GET /api/auth/me erfolgreich verifiziert');

      // 3. Socket.IO Handshake mit Auth Token
      const socket = ioClient(baseUrl, {
        auth: { token: regData.token },
        transports: ['websocket']
      });

      socket.on('connect', () => {
        socket.emit('whoami', (response) => {
          assert.strictEqual(response.authenticated, true);
          assert.strictEqual(response.user.username, testUser);
          console.log('✓ 3. Socket.IO Handshake-Auth erfolgreich verifiziert');

          // 4. Leaderboard abrufen
          fetch(`${baseUrl}/api/leaderboard`)
            .then(r => r.json())
            .then(lbData => {
              assert.strictEqual(lbData.success, true);
              assert.ok(Array.isArray(lbData.leaderboard));
              console.log('✓ 4. GET /api/leaderboard erfolgreich verifiziert');

              socket.disconnect();
              server.close(() => {
                console.log('\n=============================================');
                console.log('ALLE AUTH & SOCKET INTEGRATIONSTESTS BESTANDEN!');
                console.log('=============================================\n');
                process.exit(0);
              });
            });
        });
      });
    } catch (err) {
      console.error('Test fehlgeschlagen:', err);
      process.exit(1);
    }
  }

  runIntegration();
});
