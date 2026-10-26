const dns = require('dns');
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

// Globaler IPv4-Enforcer für Cloud-Container (Render / Docker ohne IPv6-Gateway)
const originalDnsLookup = dns.lookup;
dns.lookup = function(hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  if (typeof options === 'object' && options !== null) {
    if (!options.family || options.family === 0) {
      options = { ...options, family: 4 };
    }
  } else if (typeof options === 'number' && options === 0) {
    options = 4;
  }
  return originalDnsLookup.call(dns, hostname, options, callback);
};

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const {
  createDeck,
  shuffle,
  evaluateTrick,
  evaluateTrickDetails,
  isValidMove,
  calculatePoints,
  calculateTeamPoints,
  sortCards,
  isForbiddenBid,
  getMaxRounds,
  getEffectiveCard
} = require('./gameLogic');
const {
  createBotPlayer,
  calculateBotBid,
  chooseBotCard,
  chooseBotWitchSwap,
  chooseBotJugglerPass,
  chooseBotCloudAdjustment
} = require('./botLogic');

const {
  calculateSpectacleScore,
  recordTrickHighlight,
  generateMvpCandidates,
  resolveMvpVotingWinner
} = require('./matchHighlightAndMvp');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// CORS für mobile Apps (Capacitor) und plattformübergreifende API-Aufrufe
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const dbModule = require('./database');

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Grimoire Server',
    dbEngine: dbModule.getEngine(),
    dbError: typeof dbModule.getLastError === 'function' ? dbModule.getLastError() : null,
    uptime: Math.floor(process.uptime()),
    timestamp: Date.now()
  });
});

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// --- REST-API FÜR ACCOUNTS, STATISTIKEN & LEADERBOARDS ---
app.get('/api/auth/check-username', async (req, res, next) => {
  try {
    const username = req.query.username || '';
    const result = await dbModule.isUsernameAvailable(username);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const { username, password, avatar_id } = req.body || {};
    const result = await dbModule.registerUser(username, password, avatar_id);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    const result = await dbModule.loginUser(username, password);
    if (!result.success) {
      return res.status(401).json(result);
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

app.post('/api/auth/logout', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '') || req.body?.token;
    await dbModule.logoutUser(token);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

app.get('/api/auth/me', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '') || req.query.token;
    const user = await dbModule.getUserByToken(token);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Nicht authentifiziert' });
    }
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
});

app.post('/api/auth/phoenix-restore', async (req, res, next) => {
  try {
    const payload = req.body || {};
    if (!payload.username || typeof payload.username !== 'string') {
      return res.status(400).json({ success: false, error: 'Benutzername ist erforderlich für die Wiederherstellung.' });
    }
    const result = await dbModule.restoreUserPhoenix(payload);
    if (!result || !result.success) {
      return res.status(400).json({ success: false, error: result?.error || 'Wiederherstellung fehlgeschlagen.' });
    }
    console.log(`[PhoenixRestore] Account "${result.user.username}" (Stufe ${result.user.account_level}) erfolgreich wiederhergestellt!`);
    res.json({ success: true, token: result.token, user: result.user });
  } catch (err) {
    next(err);
  }
});

app.post('/api/auth/sync-backup', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '') || req.body?.token;
    const user = await dbModule.getUserByToken(token);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Nicht authentifiziert' });
    }
    const { inventory = [], equipped = {} } = req.body || {};
    if (Array.isArray(inventory)) {
      for (const item of inventory) {
        if (item && item.item_type && item.item_id) {
          await dbModule.awardCosmetic(user.id, item.item_type, item.item_id);
        }
      }
    }
    if (equipped.equipped_card_back) await dbModule.equipCosmetic(user.id, 'card_back', equipped.equipped_card_back);
    if (equipped.equipped_table_skin) await dbModule.equipCosmetic(user.id, 'table_skin', equipped.equipped_table_skin);
    if (equipped.equipped_avatar_frame) await dbModule.equipCosmetic(user.id, 'avatar_frame', equipped.equipped_avatar_frame);
    if (equipped.equipped_lobby_background) await dbModule.equipCosmetic(user.id, 'lobby_background', equipped.equipped_lobby_background);

    const freshUser = await dbModule.getUserById(user.id);
    const freshCosmetics = await dbModule.getUserCosmetics(user.id);
    res.json({ success: true, user: freshUser, inventory: freshCosmetics.inventory });
  } catch (err) {
    next(err);
  }
});

app.patch('/api/auth/profile', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '') || req.body?.token;
    const user = await dbModule.getUserByToken(token);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Nicht authentifiziert' });
    }
    const { avatar_id, title } = req.body || {};
    const updated = await dbModule.updateUserProfile(user.id, { avatar_id, title });
    res.json({ success: true, user: updated });
  } catch (err) {
    next(err);
  }
});

app.get('/api/leaderboard', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 10;
    const leaderboard = await dbModule.getLeaderboard(limit);
    res.json({ success: true, leaderboard });
  } catch (err) {
    next(err);
  }
});

app.get('/api/leaderboard/ranked', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 25;
    const leaderboard = await dbModule.getRankedLeaderboard(limit);
    res.json({ success: true, leaderboard });
  } catch (err) {
    next(err);
  }
});

// Schatzkammer & Kosmetik REST API
async function getAuthUserFromReq(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '') || req.body?.token || req.query?.token;
  if (!token) return null;
  return await dbModule.getUserByToken(token);
}

app.get('/api/vault/state', async (req, res, next) => {
  try {
    const user = await getAuthUserFromReq(req);
    if (!user) return res.status(401).json({ success: false, error: 'Nicht authentifiziert' });
    const data = await dbModule.getUserCosmetics(user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

app.post('/api/vault/open-chest', async (req, res, next) => {
  try {
    const user = await getAuthUserFromReq(req);
    if (!user) return res.status(401).json({ success: false, error: 'Nicht authentifiziert' });
    const { chestType } = req.body || {};
    const result = await dbModule.openChest(user.id, chestType);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

app.post('/api/vault/equip', async (req, res, next) => {
  try {
    const user = await getAuthUserFromReq(req);
    if (!user) return res.status(401).json({ success: false, error: 'Nicht authentifiziert' });
    const { itemType, itemId } = req.body || {};
    const result = await dbModule.equipCosmetic(user.id, itemType, itemId);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

app.post('/api/vault/craft', async (req, res, next) => {
  try {
    const user = await getAuthUserFromReq(req);
    if (!user) return res.status(401).json({ success: false, error: 'Nicht authentifiziert' });
    const { itemType, itemId } = req.body || {};
    const result = await dbModule.craftCosmetic(user.id, itemType, itemId);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

app.post('/api/vault/claim-milestone', async (req, res, next) => {
  try {
    const user = await getAuthUserFromReq(req);
    if (!user) return res.status(401).json({ success: false, error: 'Nicht authentifiziert' });
    const { milestoneId } = req.body || {};
    const result = await dbModule.claimWeeklyMilestone(user.id, milestoneId);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Globaler Express Error Handler für saubere JSON-Fehlerausgaben
app.use((err, req, res, next) => {
  console.error('[API Error]:', err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Serverfehler'
  });
});

// Socket.IO Handshake Authentifizierung
io.use(async (socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (token) {
    try {
      const user = await dbModule.getUserByToken(token);
      if (user) {
        socket.user = user;
      }
    } catch (e) {}
  }
  next();
});

// In-Memory Speicher für alle aktiven Spielräume
const rooms = {};

// Online-Benutzer & Socket-Zuordnung für Grimoire der Gefährten
const onlineUserSockets = new Map();

function registerUserSocket(userId, socket) {
  if (!userId || !socket) return;
  const numId = Number(userId);
  if (!onlineUserSockets.has(numId)) {
    onlineUserSockets.set(numId, new Set());
  }
  onlineUserSockets.get(numId).add(socket);
  socket.authenticatedUserId = numId;
}

function unregisterUserSocket(socket) {
  if (socket.authenticatedUserId && onlineUserSockets.has(socket.authenticatedUserId)) {
    const set = onlineUserSockets.get(socket.authenticatedUserId);
    set.delete(socket);
    if (set.size === 0) {
      onlineUserSockets.delete(socket.authenticatedUserId);
    }
  }
}

function getUserLiveStatus(userId) {
  const numId = Number(userId);
  if (!numId) return { status: 'offline', statusText: 'Offline', roomCode: null, isHost: false };

  for (const code in rooms) {
    const room = rooms[code];
    const player = room.players.find(p => p.userId === numId && p.connected);
    if (player) {
      if (room.gameState === 'lobby') {
        return {
          status: 'waiting_room',
          statusText: `Warteraum #${code}`,
          roomCode: code,
          isHost: room.hostSessionId === player.sessionId
        };
      } else {
        return {
          status: 'in_game',
          statusText: `Duell #${code} (Runde ${room.round})`,
          roomCode: code,
          isHost: room.hostSessionId === player.sessionId
        };
      }
    }
  }

  if (onlineUserSockets.has(numId) && onlineUserSockets.get(numId).size > 0) {
    return {
      status: 'citadel',
      statusText: 'In der Zitadelle',
      roomCode: null,
      isHost: false
    };
  }

  return {
    status: 'offline',
    statusText: 'Offline',
    roomCode: null,
    isHost: false
  };
}

async function sendFriendsListTo(target, userId) {
  const numId = Number(userId);
  const friends = await dbModule.getFriends(numId);
  const enriched = friends.map(f => {
    const live = getUserLiveStatus(f.id);
    return {
      ...f,
      liveStatus: live.status,
      liveStatusText: live.statusText,
      liveRoomCode: live.roomCode,
      isHost: live.isHost
    };
  });

  if (typeof target === 'number') {
    const sockets = onlineUserSockets.get(target);
    if (sockets) {
      for (const s of sockets) {
        s.emit('friendsList', { friends: enriched });
      }
    }
  } else if (target && target.emit) {
    target.emit('friendsList', { friends: enriched });
  }
}

// Bereinigt Namen und verhindert HTML-Injections (XSS)
function sanitizeName(name) {
  if (!name || typeof name !== 'string') return 'Spieler';
  const trimmed = name.trim().substring(0, 18);
  return trimmed.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[m]) || 'Spieler';
}

// Timer-Verwaltung für saubere Resets und Pausen
function clearRoomTimers(room) {
  if (room.timers && room.timers.length > 0) {
    room.timers.forEach(t => clearTimeout(t));
    room.timers = [];
  }
}

function setRoomTimeout(room, fn, ms) {
  if (!room.timers) room.timers = [];
  const t = setTimeout(() => {
    const idx = room.timers.indexOf(t);
    if (idx !== -1) room.timers.splice(idx, 1);
    fn();
  }, ms);
  room.timers.push(t);
  return t;
}

// Prüft und plant das Löschen verwaister Räume (nach 5 Min Inaktivität)
function checkRoomCleanup(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  const allDisconnected = room.players.length === 0 || room.players.every(p => !p.connected);

  if (allDisconnected) {
    if (!room.cleanupTimer) {
      room.cleanupTimer = setTimeout(() => {
        const r = rooms[roomCode];
        if (r && (r.players.length === 0 || r.players.every(p => !p.connected))) {
          clearRoomTimers(r);
          delete rooms[roomCode];
          console.log(`Raum ${roomCode} nach Inaktivität aufgeräumt.`);
        }
      }, 5 * 60 * 1000);
    }
  } else if (room.cleanupTimer) {
    clearTimeout(room.cleanupTimer);
    room.cleanupTimer = null;
  }
}

// Generiert einen kollisionsfreien 6-stelligen numerischen Raum-Code (100000 - 999999)
function generateUniqueRoomCode() {
  let code;
  let attempts = 0;
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
    attempts++;
  } while (rooms[code] && attempts < 10000);
  return code;
}

function createNewRoomState(hostSessionId = null, roomCode = '', isRanked = false) {
  return {
    players: [],
    roomCode: roomCode,
    gameState: 'lobby',
    matchFormat: 'ffa', // 'ffa' oder 'team_2v2'
    teams: {
      team_a: { name: 'Allianz des Sonnenfeuers', score: 0 },
      team_b: { name: 'Allianz der Mondschatten', score: 0 },
      team_c: { name: 'Allianz des Sternenwinds', score: 0 }
    },
    isRanked: !!isRanked,
    edition: 'classic', // 'classic' oder 'anniversary_30'
    scoringMode: 'classic', // 'classic' oder 'skull_king_zero'
    biddingMode: 'classic', // 'classic', 'simultaneous' oder 'secret'
    tableSkin: 'emerald_felt',
    round: 1,
    trumpCard: null,
    trumpChooserSessionId: null,
    vampireCopiedCard: null,
    cloudWinnerSessionId: null,
    cloudPlayerSessionId: null,
    cloudNextCallback: null,
    witchPlayerSessionId: null,
    witchNextCallback: null,
    jugglerPassSelections: {},
    jugglerNextLeadSessionId: null,
    jugglerNextCallback: null,
    remainingDeck: [],
    currentTurnIndex: 0,
    dealerIndex: 0,
    currentTrick: [],
    scoreHistory: [],
    hostSessionId: hostSessionId,
    isPaused: false,
    pausedReason: null,
    timers: [],
    cleanupTimer: null
  };
}

io.on('connection', (socket) => {

  if (socket.user && socket.user.id) {
    registerUserSocket(socket.user.id, socket);
    sendFriendsListTo(socket, socket.user.id);
  }

  socket.on('authIdentify', async ({ token }) => {
    if (token) {
      const user = await dbModule.getUserByToken(token);
      if (user) {
        socket.user = user;
        registerUserSocket(user.id, socket);
        await sendFriendsListTo(socket, user.id);
      }
    }
  });

  socket.on('getFriends', async ({ token } = {}) => {
    let authUser = socket.user;
    if (!authUser && token) {
      authUser = await dbModule.getUserByToken(token);
      if (authUser) {
        socket.user = authUser;
        registerUserSocket(authUser.id, socket);
      }
    }
    if (!authUser) {
      socket.emit('friendsError', { message: 'Nur angemeldete Magier können das Grimoire der Gefährten nutzen.' });
      return;
    }
    await sendFriendsListTo(socket, authUser.id);
  });

  socket.on('addFriend', async ({ friendUsername, token }) => {
    let authUser = socket.user;
    if (!authUser && token) {
      authUser = await dbModule.getUserByToken(token);
      if (authUser) {
        socket.user = authUser;
        registerUserSocket(authUser.id, socket);
      }
    }
    if (!authUser) {
      socket.emit('friendActionError', { message: 'Nicht angemeldet.' });
      return;
    }

    const res = await dbModule.addFriend(authUser.id, friendUsername);
    if (!res.success) {
      socket.emit('friendActionError', { message: res.error });
      return;
    }

    socket.emit('friendActionSuccess', { message: `${res.friend.username} ist nun dein Gefährte! ✨` });
    await sendFriendsListTo(socket, authUser.id);
    await sendFriendsListTo(res.friend.id, res.friend.id);
  });

  socket.on('removeFriend', async ({ friendId, token }) => {
    let authUser = socket.user;
    if (!authUser && token) {
      authUser = await dbModule.getUserByToken(token);
      if (authUser) {
        socket.user = authUser;
        registerUserSocket(authUser.id, socket);
      }
    }
    if (!authUser) {
      socket.emit('friendActionError', { message: 'Nicht angemeldet.' });
      return;
    }

    await dbModule.removeFriend(authUser.id, friendId);
    socket.emit('friendActionSuccess', { message: 'Gefährte wurde entfernt.' });
    await sendFriendsListTo(socket, authUser.id);
    await sendFriendsListTo(friendId, friendId);
  });

  socket.on('inviteFriendToRoom', async ({ friendId, roomCode, token }) => {
    let authUser = socket.user;
    if (!authUser && token) {
      authUser = await dbModule.getUserByToken(token);
      if (authUser) {
        socket.user = authUser;
        registerUserSocket(authUser.id, socket);
      }
    }
    if (!authUser) {
      socket.emit('friendActionError', { message: 'Nicht angemeldet.' });
      return;
    }

    const normCode = roomCode ? roomCode.trim().toUpperCase() : null;
    if (!normCode || !rooms[normCode]) {
      socket.emit('friendActionError', { message: 'Der Spielraum existiert nicht mehr.' });
      return;
    }
    const room = rooms[normCode];
    if (room.players.length >= 6) {
      socket.emit('friendActionError', { message: 'Der Warteraum ist bereits voll (6/6).' });
      return;
    }
    if (room.gameState !== 'lobby') {
      socket.emit('friendActionError', { message: 'Das Spiel hat bereits begonnen.' });
      return;
    }

    const targetSockets = onlineUserSockets.get(Number(friendId));
    if (!targetSockets || targetSockets.size === 0) {
      socket.emit('friendActionError', { message: 'Dein Gefährte ist derzeit nicht in der Zitadelle erreichbar.' });
      return;
    }

    for (const s of targetSockets) {
      s.emit('friendGameInvite', {
        hostName: authUser.username,
        hostAvatar: authUser.avatar_id || 'wizard_blue',
        hostTitle: authUser.title || 'Zauberlehrling',
        hostRank: authUser.rank || dbModule.getRankDetailsFromSR(authUser.skill_rating || 1000),
        roomCode: normCode,
        isRanked: !!room.isRanked
      });
    }

    socket.emit('friendActionSuccess', { message: 'Einladung an deinen Gefährten versandt! ✉️' });
  });

  // ==========================================
  // SCHATZKAMMER & KOSMETIK (ETAPPE 6) SOCKETS
  // ==========================================
  socket.on('vault:getState', async ({ token } = {}) => {
    let authUser = socket.user;
    if (!authUser && token) {
      authUser = await dbModule.getUserByToken(token);
      if (authUser) {
        socket.user = authUser;
        registerUserSocket(authUser.id, socket);
      }
    }
    if (!authUser) {
      socket.emit('vault:error', { message: 'Nur angemeldete Magier können die Schatzkammer betreten.' });
      return;
    }
    const state = await dbModule.getUserCosmetics(authUser.id);
    socket.emit('vault:state', state);
  });

  socket.on('vault:openChest', async ({ chestType, token } = {}) => {
    let authUser = socket.user;
    if (!authUser && token) {
      authUser = await dbModule.getUserByToken(token);
      if (authUser) {
        socket.user = authUser;
        registerUserSocket(authUser.id, socket);
      }
    }
    if (!authUser) {
      socket.emit('vault:error', { message: 'Nicht angemeldet.' });
      return;
    }
    const res = await dbModule.openChest(authUser.id, chestType);
    if (!res.success) {
      socket.emit('vault:error', { message: res.error });
      return;
    }
    const updatedUser = await dbModule.getUserById(authUser.id);
    socket.user = updatedUser;
    socket.emit('vault:chestOpened', { ...res, user: updatedUser });
  });

  const handleCosmeticEquip = async ({ itemType, itemId, token } = {}) => {
    let authUser = socket.user;
    if (!authUser && token) {
      authUser = await dbModule.getUserByToken(token);
      if (authUser) {
        socket.user = authUser;
        registerUserSocket(authUser.id, socket);
      }
    }
    if (!authUser) {
      socket.emit('vault:error', { message: 'Nicht angemeldet.' });
      return;
    }
    const res = await dbModule.equipCosmetic(authUser.id, itemType, itemId);
    if (!res.success) {
      socket.emit('vault:error', { message: res.error });
      return;
    }
    socket.user = res.user;
    socket.emit('vault:equipped', res);

    // Wenn der Spieler sich in einem Raum befindet: Sofort für alle Mitspieler aktualisieren
    if (socket.roomCode && socket.sessionId) {
      const room = rooms[socket.roomCode];
      if (room && room.players) {
        const p = room.players.find(pl => pl.sessionId === socket.sessionId);
        if (p) {
          if (itemType === 'avatar_icon') p.avatarId = itemId;
          if (itemType === 'title') p.title = itemId;
          if (itemType === 'card_back') p.cardBack = itemId;
          if (itemType === 'avatar_frame') p.avatarFrame = itemId;
          if (itemType === 'table_skin' && p.isHost) {
            room.tableSkin = itemId;
          }
          broadcastRoomUpdated(room);
          io.to(socket.roomCode).emit('playerCosmeticsUpdated', {
            sessionId: p.sessionId,
            itemType,
            itemId,
            tableSkin: room.tableSkin
          });
        }
      }
    }
  };

  socket.on('vault:equip', handleCosmeticEquip);
  socket.on('wardrobe:equip', handleCosmeticEquip);

  socket.on('vault:craft', async ({ itemType, itemId, token } = {}) => {
    let authUser = socket.user;
    if (!authUser && token) {
      authUser = await dbModule.getUserByToken(token);
      if (authUser) {
        socket.user = authUser;
        registerUserSocket(authUser.id, socket);
      }
    }
    if (!authUser) {
      socket.emit('vault:error', { message: 'Nicht angemeldet.' });
      return;
    }
    const res = await dbModule.craftCosmetic(authUser.id, itemType, itemId);
    if (!res.success) {
      socket.emit('vault:error', { message: res.error });
      return;
    }
    const updatedUser = await dbModule.getUserById(authUser.id);
    socket.user = updatedUser;
    socket.emit('vault:crafted', { ...res, user: updatedUser });
  });

  socket.on('vault:claimMilestone', async ({ milestoneId, token } = {}) => {
    let authUser = socket.user;
    if (!authUser && token) {
      authUser = await dbModule.getUserByToken(token);
      if (authUser) {
        socket.user = authUser;
        registerUserSocket(authUser.id, socket);
      }
    }
    if (!authUser) {
      socket.emit('vault:error', { message: 'Nicht angemeldet.' });
      return;
    }
    const res = await dbModule.claimWeeklyMilestone(authUser.id, milestoneId);
    if (!res.success) {
      socket.emit('vault:error', { message: res.error });
      return;
    }
    const updatedUser = await dbModule.getUserById(authUser.id);
    socket.user = updatedUser;
    socket.emit('vault:milestoneClaimed', { ...res, user: updatedUser });
  });

  // Neues Spiel erstellen mit garantiert einmaligem 6-stelligen Zahlencode
  socket.on('createRoom', async ({ playerName, sessionId, roomCode, authToken, isRanked }) => {
    if (!sessionId) {
      socket.emit('lobbyError', { message: 'Ungültige Session-Daten.' });
      return;
    }

    let authUser = socket.user;
    if (!authUser && authToken) {
      authUser = await dbModule.getUserByToken(authToken);
    }

    const isRankedRoom = !!isRanked;
    if (isRankedRoom && !authUser) {
      socket.emit('lobbyError', { message: 'Für gewertete Ranglistenspiele musst du mit einem Gilden-Konto angemeldet sein!' });
      return;
    }

    if (authUser) {
      const penaltyNotice = await dbModule.popPenaltyNotice(authUser.id);
      if (penaltyNotice) {
        socket.emit('rankedPenaltyNotice', {
          penaltyAmount: 50,
          newSR: authUser.skill_rating || 1000,
          rank: authUser.rank,
          notice: penaltyNotice,
          message: penaltyNotice
        });
      }
    }

    const cleanName = authUser ? authUser.username : sanitizeName(playerName);
    // Falls ein spezifischer Code angegeben wurde und frei ist (z.B. in Tests), sonst neuen Zahlencode generieren:
    const code = (roomCode && typeof roomCode === 'string' && !rooms[roomCode.trim().toUpperCase()])
      ? roomCode.trim().toUpperCase().substring(0, 10)
      : generateUniqueRoomCode();

    const room = createNewRoomState(sessionId, code, isRankedRoom);
    if (authUser && authUser.equipped_table_skin) {
      room.tableSkin = authUser.equipped_table_skin;
    }
    const hostPlayer = {
      sessionId,
      socketId: socket.id,
      userId: authUser ? authUser.id : null,
      userStats: authUser ? {
        gamesPlayed: authUser.games_played || 0,
        gamesWon: authUser.games_won || 0,
        winRate: (authUser.games_played > 0) ? Math.round(((authUser.games_won || 0) / authUser.games_played) * 100) : 0,
        highestScore: authUser.highest_score || 0,
        skillRating: authUser.skill_rating || 1000
      } : null,
      name: cleanName,
      avatarId: authUser ? (authUser.avatar_id || 'wizard_blue') : 'wizard_blue',
      title: authUser ? (authUser.title || 'Zauberlehrling') : 'Zauberlehrling',
      accountLevel: authUser ? (authUser.account_level || 1) : 1,
      cardBack: authUser ? (authUser.equipped_card_back || 'default') : 'default',
      avatarFrame: authUser ? (authUser.equipped_avatar_frame || 'none') : 'none',
      skillRating: authUser ? (authUser.skill_rating || 1000) : null,
      rank: authUser ? authUser.rank : null,
      team: null,
      hand: [],
      bid: null,
      tricksWon: 0,
      totalScore: 0,
      connected: true
    };
    room.players.push(hostPlayer);
    rooms[code] = room;

    socket.join(code);
    socket.emit('roomCreated', { roomCode: code, isRanked: isRankedRoom, scoringMode: room.scoringMode || 'classic' });

    socket.emit('syncGameState', {
      roomCode: code,
      round: 1,
      maxRounds: getMaxRounds(1, room.edition || 'classic'),
      edition: room.edition || 'classic',
      gameState: 'lobby',
      matchFormat: room.matchFormat || 'ffa',
      scoringMode: room.scoringMode || 'classic',
      biddingMode: room.biddingMode || 'classic',
      tableSkin: room.tableSkin || 'emerald_felt',
      teams: room.teams || null,
      isRanked: isRankedRoom,
      trumpCard: null,
      hand: [],
      currentTrick: [],
      players: getSanitizedPlayers(room.players, 0, room.hostSessionId, room),
      activePlayerSessionId: null,
      dealerSessionId: sessionId,
      scoreHistory: [],
      hostSessionId: sessionId,
      forbiddenBid: null,
      isPaused: false,
      pausedReason: null,
      isGameOver: false
    });

    io.to(code).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId, room));
  });

  // Spieler tritt einem Raum bei
  socket.on('joinRoom', async ({ playerName, roomCode, sessionId, createIfNotExists, authToken }) => {
    if (!roomCode || typeof roomCode !== 'string' || !sessionId) {
      socket.emit('lobbyError', { message: 'Ungültige Raum- oder Session-Daten.' });
      return;
    }

    let authUser = socket.user;
    if (!authUser && authToken) {
      authUser = await dbModule.getUserByToken(authToken);
    }

    const normalizedCode = roomCode.trim().toUpperCase().substring(0, 10);
    const cleanName = authUser ? authUser.username : sanitizeName(playerName);

    if (!rooms[normalizedCode]) {
      // Abwärtskompatibilität für bestehende automatisierte Tests
      if (createIfNotExists || normalizedCode === 'TESTROOM' || normalizedCode === 'PAUSEROOM') {
        rooms[normalizedCode] = createNewRoomState(null, normalizedCode);
      } else {
        socket.emit('lobbyError', { message: `Kein aktiver Raum mit dem Zahlencode "${normalizedCode}" gefunden. Bitte prüfe die Eingabe oder erstelle ein neues Spiel.` });
        return;
      }
    }

    const room = rooms[normalizedCode];
    if (room.cleanupTimer) {
      clearTimeout(room.cleanupTimer);
      room.cleanupTimer = null;
    }

    if (authUser) {
      const penaltyNotice = await dbModule.popPenaltyNotice(authUser.id);
      if (penaltyNotice) {
        socket.emit('rankedPenaltyNotice', {
          penaltyAmount: 50,
          newSR: authUser.skill_rating || 1000,
          rank: authUser.rank,
          notice: penaltyNotice,
          message: penaltyNotice
        });
      }
    }

    if (room.isRanked && !authUser) {
      socket.emit('lobbyError', { message: 'Dieser Bund ist ein gewertetes Ranglistenspiel. Bitte melde dich an, um beizutreten!' });
      return;
    }

    const existingPlayer = room.players.find(p => p.sessionId === sessionId);

    if (existingPlayer) {
      existingPlayer.socketId = socket.id;
      existingPlayer.connected = true;
      if (authUser) {
        existingPlayer.userId = authUser.id;
        existingPlayer.avatarId = authUser.avatar_id || 'wizard_blue';
        existingPlayer.title = authUser.title || 'Zauberlehrling';
        existingPlayer.accountLevel = authUser.account_level || 1;
        existingPlayer.cardBack = authUser.equipped_card_back || 'default';
        existingPlayer.avatarFrame = authUser.equipped_avatar_frame || 'none';
        existingPlayer.skillRating = authUser.skill_rating || 1000;
        existingPlayer.rank = authUser.rank;
        existingPlayer.userStats = {
          gamesPlayed: authUser.games_played || 0,
          gamesWon: authUser.games_won || 0,
          winRate: (authUser.games_played > 0) ? Math.round(((authUser.games_won || 0) / authUser.games_played) * 100) : 0,
          highestScore: authUser.highest_score || 0,
          skillRating: authUser.skill_rating || 1000
        };
      }
      if (cleanName && cleanName !== existingPlayer.name) {
        const nameTaken = room.players.some(p => p.sessionId !== sessionId && p.name.trim().toLowerCase() === cleanName.toLowerCase());
        if (!nameTaken) {
          existingPlayer.name = cleanName;
        }
      }
      socket.join(normalizedCode);

      if (!room.hostSessionId && room.players.length > 0) {
        room.hostSessionId = room.players[0].sessionId;
      }

      // Prüfen, ob alle Spieler wieder verbunden sind
      if (room.isPaused && room.players.every(p => p.connected)) {
        room.isPaused = false;
        room.pausedReason = null;
        io.to(normalizedCode).emit('gameResumed');
      }

      let activePlayer = null;
      if (room.gameState === 'choose_trump') {
        if (room.trumpChooserSessionId) {
          activePlayer = room.players.find(p => p.sessionId === room.trumpChooserSessionId);
        }
        if (!activePlayer) {
          activePlayer = room.players[room.dealerIndex];
        }
      } else if (room.players[room.currentTurnIndex]) {
        activePlayer = room.players[room.currentTurnIndex];
      }

      const isLastPlayer = (room.currentTurnIndex === room.dealerIndex);
      let forbiddenBid = null;
      if (room.gameState === 'bidding' && isLastPlayer) {
        const totalBidsSoFar = room.players.reduce((sum, p) => sum + (p.bid !== null ? p.bid : 0), 0);
        forbiddenBid = room.round - totalBidsSoFar;
        if (forbiddenBid < 0) forbiddenBid = null;
      }

      const maxRounds = getMaxRounds(room.players.length, room.edition || 'classic');
      const isGameOver = room.gameState === 'round_over' && room.round >= maxRounds;

      socket.emit('syncGameState', {
        roomCode: normalizedCode,
        round: room.round,
        maxRounds: maxRounds,
        edition: room.edition || 'classic',
        gameState: room.gameState,
        tableSkin: room.tableSkin || 'emerald_felt',
        isRanked: room.isRanked,
        trumpCard: room.trumpCard,
        trumpChooserSessionId: room.trumpChooserSessionId,
        hand: (room.round === 1 && existingPlayer.hand && existingPlayer.hand.length > 0)
          ? [{ type: 'blind_card', isBlind: true, id: 'blind-1' }]
          : (existingPlayer.hand || []),
        currentTrick: room.currentTrick,
        players: getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId, room),
        activePlayerSessionId: activePlayer ? activePlayer.sessionId : null,
        dealerSessionId: room.players[room.dealerIndex] ? room.players[room.dealerIndex].sessionId : null,
        scoreHistory: room.scoreHistory,
        hostSessionId: room.hostSessionId,
        forbiddenBid: forbiddenBid,
        isPaused: room.isPaused,
        pausedReason: room.pausedReason,
        isGameOver: isGameOver,
        matchFormat: room.matchFormat || 'ffa',
      scoringMode: room.scoringMode || 'classic',
      biddingMode: room.biddingMode || 'classic',
        teams: room.teams || null,
        vampireCopiedCard: room.vampireCopiedCard,
        cloudWinnerSessionId: room.cloudPlayerSessionId,
        cloudPlayerSessionId: room.cloudPlayerSessionId,
        witchPlayerSessionId: room.witchPlayerSessionId
      });

      if (room.gameState === 'cloud_adjust_bid' && (room.cloudPlayerSessionId === existingPlayer.sessionId || room.cloudWinnerSessionId === existingPlayer.sessionId)) {
        socket.emit('cloudBidAdjustmentPrompt', { currentBid: existingPlayer.bid !== null ? existingPlayer.bid : 0 });
      }

      if (room.gameState === 'witch_swap' && room.witchPlayerSessionId === existingPlayer.sessionId) {
        socket.emit('witchSwapPrompt', {
          trickCards: room.currentTrick,
          handCards: existingPlayer.hand || []
        });
      }

      if (room.gameState === 'juggler_passing' && existingPlayer.hand && existingPlayer.hand.length > 0 && room.jugglerPassSelections[existingPlayer.sessionId] === undefined) {
        socket.emit('jugglerPassPrompt', {
          message: 'Der Jongleur fordert seinen Tribut! Wähle 1 Handkarte zum verdeckten Weitergeben.',
          hand: existingPlayer.hand
        });
      }

      io.to(normalizedCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId, room));
      return;
    }

    if (room.players.length >= 6) {
      socket.emit('lobbyError', { message: 'Der Raum ist voll (maximal 6 Spieler).' });
      return;
    }

    if (room.gameState !== 'lobby') {
      socket.emit('lobbyError', { message: 'Das Spiel läuft bereits.' });
      return;
    }

    // Namens-Duplikat-Prüfung: Kein doppelter Name im selben Raum
    const nameTaken = room.players.some(p => p.name.trim().toLowerCase() === cleanName.toLowerCase());
    if (nameTaken) {
      socket.emit('lobbyError', { message: `Der Name "${cleanName}" ist in diesem Raum bereits vergeben. Bitte wähle einen anderen Spielernamen.` });
      return;
    }

    socket.join(normalizedCode);

    if (room.players.length === 0 || !room.hostSessionId) {
      room.hostSessionId = sessionId;
    }

    const newPlayer = {
      sessionId,
      socketId: socket.id,
      userId: authUser ? authUser.id : null,
      userStats: authUser ? {
        gamesPlayed: authUser.games_played || 0,
        gamesWon: authUser.games_won || 0,
        winRate: (authUser.games_played > 0) ? Math.round(((authUser.games_won || 0) / authUser.games_played) * 100) : 0,
        highestScore: authUser.highest_score || 0,
        skillRating: authUser.skill_rating || 1000
      } : null,
      name: cleanName,
      avatarId: authUser ? (authUser.avatar_id || 'wizard_blue') : 'wizard_blue',
      title: authUser ? (authUser.title || 'Zauberlehrling') : 'Zauberlehrling',
      accountLevel: authUser ? (authUser.account_level || 1) : 1,
      cardBack: authUser ? (authUser.equipped_card_back || 'default') : 'default',
      avatarFrame: authUser ? (authUser.equipped_avatar_frame || 'none') : 'none',
      skillRating: authUser ? (authUser.skill_rating || 1000) : null,
      rank: authUser ? authUser.rank : null,
      team: null,
      hand: [],
      bid: null,
      tricksWon: 0,
      totalScore: 0,
      connected: true
    };
    room.players.push(newPlayer);

    const maxRounds = getMaxRounds(room.players.length, room.edition || 'classic');
    socket.emit('syncGameState', {
      roomCode: normalizedCode,
      round: room.round,
      maxRounds: maxRounds,
      edition: room.edition || 'classic',
      gameState: room.gameState,
      matchFormat: room.matchFormat || 'ffa',
      scoringMode: room.scoringMode || 'classic',
      biddingMode: room.biddingMode || 'classic',
      tableSkin: room.tableSkin || 'emerald_felt',
      teams: room.teams || null,
      isRanked: room.isRanked,
      trumpCard: room.trumpCard,
      hand: [],
      currentTrick: room.currentTrick,
      players: getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId, room),
      activePlayerSessionId: null,
      dealerSessionId: room.players[room.dealerIndex] ? room.players[room.dealerIndex].sessionId : null,
      scoreHistory: room.scoreHistory,
      hostSessionId: room.hostSessionId,
      forbiddenBid: null,
      isPaused: room.isPaused,
      pausedReason: room.pausedReason,
      isGameOver: false
    });

    io.to(normalizedCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId, room));
  });

  // Host ändert die gespielte Edition (classic vs. anniversary_30)
  socket.on('setEdition', ({ roomCode, edition }) => {
    const normalizedCode = (roomCode || '').trim().toUpperCase();
    const room = rooms[normalizedCode];
    if (!room) return;

    if (room.gameState !== 'lobby') {
      socket.emit('actionError', { message: 'Die Edition kann nur im Warteraum vor Spielbeginn geändert werden!' });
      return;
    }

    if (!room.hostSessionId && room.players.length > 0) {
      room.hostSessionId = room.players[0].sessionId;
    }

    const hostPlayer = room.players.find(p => p.sessionId === room.hostSessionId);
    if (!hostPlayer || socket.id !== hostPlayer.socketId) {
      socket.emit('actionError', { message: 'Nur der Host darf die Edition ändern!' });
      return;
    }

    if (!['classic', 'anniversary_30'].includes(edition)) {
      socket.emit('actionError', { message: 'Ungültige Edition.' });
      return;
    }

    room.edition = edition;
    io.to(normalizedCode).emit('editionChanged', { edition: room.edition });
  });

  // Host ändert das Spielformat ('ffa' vs. 'team_2v2')
  socket.on('setMatchFormat', ({ roomCode, matchFormat }) => {
    const normalizedCode = (roomCode || '').trim().toUpperCase();
    const room = rooms[normalizedCode];
    if (!room) return;

    if (room.gameState !== 'lobby') {
      socket.emit('actionError', { message: 'Das Spielformat kann nur im Warteraum geändert werden!' });
      return;
    }

    if (!room.hostSessionId && room.players.length > 0) {
      room.hostSessionId = room.players[0].sessionId;
    }

    const hostPlayer = room.players.find(p => p.sessionId === room.hostSessionId);
    if (!hostPlayer || socket.id !== hostPlayer.socketId) {
      socket.emit('actionError', { message: 'Nur der Host darf das Spielformat ändern!' });
      return;
    }

    if (!['ffa', 'team_2v2'].includes(matchFormat)) {
      socket.emit('actionError', { message: 'Ungültiges Spielformat.' });
      return;
    }

    room.matchFormat = matchFormat;
    // Spieler starten im Allianzen-Modus neutral
    room.players.forEach(p => { p.team = null; });

    io.to(normalizedCode).emit('matchFormatChanged', { matchFormat: room.matchFormat, teams: room.teams });
    io.to(normalizedCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId, room));
  });

  // Host aktualisiert Raum-Einstellungen (Edition, MatchFormat, ScoringMode, BiddingMode)
  socket.on('updateRoomSettings', ({ roomCode, edition, matchFormat, scoringMode, biddingMode }) => {
    const normalizedCode = (roomCode || '').trim().toUpperCase();
    const room = rooms[normalizedCode];
    if (!room) return;

    if (room.gameState !== 'lobby') {
      socket.emit('actionError', { message: 'Die Spieleinstellungen können nur im Warteraum vor Spielbeginn geändert werden!' });
      return;
    }

    if (!room.hostSessionId && room.players.length > 0) {
      room.hostSessionId = room.players[0].sessionId;
    }

    const hostPlayer = room.players.find(p => p.sessionId === room.hostSessionId);
    if (!hostPlayer || socket.id !== hostPlayer.socketId) {
      socket.emit('actionError', { message: 'Nur der Host darf die Spieleinstellungen ändern!' });
      return;
    }

    if (edition && ['classic', 'anniversary_30'].includes(edition)) {
      room.edition = edition;
    }

    if (scoringMode && ['classic', 'skull_king_zero'].includes(scoringMode)) {
      room.scoringMode = scoringMode;
    }

    if (biddingMode && ['classic', 'simultaneous', 'secret'].includes(biddingMode)) {
      room.biddingMode = biddingMode;
    }

    if (matchFormat && ['ffa', 'team_2v2'].includes(matchFormat)) {
      room.matchFormat = matchFormat;
      room.players.forEach(p => { p.team = null; });
    }

    io.to(normalizedCode).emit('roomSettingsUpdated', {
      edition: room.edition,
      matchFormat: room.matchFormat,
      scoringMode: room.scoringMode || 'classic',
      biddingMode: room.biddingMode || 'classic',
      teams: room.teams
    });
    io.to(normalizedCode).emit('editionChanged', { edition: room.edition });
    io.to(normalizedCode).emit('matchFormatChanged', { matchFormat: room.matchFormat, teams: room.teams });
    io.to(normalizedCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId, room));
  });

  socket.on('setScoringMode', ({ roomCode, scoringMode }) => {
    const normalizedCode = (roomCode || '').trim().toUpperCase();
    const room = rooms[normalizedCode];
    if (!room) return;
    if (room.gameState !== 'lobby') {
      socket.emit('actionError', { message: 'Das Wertungssystem kann nur im Warteraum geändert werden!' });
      return;
    }
    if (!room.hostSessionId && room.players.length > 0) {
      room.hostSessionId = room.players[0].sessionId;
    }
    const hostPlayer = room.players.find(p => p.sessionId === room.hostSessionId);
    if (!hostPlayer || socket.id !== hostPlayer.socketId) {
      socket.emit('actionError', { message: 'Nur der Host darf das Wertungssystem ändern!' });
      return;
    }
    if (!['classic', 'skull_king_zero'].includes(scoringMode)) {
      socket.emit('actionError', { message: 'Ungültiger Wertungsmodus.' });
      return;
    }
    room.scoringMode = scoringMode;
    io.to(normalizedCode).emit('roomSettingsUpdated', {
      edition: room.edition,
      matchFormat: room.matchFormat,
      scoringMode: room.scoringMode,
      biddingMode: room.biddingMode || 'classic',
      teams: room.teams
    });
    io.to(normalizedCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId, room));
  });

  socket.on('setBiddingMode', ({ roomCode, biddingMode }) => {
    const normalizedCode = (roomCode || '').trim().toUpperCase();
    const room = rooms[normalizedCode];
    if (!room) return;
    if (room.gameState !== 'lobby') {
      socket.emit('actionError', { message: 'Der Biet-Modus kann nur im Warteraum geändert werden!' });
      return;
    }
    if (!room.hostSessionId && room.players.length > 0) {
      room.hostSessionId = room.players[0].sessionId;
    }
    const hostPlayer = room.players.find(p => p.sessionId === room.hostSessionId);
    if (!hostPlayer || socket.id !== hostPlayer.socketId) {
      socket.emit('actionError', { message: 'Nur der Host darf den Biet-Modus ändern!' });
      return;
    }
    if (!['classic', 'simultaneous', 'secret'].includes(biddingMode)) {
      socket.emit('actionError', { message: 'Ungültiger Biet-Modus.' });
      return;
    }
    room.biddingMode = biddingMode;
    io.to(normalizedCode).emit('roomSettingsUpdated', {
      edition: room.edition,
      matchFormat: room.matchFormat,
      scoringMode: room.scoringMode,
      biddingMode: room.biddingMode,
      teams: room.teams
    });
    io.to(normalizedCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId, room));
  });

  // Spieler wechselt Allianz im Allianzen-Modus
  socket.on('switchTeam', ({ roomCode, team }) => {
    const normalizedCode = (roomCode || '').trim().toUpperCase();
    const room = rooms[normalizedCode];
    if (!room) return;

    if (room.gameState !== 'lobby') {
      socket.emit('actionError', { message: 'Allianzen können nur im Warteraum gewechselt werden!' });
      return;
    }

    if (room.matchFormat !== 'team_2v2') {
      socket.emit('actionError', { message: 'Allianzen sind nur im Allianzen-Modus verfügbar!' });
      return;
    }

    if (team !== null && !['team_a', 'team_b', 'team_c'].includes(team)) {
      socket.emit('actionError', { message: 'Ungültige Allianz.' });
      return;
    }

    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) {
      socket.emit('actionError', { message: 'Spieler nicht gefunden.' });
      return;
    }

    // Zurück zu Neutral
    if (team === null) {
      player.team = null;
      io.to(normalizedCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId, room));
      return;
    }

    if (player.team === team) return;

    const currentInTargetTeam = room.players.filter(p => p.team === team && p.sessionId !== player.sessionId).length;
    if (currentInTargetTeam >= 2) {
      socket.emit('actionError', { message: 'Dieses Bündnis ist bereits voll (maximal 2 Magier)!' });
      return;
    }

    player.team = team;
    io.to(normalizedCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId, room));
  });

  // Host würfelt Allianzen zufällig aus
  socket.on('randomizeTeams', ({ roomCode }) => {
    const normalizedCode = (roomCode || '').trim().toUpperCase();
    const room = rooms[normalizedCode];
    if (!room) return;

    if (room.gameState !== 'lobby') {
      socket.emit('actionError', { message: 'Allianzen können nur im Warteraum gewürfelt werden!' });
      return;
    }

    if (room.matchFormat !== 'team_2v2') {
      socket.emit('actionError', { message: 'Allianzen-Würfeln ist nur im Allianzen-Modus verfügbar!' });
      return;
    }

    const hostPlayer = room.players.find(p => p.sessionId === room.hostSessionId);
    if (!hostPlayer || socket.id !== hostPlayer.socketId) {
      socket.emit('actionError', { message: 'Nur der Host darf die Allianzen auswürfeln!' });
      return;
    }

    const connectedPlayers = room.players.filter(p => p.connected);
    if (connectedPlayers.length < 2) {
      socket.emit('actionError', { message: 'Mindestens 2 Magier erforderlich!' });
      return;
    }

    // Fisher-Yates Shuffle
    const shuffled = [...connectedPlayers];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Wenn <= 4 Spieler: 2 Allianzen (team_a, team_b)
    // Wenn > 4 Spieler: 3 Allianzen (team_a, team_b, team_c)
    const targetTeams = (connectedPlayers.length > 4)
      ? ['team_a', 'team_b', 'team_c']
      : ['team_a', 'team_b'];

    // Alle Spieler zunächst neutral stellen
    room.players.forEach(p => { p.team = null; });

    let teamIdx = 0;
    shuffled.forEach(p => {
      // Finde nächstes Team mit < 2 Mitgliedern
      for (let offset = 0; offset < targetTeams.length; offset++) {
        const candidateTeam = targetTeams[(teamIdx + offset) % targetTeams.length];
        const count = room.players.filter(pl => pl.team === candidateTeam).length;
        if (count < 2) {
          p.team = candidateTeam;
          teamIdx = (teamIdx + offset + 1) % targetTeams.length;
          break;
        }
      }
    });

    io.to(normalizedCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId, room));
  });

  // Host fügt einen KI-Magier (Bot) zur Kammer hinzu
  socket.on('addBot', ({ roomCode, difficulty }) => {
    const normalizedCode = (roomCode || '').trim().toUpperCase();
    const room = rooms[normalizedCode];
    if (!room) return;

    if (room.gameState !== 'lobby') {
      socket.emit('actionError', { message: 'Bots können nur im Warteraum hinzugefügt werden.' });
      return;
    }

    const hostPlayer = room.players.find(p => p.sessionId === room.hostSessionId);
    if (!hostPlayer || socket.id !== hostPlayer.socketId) {
      socket.emit('actionError', { message: 'Nur der Host kann Bots verwalten!' });
      return;
    }

    if (room.players.length >= 6) {
      socket.emit('actionError', { message: 'Die Kammer ist bereits voll (maximal 6 Spieler)!' });
      return;
    }

    const botDiff = ['novice', 'master', 'archmage'].includes(difficulty) ? difficulty : 'master';
    const bot = createBotPlayer(room.players, botDiff);
    bot.team = null; // Bots starten ebenfalls neutral
    room.players.push(bot);

    io.to(normalizedCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId, room));
  });

  // Host entfernt einen KI-Magier (gezielt per botSessionId oder den zuletzt hinzugefügten)
  socket.on('removeBot', ({ roomCode, botSessionId }) => {
    const normalizedCode = (roomCode || '').trim().toUpperCase();
    const room = rooms[normalizedCode];
    if (!room) return;

    if (room.gameState !== 'lobby') {
      socket.emit('actionError', { message: 'Bots können nur im Warteraum entfernt werden.' });
      return;
    }

    const hostPlayer = room.players.find(p => p.sessionId === room.hostSessionId);
    if (!hostPlayer || socket.id !== hostPlayer.socketId) {
      socket.emit('actionError', { message: 'Nur der Host kann Bots verwalten!' });
      return;
    }

    let botIdx = -1;
    if (botSessionId) {
      botIdx = room.players.findIndex(p => p.isBot && p.sessionId === botSessionId);
    } else {
      for (let i = room.players.length - 1; i >= 0; i--) {
        if (room.players[i].isBot) {
          botIdx = i;
          break;
        }
      }
    }

    if (botIdx === -1) {
      socket.emit('actionError', { message: 'Kein passender Bot im Raum vorhanden.' });
      return;
    }

    const [removedBot] = room.players.splice(botIdx, 1);
    if (room.teams && removedBot) {
      if (room.teams.team_a && Array.isArray(room.teams.team_a.players)) {
        room.teams.team_a.players = room.teams.team_a.players.filter(sid => sid !== removedBot.sessionId);
      }
      if (room.teams.team_b && Array.isArray(room.teams.team_b.players)) {
        room.teams.team_b.players = room.teams.team_b.players.filter(sid => sid !== removedBot.sessionId);
      }
      if (room.teams.team_c && Array.isArray(room.teams.team_c.players)) {
        room.teams.team_c.players = room.teams.team_c.players.filter(sid => sid !== removedBot.sessionId);
      }
    }
    io.to(normalizedCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId, room));
  });

  // Host verweist einen menschlichen Mitspieler aus dem Warteraum
  socket.on('kickPlayer', ({ roomCode, targetSessionId }) => {
    const normalizedCode = (roomCode || '').trim().toUpperCase();
    const room = rooms[normalizedCode];
    if (!room) return;

    if (room.gameState !== 'lobby') {
      socket.emit('actionError', { message: 'Mitspieler können nur im Warteraum verwiesen werden.' });
      return;
    }

    const hostPlayer = room.players.find(p => p.sessionId === room.hostSessionId);
    if (!hostPlayer || socket.id !== hostPlayer.socketId) {
      socket.emit('actionError', { message: 'Nur der Host kann Mitspieler verwalten!' });
      return;
    }

    if (!targetSessionId) {
      socket.emit('actionError', { message: 'Kein Zielspieler angegeben.' });
      return;
    }

    if (targetSessionId === room.hostSessionId) {
      socket.emit('actionError', { message: 'Der Host kann sich nicht selbst verweisen!' });
      return;
    }

    const targetIdx = room.players.findIndex(p => p.sessionId === targetSessionId);
    if (targetIdx === -1) {
      socket.emit('actionError', { message: 'Spieler nicht im Raum gefunden.' });
      return;
    }

    const [kickedPlayer] = room.players.splice(targetIdx, 1);

    // 2vs2 Allianzen Bereinigung
    if (room.teams && kickedPlayer) {
      if (room.teams.team_a && Array.isArray(room.teams.team_a.players)) {
        room.teams.team_a.players = room.teams.team_a.players.filter(sid => sid !== kickedPlayer.sessionId);
      }
      if (room.teams.team_b && Array.isArray(room.teams.team_b.players)) {
        room.teams.team_b.players = room.teams.team_b.players.filter(sid => sid !== kickedPlayer.sessionId);
      }
      if (room.teams.team_c && Array.isArray(room.teams.team_c.players)) {
        room.teams.team_c.players = room.teams.team_c.players.filter(sid => sid !== kickedPlayer.sessionId);
      }
    }

    if (kickedPlayer.socketId) {
      const targetSocket = io.sockets.sockets.get(kickedPlayer.socketId);
      if (targetSocket) {
        targetSocket.leave(normalizedCode);
      }
      io.to(kickedPlayer.socketId).emit('kickedFromRoom', {
        reason: 'Du wurdest vom Host aus der Kammer verwiesen.'
      });
    }

    io.to(normalizedCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId, room));
  });

  // Host übergibt die Spielleitung an einen anderen menschlichen Mitspieler
  socket.on('transferHost', ({ roomCode, targetSessionId }) => {
    const normalizedCode = (roomCode || '').trim().toUpperCase();
    const room = rooms[normalizedCode];
    if (!room) return;

    if (room.gameState !== 'lobby') {
      socket.emit('actionError', { message: 'Die Host-Rolle kann nur im Warteraum übergeben werden!' });
      return;
    }

    if (!room.hostSessionId && room.players.length > 0) {
      room.hostSessionId = room.players[0].sessionId;
    }

    const hostPlayer = room.players.find(p => p.sessionId === room.hostSessionId);
    if (!hostPlayer || socket.id !== hostPlayer.socketId) {
      socket.emit('actionError', { message: 'Nur der aktuelle Host kann die Spielleitung übergeben!' });
      return;
    }

    if (!targetSessionId) {
      socket.emit('actionError', { message: 'Kein Zielspieler angegeben.' });
      return;
    }

    if (targetSessionId === room.hostSessionId) {
      socket.emit('actionError', { message: 'Du bist bereits der Host der Kammer!' });
      return;
    }

    const targetPlayer = room.players.find(p => p.sessionId === targetSessionId);
    if (!targetPlayer) {
      socket.emit('actionError', { message: 'Ziel-Magier wurde nicht gefunden!' });
      return;
    }

    if (targetPlayer.isBot) {
      socket.emit('actionError', { message: 'Die Host-Rolle kann nicht an eine KI übergeben werden!' });
      return;
    }

    room.hostSessionId = targetPlayer.sessionId;
    broadcastRoomUpdated(room);
    io.to(normalizedCode).emit('hostTransferred', {
      newHostSessionId: targetPlayer.sessionId,
      newHostName: targetPlayer.name
    });
  });

  // Spiel starten (aus der Lobby)
  socket.on('startGame', ({ roomCode }) => {
    const normalizedCode = (roomCode || '').trim().toUpperCase();
    const room = rooms[normalizedCode];
    if (!room || room.gameState !== 'lobby') return;

    if (!room.hostSessionId && room.players.length > 0) {
      room.hostSessionId = room.players[0].sessionId;
    }

    const hostPlayer = room.players.find(p => p.sessionId === room.hostSessionId);
    if (!hostPlayer || socket.id !== hostPlayer.socketId) {
      socket.emit('actionError', { message: 'Nur der Host darf das Spiel starten!' });
      return;
    }

    const connectedCount = room.players.filter(p => p.connected).length;
    if (room.matchFormat === 'team_2v2') {
      const connectedPlayers = room.players.filter(p => p.connected);
      const teamA = connectedPlayers.filter(p => p.team === 'team_a');
      const teamB = connectedPlayers.filter(p => p.team === 'team_b');
      const teamC = connectedPlayers.filter(p => p.team === 'team_c');
      const unassigned = connectedPlayers.filter(p => !p.team || !['team_a', 'team_b', 'team_c'].includes(p.team));

      if (connectedCount === 4) {
        if (unassigned.length > 0 || teamA.length !== 2 || teamB.length !== 2) {
          socket.emit('actionError', { message: 'Für 2vs2 müssen beide Allianzen aus genau 2 Magiern bestehen (keine unentschlossenen Magier)!' });
          return;
        }
        // Sitzordnung alternierend: [A1, B1, A2, B2] -> Partner sitzen sich gegenüber!
        room.players = [teamA[0], teamB[0], teamA[1], teamB[1]];
      } else if (connectedCount === 6) {
        if (unassigned.length > 0 || teamA.length !== 2 || teamB.length !== 2 || teamC.length !== 2) {
          socket.emit('actionError', { message: 'Für 2vs2vs2 müssen alle 3 Allianzen aus genau 2 Magiern bestehen (keine unentschlossenen Magier)!' });
          return;
        }
        // Sitzordnung alternierend: [A1, B1, C1, A2, B2, C2] -> Jeder Partner sitzt sich direkt gegenüber!
        room.players = [teamA[0], teamB[0], teamC[0], teamA[1], teamB[1], teamC[1]];
      } else {
        socket.emit('actionError', { message: 'Allianzen erfordern entweder genau 4 Magier (2vs2) oder genau 6 Magier (2vs2vs2)!' });
        return;
      }
    } else {
      if (connectedCount < 3) {
        socket.emit('actionError', { message: 'Ihr braucht mindestens 3 aktive Spieler zum Starten!' });
        return;
      }
      room.players = room.players.filter(p => p.connected);
    }

    room.round = 1;
    room.dealerIndex = 0;
    room.currentTurnIndex = (room.dealerIndex + 1) % room.players.length;
    room.currentTrick = [];
    room.scoreHistory = [];

    dealRound(room, 1, normalizedCode);

    const maxRounds = getMaxRounds(room.players.length, room.edition || 'classic');
    io.to(normalizedCode).emit('gameStarted', {
      round: room.round,
      maxRounds: maxRounds,
      trumpCard: room.trumpCard,
      gameState: room.gameState,
      matchFormat: room.matchFormat || 'ffa',
      scoringMode: room.scoringMode || 'classic',
      biddingMode: room.biddingMode || 'classic',
      teams: room.teams || null
    });
    io.to(normalizedCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId, room));
    notifyTurn(normalizedCode);
  });

  // Teilt Karten für eine Runde aus und sortiert sie
  function dealRound(room, roundNum, roomCode) {
    const code = roomCode || room.roomCode;
    const deck = shuffle(createDeck(room.edition || 'classic'));
    const maxRounds = getMaxRounds(room.players.length, room.edition || 'classic');

    room.roundPlayedCards = [];
    room.playerVoids = {};

    // 1. Zuerst Handkarten an alle Spieler austeilen
    room.players.forEach(player => {
      player.hand = [];
      player.wonCards = [];
      for (let i = 0; i < roundNum; i++) {
        player.hand.push(deck.pop());
      }
      player.bid = null;
      player.tricksWon = 0;
      player.heldWizardThisRound = player.hand.some(c => c && c.type === 'wizard');
      player.attemptingZeroWizardRound = false;
    });

    // 2. Trumpfkarte aufdecken (falls nicht letzte Runde)
    let trumpCard = null;
    let trumpSuit = 'none';
    let werewolfPlayer = null;
    let takenTrumpCard = null;

    if (roundNum >= maxRounds) {
      trumpCard = null;
      trumpSuit = 'none';
      room.gameState = 'bidding';
      room.trumpChooserSessionId = null;
    } else {
      trumpCard = deck.pop();
      if (!trumpCard) {
        trumpCard = { type: 'jester', value: 0 };
      }

      // Prüfen, ob ein Spieler den Werwolf auf der Hand hält
      werewolfPlayer = room.players.find(p => p.hand && p.hand.some(c => c && c.type === 'werewolf'));

      if (werewolfPlayer) {
        // Werwolf aus Hand entfernen
        const wIdx = werewolfPlayer.hand.findIndex(c => c && c.type === 'werewolf');
        werewolfPlayer.hand.splice(wIdx, 1);

        // Aufgedeckte Trumpfkarte auf die Hand nehmen
        takenTrumpCard = { ...trumpCard };
        werewolfPlayer.hand.push(takenTrumpCard);

        // Werwolf wird zur vorläufigen Trumpfkarte; Werwolf-Spieler wählt die Trumpffarbe!
        trumpCard = { type: 'werewolf_trump_pending', isWerewolf: true, suit: 'none' };
        trumpSuit = 'none';
        room.trumpChooserSessionId = werewolfPlayer.sessionId;
        room.gameState = 'choose_trump';
      } else if (trumpCard.type === 'werewolf') {
        // Werwolf wird vom Deck als Trumpf aufgedeckt -> Geber bestimmt Trumpffarbe
        const dealer = room.players[room.dealerIndex];
        trumpCard = { type: 'werewolf_trump_pending', isWerewolf: true, suit: 'none' };
        trumpSuit = 'none';
        room.trumpChooserSessionId = dealer ? dealer.sessionId : null;
        room.gameState = 'choose_trump';
      } else if (trumpCard.type === 'color') {
        trumpSuit = trumpCard.suit;
        room.gameState = 'bidding';
        room.trumpChooserSessionId = null;
      } else if (['wizard', 'dragon', 'shapeshifter', 'cloud', 'vampire'].includes(trumpCard.type)) {
        const dealer = room.players[room.dealerIndex];
        room.trumpChooserSessionId = dealer ? dealer.sessionId : null;
        room.gameState = 'choose_trump';
      } else {
        // Narr, Fee, Bombe, Hexe, Jongleur als Trumpf -> kein Trumpf
        trumpSuit = 'none';
        room.gameState = 'bidding';
        room.trumpChooserSessionId = null;
      }
    }

    room.trumpCard = trumpCard;
    room.vampireCopiedCard = trumpCard ? { ...trumpCard } : null;
    room.cloudWinnerSessionId = null;
    room.jugglerPassSelections = {};

    room.remainingDeck = deck;
    room.isRound1Blind = (roundNum === 1);

    // Handkarten für alle Spieler final sortieren und Vampire aktualisieren
    room.players.forEach(player => {
      player.hand.forEach(c => {
        if (c && c.type === 'vampire' && room.vampireCopiedCard) {
          c.copiedCard = { ...room.vampireCopiedCard };
        }
      });
      player.hand = sortCards(player.hand, trumpSuit);
      if (room.isRound1Blind) {
        io.to(player.socketId).emit('handDealt', [{ type: 'blind_card', isBlind: true, id: 'blind-1' }]);
      } else {
        io.to(player.socketId).emit('handDealt', player.hand);
      }
    });

    // Falls Werwolf eingetauscht wurde: Event an alle Clients senden
    if (code && werewolfPlayer && takenTrumpCard) {
      io.to(code).emit('werewolfTrumpSwapped', {
        werewolfPlayerName: werewolfPlayer.name,
        werewolfPlayerSessionId: werewolfPlayer.sessionId,
        takenCard: takenTrumpCard,
        newTrumpCard: trumpCard,
        trumpSuit: trumpSuit
      });
    }
  }

  // Nächste Runde einläuten
  function proceedToNextRound(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;

    room.round++;
    const maxRounds = getMaxRounds(room.players.length, room.edition || 'classic');
    if (room.round > maxRounds) return;

    // Geber für die neue Runde weiterrücken
    room.dealerIndex = (room.dealerIndex + 1) % room.players.length;
    room.currentTurnIndex = (room.dealerIndex + 1) % room.players.length;
    room.currentTrick = [];

    dealRound(room, room.round, roomCode);

    io.to(roomCode).emit('gameStarted', {
      round: room.round,
      maxRounds: maxRounds,
      trumpCard: room.trumpCard,
      gameState: room.gameState,
      matchFormat: room.matchFormat || 'ffa',
      scoringMode: room.scoringMode || 'classic',
      biddingMode: room.biddingMode || 'classic',
      teams: room.teams || null
    });
    io.to(roomCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId, room));
    notifyTurn(roomCode);
  }

  // Aktuelle Runde neu austeilen (z.B. nach Ausstieg oder Host-Entscheid)
  function reDealCurrentRound(roomCode, reasonMessage) {
    const room = rooms[roomCode];
    if (!room) return;

    clearRoomTimers(room);
    room.currentTrick = [];
    room.isPaused = false;
    room.pausedReason = null;

    if (room.dealerIndex >= room.players.length) {
      room.dealerIndex = 0;
    }
    room.currentTurnIndex = (room.dealerIndex + 1) % room.players.length;

    dealRound(room, room.round, roomCode);

    const maxRounds = getMaxRounds(room.players.length, room.edition || 'classic');
    io.to(roomCode).emit('roundReDealt', {
      message: reasonMessage,
      round: room.round,
      maxRounds: maxRounds,
      trumpCard: room.trumpCard,
      gameState: room.gameState
    });
    io.to(roomCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId, room));
    notifyTurn(roomCode);
  }

  // Raum komplett in die Lobby zurücksetzen
  function resetRoomToLobby(roomCode, message) {
    const room = rooms[roomCode];
    if (!room) return;

    clearRoomTimers(room);
    room.gameState = 'lobby';
    room.round = 1;
    room.trumpCard = null;
    room.currentTurnIndex = 0;
    room.dealerIndex = 0;
    room.currentTrick = [];
    room.scoreHistory = [];
    room.isPaused = false;
    room.pausedReason = null;
    room.teams = {
      team_a: { name: 'Allianz des Sonnenfeuers', score: 0 },
      team_b: { name: 'Allianz der Mondschatten', score: 0 },
      team_c: { name: 'Allianz des Sternenwinds', score: 0 }
    };

    // Getrennte Spieler bereinigen, damit der Warteraum nur aktive Spieler enthält
    room.players = room.players.filter(p => p.connected);

    // Sicherstellen, dass ein verbleibender Spieler Host ist
    if (!room.players.some(p => p.sessionId === room.hostSessionId) && room.players.length > 0) {
      room.hostSessionId = room.players[0].sessionId;
    }

    room.players.forEach(p => {
      p.team = null;
      p.hand = [];
      p.bid = null;
      p.tricksWon = 0;
      p.totalScore = 0;
    });

    io.to(roomCode).emit('gameResetToLobby', {
      message: message || 'Zurück zur Lobby.',
      roomCode: roomCode,
      players: getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId, room)
    });
  }

  // Host setzt das Spiel nach Spielende zurück
  socket.on('resetGame', ({ roomCode }) => {
    const normalizedCode = (roomCode || '').trim().toUpperCase();
    const room = rooms[normalizedCode];
    if (!room) return;

    const hostPlayer = room.players.find(p => p.sessionId === room.hostSessionId);
    if (!hostPlayer || socket.id !== hostPlayer.socketId) return;

    resetRoomToLobby(normalizedCode, 'Spiel wurde vom Host zurückgesetzt.');
  });

  // Host bricht das pausierte Spiel ab und kehrt in den Warteraum zurück
  socket.on('abortGameToWaitingRoom', ({ roomCode }) => {
    const normalizedCode = (roomCode || '').trim().toUpperCase();
    const room = rooms[normalizedCode];
    if (!room || room.gameState === 'lobby') return;

    const hostPlayer = room.players.find(p => p.sessionId === room.hostSessionId);
    if (!hostPlayer || socket.id !== hostPlayer.socketId) return;

    resetRoomToLobby(normalizedCode, 'Spiel wurde vom Host abgebrochen. Zurück im Warteraum.');
  });

  // Host verteilt Runde neu, wenn ein Spieler getrennt ist
  socket.on('hostReDealRound', ({ roomCode }) => {
    const normalizedCode = (roomCode || '').trim().toUpperCase();
    const room = rooms[normalizedCode];
    if (!room || room.gameState === 'lobby') return;

    const hostPlayer = room.players.find(p => p.sessionId === room.hostSessionId);
    if (!hostPlayer || socket.id !== hostPlayer.socketId) return;

    // Getrennte Spieler entfernen
    room.players = room.players.filter(p => p.connected);

    if (room.players.length >= 3) {
      reDealCurrentRound(normalizedCode, 'Der Host hat die Runde neu ausgeteilt.');
    } else {
      resetRoomToLobby(normalizedCode, 'Zu wenige Spieler verbleibend (mindestens 3 erforderlich). Zurück zur Lobby.');
    }
  });

  // Vereinheitlichte Logik: Trumpffarbe wählen (für Spieler und Bots)
  function handleSelectTrumpSuit(room, chooserSessionId, suit) {
    if (!room || room.gameState !== 'choose_trump' || room.isPaused) return false;
    if (!['red', 'blue', 'green', 'yellow'].includes(suit)) return false;

    const isWerewolf = room.trumpCard && (room.trumpCard.isWerewolf || room.trumpCard.type === 'werewolf_trump_pending' || room.trumpCard.type === 'werewolf');

    if (isWerewolf) {
      room.trumpCard = {
        type: 'werewolf_trump',
        suit: suit,
        chosenSuit: suit,
        name: 'Mondbiest-Trumpf'
      };
      room.trumpSuit = suit;
      room.vampireCopiedCard = { ...room.trumpCard };
    } else {
      room.trumpCard.chosenSuit = suit;
      room.trumpSuit = suit;
      if (room.vampireCopiedCard) {
        room.vampireCopiedCard.chosenSuit = suit;
      }
    }

    // Handkarten aller Spieler mit dem neuen Trumpf nachsortieren
    room.players.forEach(p => {
      p.hand.forEach(c => {
        if (c && c.type === 'vampire' && room.vampireCopiedCard) {
          c.copiedCard = { ...room.vampireCopiedCard };
        }
      });
      p.hand = sortCards(p.hand, suit);
      if (p.socketId) {
        if (room.round === 1) {
          io.to(p.socketId).emit('handDealt', [{ type: 'blind_card', isBlind: true, id: 'blind-1' }]);
        } else {
          io.to(p.socketId).emit('handDealt', p.hand);
        }
      }
    });

    io.to(room.roomCode).emit('trumpSuitChosen', {
      suit,
      trumpCard: room.trumpCard
    });

    room.gameState = 'bidding';
    notifyTurn(room.roomCode);
    return true;
  }

  // Geber bzw. Werwolf-Spieler wählt Trumpffarbe (Socket Handler)
  socket.on('selectTrumpSuit', ({ roomCode, suit }) => {
    const normalizedCode = (roomCode || '').trim().toUpperCase();
    const room = rooms[normalizedCode];
    if (!room || room.gameState !== 'choose_trump' || room.isPaused) return;

    const allowedSessionId = room.trumpChooserSessionId || (room.players[room.dealerIndex] ? room.players[room.dealerIndex].sessionId : null);
    const chooser = room.players.find(p => p.sessionId === allowedSessionId);
    if (!chooser || socket.id !== chooser.socketId) return;

    handleSelectTrumpSuit(room, chooser.sessionId, suit);
  });

  // Vereinheitlichte Logik: Stichvorhersage abgeben (für Spieler und Bots)
  function handlePlayerBid(room, playerSessionId, bid) {
    if (!room || room.gameState !== 'bidding' || room.isPaused) {
      return { success: false, message: 'Nicht in der Bietphase.' };
    }

    const player = room.players.find(p => p.sessionId === playerSessionId);
    if (!player) {
      return { success: false, message: 'Spieler nicht gefunden.' };
    }

    const isSimultaneous = (room.biddingMode === 'simultaneous' || room.biddingMode === 'secret');

    if (!isSimultaneous) {
      const currentPlayer = room.players[room.currentTurnIndex];
      if (!currentPlayer || currentPlayer.sessionId !== playerSessionId) {
        return { success: false, message: 'Du bist nicht am Zug.' };
      }
    } else {
      if (player.bid !== null && player.bid !== undefined) {
        return { success: false, message: 'Du hast deinen Tipp bereits abgegeben.' };
      }
    }

    const parsedBid = parseInt(bid, 10);
    if (isNaN(parsedBid) || parsedBid < 0 || parsedBid > room.round) {
      return { success: false, message: 'Ungültiges Gebot.' };
    }

    // Geber-Regel (Plus/Minus Eins) validieren: gilt nur im klassischen Modus (nicht bei Simultan oder Geheim)
    if (!isSimultaneous) {
      const isLastPlayer = (room.currentTurnIndex === room.dealerIndex);
      if (isLastPlayer) {
        const totalBidsSoFar = room.players.reduce((sum, p) => sum + (p.bid !== null ? p.bid : 0), 0);
        if (isForbiddenBid(parsedBid, room.round, totalBidsSoFar, true)) {
          return { success: false, message: 'Diese Stichansage ist für den Geber nach den Regeln verboten!' };
        }
      }
    }

    player.bid = parsedBid;

    if (player.heldWizardThisRound && parsedBid === 0) {
      player.attemptingZeroWizardRound = true;
    }

    const allBidsPlaced = room.players.every(p => p.bid !== null && p.bid !== undefined);

    if (allBidsPlaced) {
      room.gameState = 'playing_tricks';
      room.currentTurnIndex = (room.dealerIndex + 1) % room.players.length;

      if (room.biddingMode === 'simultaneous') {
        io.to(room.roomCode).emit('simultaneousBidsRevealed', {
          players: getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId, room)
        });
        broadcastRoomUpdated(room);
        io.to(room.roomCode).emit('biddingFinished');
        // Puffer von 1800ms, damit der 3-2-1 Countdown und der 3D-Kartenflip am Client vollständig beendet sind
        setRoomTimeout(room, () => {
          notifyTurn(room.roomCode);
        }, 1800);
      } else if (room.biddingMode === 'secret') {
        // Im Geheim-Modus: KEINE Enthüllung, direkt zu den Stichen übergehen!
        broadcastRoomUpdated(room);
        io.to(room.roomCode).emit('biddingFinished');
        notifyTurn(room.roomCode);
      } else {
        broadcastRoomUpdated(room);
        io.to(room.roomCode).emit('biddingFinished');
        notifyTurn(room.roomCode);
      }
    } else {
      if (!isSimultaneous) {
        room.currentTurnIndex = (room.currentTurnIndex + 1) % room.players.length;
        broadcastRoomUpdated(room);
        notifyTurn(room.roomCode);
      } else {
        broadcastRoomUpdated(room);
      }
    }

    return { success: true };
  }

  // Spieler gibt Stichvorhersage ab (Socket Handler)
  socket.on('submitBid', ({ roomCode, bid }) => {
    const normalizedCode = (roomCode || '').trim().toUpperCase();
    const room = rooms[normalizedCode];
    if (!room || room.gameState !== 'bidding' || room.isPaused) return;

    let bidder;
    if (room.biddingMode === 'simultaneous' || room.biddingMode === 'secret') {
      bidder = room.players.find(p => p.socketId === socket.id);
    } else {
      const currentPlayer = room.players[room.currentTurnIndex];
      if (currentPlayer && currentPlayer.socketId === socket.id) {
        bidder = currentPlayer;
      }
    }
    if (!bidder) return;

    const result = handlePlayerBid(room, bidder.sessionId, bid);
    if (result && !result.success && result.message) {
      socket.emit('actionError', { message: result.message });
    }
  });

  // Spektakel-Tracking für Stiche (Highlight des Spiels)
  function recordTrickHighlight(room, trickResult, winner) {
    if (!room) return;
    if (!room.matchHighlights) room.matchHighlights = [];

    const trickCards = (room.currentTrick || []).map(t => ({
      playerName: t.playerName,
      playerSessionId: t.playerSessionId,
      card: t.card
    }));

    const hasDragon = room.currentTrick.some(t => t.card && (t.card.type === 'dragon' || (t.card.type === 'vampire' && t.card.copiedCard && t.card.copiedCard.type === 'dragon')));
    const hasFairy = room.currentTrick.some(t => t.card && (t.card.type === 'fairy' || t.card.type === 'unicorn'));
    const isBombed = !!trickResult.isBombed;
    const wizardCount = room.currentTrick.filter(t => t.card && (t.card.type === 'wizard' || (t.card.type === 'shapeshifter' && t.card.chosenRole === 'wizard'))).length;

    let spectacleScore = 50 + (room.round * 5);
    let headline = `${winner ? winner.name : 'Die Zitadelle'} – Stich in Runde ${room.round}`;
    let description = 'Ein entscheidender Moment der Partie!';

    if (hasDragon && hasFairy && winner) {
      spectacleScore += 260;
      headline = `${winner.name} – Der Feen-Triumph über den Lindwurm!`;
      description = 'Die scheue Fee bezwingt den mächtigen Lindwurm im Duell!';
    } else if (hasDragon && winner) {
      spectacleScore += 180 + (wizardCount * 30);
      headline = `${winner.name} – Der Lindwurm-Coup in Runde ${room.round}!`;
      description = 'Der Drache fegt über den Tisch und sichert den Triumph!';
    } else if (isBombed) {
      spectacleScore += 190;
      headline = `Magiekollaps in Runde ${room.round}!`;
      description = 'Die Bombe detoniert und neutralisiert alle Karten auf dem Tisch!';
    } else if (wizardCount >= 2 && winner) {
      spectacleScore += 130 + (wizardCount * 25);
      headline = `${winner.name} – Duell der Erzmagier in Runde ${room.round}!`;
      description = `${wizardCount} Zauberer prallten aufeinander – ${winner.name} behielt die Oberhand!`;
    } else if (winner && winner.bid === 0 && room.round >= 2) {
      spectacleScore += 95;
      headline = `${winner.name} – Meisterstück der Prophezeiung!`;
      description = 'Trotz Null-Ansage meisterhaft kalkuliert und den Stich abgetreten!';
    } else if (winner) {
      spectacleScore += 40 + (winner.tricksWon * 10);
      headline = `${winner.name} – Triumphzug in Runde ${room.round}!`;
      description = 'Wichtiger Stich zur Erfüllung der Prophezeiung gesichert!';
    }

    room.matchHighlights.push({
      spectacleScore,
      round: room.round,
      winnerSessionId: winner ? winner.sessionId : null,
      winnerName: winner ? winner.name : 'Die Zitadelle',
      winnerAvatar: winner ? (winner.avatar_id || 'wizard_blue') : 'wizard_blue',
      winnerFrame: winner ? (winner.equipped_avatar_frame || 'none') : 'none',
      winnerTitle: winner ? (winner.title || 'Magier') : 'Magier der Zitadelle',
      headline,
      description,
      trick: trickCards
    });
  }

  // Erzeugt MVP-Kandidaten aus den Match-Statistiken
  function generateMvpCandidates(room) {
    if (!room || !room.players || room.players.length === 0) return [];
    const players = room.players;
    const history = room.scoreHistory || [];

    const statsMap = {};
    players.forEach(p => {
      statsMap[p.sessionId] = {
        player: p,
        bidsMade: 0,
        bidsHit: 0,
        zeroBidsWon: 0,
        totalTricks: 0,
        totalScore: p.totalScore || 0
      };
    });

    history.forEach(h => {
      if (Array.isArray(h.entries)) {
        h.entries.forEach(e => {
          const s = statsMap[e.sessionId];
          if (s && e.bid !== null && e.bid !== undefined) {
            s.bidsMade++;
            if (e.bid === e.tricksWon) {
              s.bidsHit++;
              if (e.bid === 0) s.zeroBidsWon++;
            }
            s.totalTricks += (e.tricksWon || 0);
          }
        });
      }
    });

    const candidates = [];
    const usedSessionIds = new Set();

    // 1. Gesamtsieger
    const sortedByScore = [...players].sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
    if (sortedByScore.length > 0) {
      const p = sortedByScore[0];
      usedSessionIds.add(p.sessionId);
      candidates.push({
        sessionId: p.sessionId,
        name: p.name,
        avatarId: p.avatar_id || 'wizard_blue',
        frame: p.equipped_avatar_frame || 'none',
        title: p.title || 'Magier der Zitadelle',
        badge: '👑 Der Sieger',
        reason: `Erster Platz mit ${p.totalScore || 0} Punkten`,
        votes: 0
      });
    }

    // 2. Höchste Vorhersage-Präzision
    const sortedByAcc = [...players].filter(p => !usedSessionIds.has(p.sessionId)).sort((a, b) => {
      const sA = statsMap[a.sessionId];
      const sB = statsMap[b.sessionId];
      const accA = sA.bidsMade > 0 ? (sA.bidsHit / sA.bidsMade) : 0;
      const accB = sB.bidsMade > 0 ? (sB.bidsHit / sB.bidsMade) : 0;
      return accB - accA;
    });
    if (sortedByAcc.length > 0) {
      const p = sortedByAcc[0];
      const s = statsMap[p.sessionId];
      usedSessionIds.add(p.sessionId);
      const pct = s.bidsMade > 0 ? Math.round((s.bidsHit / s.bidsMade) * 100) : 0;
      candidates.push({
        sessionId: p.sessionId,
        name: p.name,
        avatarId: p.avatar_id || 'wizard_blue',
        frame: p.equipped_avatar_frame || 'none',
        title: p.title || 'Magier der Zitadelle',
        badge: '🎯 Der Allwissende',
        reason: `${s.bidsHit} von ${s.bidsMade} Prophezeiungen erfüllt (${pct}%)`,
        votes: 0
      });
    }

    // 3. Meiste Stiche
    const sortedByTricks = [...players].filter(p => !usedSessionIds.has(p.sessionId)).sort((a, b) => {
      return (statsMap[b.sessionId]?.totalTricks || 0) - (statsMap[a.sessionId]?.totalTricks || 0);
    });
    if (sortedByTricks.length > 0) {
      const p = sortedByTricks[0];
      const s = statsMap[p.sessionId];
      usedSessionIds.add(p.sessionId);
      candidates.push({
        sessionId: p.sessionId,
        name: p.name,
        avatarId: p.avatar_id || 'wizard_blue',
        frame: p.equipped_avatar_frame || 'none',
        title: p.title || 'Magier der Zitadelle',
        badge: '⚡ Der Stichmeister',
        reason: `${s.totalTricks} Stiche in der Partie erobert`,
        votes: 0
      });
    }

    // 4. Null-Hunter oder nächstbester
    const remaining = [...players].filter(p => !usedSessionIds.has(p.sessionId)).sort((a, b) => {
      return (statsMap[b.sessionId]?.zeroBidsWon || 0) - (statsMap[a.sessionId]?.zeroBidsWon || 0);
    });
    if (remaining.length > 0 && candidates.length < 4) {
      const p = remaining[0];
      const s = statsMap[p.sessionId];
      usedSessionIds.add(p.sessionId);
      candidates.push({
        sessionId: p.sessionId,
        name: p.name,
        avatarId: p.avatar_id || 'wizard_blue',
        frame: p.equipped_avatar_frame || 'none',
        title: p.title || 'Magier der Zitadelle',
        badge: s.zeroBidsWon > 0 ? '🛡️ Der Unangreifbare' : '🔮 Meister des Schicksals',
        reason: s.zeroBidsWon > 0 ? `${s.zeroBidsWon} Null-Runden bravourös gemeistert` : 'Hervorragende taktische Züge!',
        votes: 0
      });
    }

    return candidates;
  }

  // Schließt die MVP-Abstimmung ab und kürt den Sieger
  async function finalizeMvpVoting(roomCode) {
    const room = rooms[roomCode];
    if (!room || !room.mvpState || !room.mvpState.votingActive) return;
    room.mvpState.votingActive = false;

    const counts = room.mvpState.voteCounts || {};
    const { winnerSessionId, maxVotes } = resolveMvpVotingWinner(room.mvpState.candidates || [], counts);

    const winner = room.players.find(p => p.sessionId === winnerSessionId);
    const candInfo = (room.mvpState.candidates || []).find(c => c.sessionId === winnerSessionId);

    const bonusXP = 50;
    if (winner && winner.userId && dbModule) {
      try {
        if (typeof dbModule.awardBonusXP === 'function') {
          await dbModule.awardBonusXP(winner.userId, bonusXP);
        }
        if (typeof dbModule.awardCosmetic === 'function') {
          await dbModule.awardCosmetic(winner.userId, 'title', 'MVP der Zitadelle');
          await dbModule.awardCosmetic(winner.userId, 'avatar_frame', 'mvp_glow');
        } else if (dbModule.db && dbModule.db.prepare) {
          try {
            dbModule.db.prepare('INSERT OR IGNORE INTO user_inventory (user_id, item_type, item_id) VALUES (?, ?, ?)').run(winner.userId, 'title', 'MVP der Zitadelle');
            dbModule.db.prepare('INSERT OR IGNORE INTO user_inventory (user_id, item_type, item_id) VALUES (?, ?, ?)').run(winner.userId, 'avatar_frame', 'mvp_glow');
          } catch (e) {}
        }
      } catch (e) {
        console.error('Fehler bei MVP-Bonus Vergabe:', e);
      }
    }

    io.to(roomCode).emit('mvp:results', {
      winnerSessionId,
      winnerName: winner ? winner.name : (candInfo ? candInfo.name : 'Zitadellen-Magier'),
      winnerAvatar: winner ? (winner.avatar_id || 'wizard_blue') : 'wizard_blue',
      winnerFrame: winner ? (winner.equipped_avatar_frame || 'none') : 'none',
      votes: Math.max(0, maxVotes),
      badge: candInfo ? candInfo.badge : '🌟 MVP der Zitadelle',
      reason: candInfo ? candInfo.reason : 'Herausragende Leistung in dieser Partie!',
      bonusXP
    });
  }

  // Beendet die Rundenwertung und berechnet Punkte
  async function finishRoundScoring(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;

    room.gameState = 'round_over';
    io.to(roomCode).emit('trickUpdated', room.currentTrick);

    if (!room.scoreHistory) room.scoreHistory = [];

    if (!room.teams) {
      room.teams = {
        team_a: { name: 'Allianz des Sonnenfeuers', score: 0 },
        team_b: { name: 'Allianz der Mondschatten', score: 0 },
        team_c: { name: 'Allianz des Sternenwinds', score: 0 }
      };
    }

    let teamScores = null;
    let roundEntries = [];

    if (room.matchFormat === 'team_2v2') {
      const activeTeamKeys = ['team_a', 'team_b'];
      if (room.players.some(p => p.team === 'team_c')) {
        activeTeamKeys.push('team_c');
      }

      teamScores = {};
      const teamRoundPointsMap = {};
      const defaultNames = {
        team_a: 'Allianz des Sonnenfeuers',
        team_b: 'Allianz der Mondschatten',
        team_c: 'Allianz des Sternenwinds'
      };

      activeTeamKeys.forEach(tKey => {
        const teamPlayers = room.players.filter(p => p.team === tKey);
        const teamBid = teamPlayers.reduce((sum, p) => sum + (p.bid !== null ? p.bid : 0), 0);
        const teamTricks = teamPlayers.reduce((sum, p) => sum + (p.tricksWon || 0), 0);
        const teamPoints = calculateTeamPoints(teamBid, teamTricks, room.round, room.scoringMode || "classic");

        if (!room.teams[tKey]) {
          room.teams[tKey] = { name: defaultNames[tKey] || tKey, score: 0 };
        }

        room.teams[tKey].score = (room.teams[tKey].score || 0) + teamPoints;
        teamRoundPointsMap[tKey] = teamPoints;

        teamScores[tKey] = {
          name: room.teams[tKey].name,
          bid: teamBid,
          tricksWon: teamTricks,
          roundPoints: teamPoints,
          totalScore: room.teams[tKey].score
        };
      });

      roundEntries = room.players.map(p => {
        const teamPoints = teamRoundPointsMap[p.team] || 0;
        const teamTotal = room.teams[p.team] ? room.teams[p.team].score : 0;
        p.totalScore = teamTotal;
        p.wonCards = [];
        return {
          sessionId: p.sessionId,
          name: p.name,
          team: p.team,
          bid: p.bid,
          tricksWon: p.tricksWon,
          roundPoints: teamPoints,
          totalScore: teamTotal
        };
      });
    } else {
      roundEntries = room.players.map(p => {
        const roundPoints = calculatePoints(
          p.bid !== null ? p.bid : 0,
          p.tricksWon,
          room.round,
          room.scoringMode || "classic"
        );
        p.totalScore += roundPoints;
        p.wonCards = [];
        return {
          sessionId: p.sessionId,
          name: p.name,
          team: p.team || null,
          bid: p.bid,
          tricksWon: p.tricksWon,
          roundPoints: roundPoints,
          totalScore: p.totalScore
        };
      });
    }

    room.scoreHistory.push({
      round: room.round,
      entries: roundEntries,
      teamScores: teamScores
    });

    const maxRounds = getMaxRounds(room.players.length, room.edition || 'classic');
    const isGameOver = room.round >= maxRounds;

    // Runden-Statistiken für angemeldete Spieler erfassen
    for (const p of room.players) {
      if (p.userId) {
        await dbModule.recordRoundBid(p.userId, p.bid !== null ? p.bid : 0, p.tricksWon);
      }
      if (p.attemptingZeroWizardRound && p.tricksWon === 0) {
        p.completedZeroWizardRound = true;
      }
    }

    const rankedResults = {};

    if (isGameOver) {
      // Rangfolge berechnen und Alltime Win/Loss verbuchen
      const sortedByScore = [...room.players].sort((a, b) => b.totalScore - a.totalScore);
      const totalPlayers = room.players.length;

      for (let index = 0; index < sortedByScore.length; index++) {
        const p = sortedByScore[index];
        let rank = index + 1;
        if (index > 0 && p.totalScore === sortedByScore[index - 1].totalScore) {
          rank = sortedByScore[index - 1].calculatedRank || rank;
        }
        p.calculatedRank = rank;

        if (p.userId) {
          await dbModule.recordGameFinished(p.userId, {
            rank: rank,
            totalPlayers: totalPlayers,
            points: p.totalScore,
            hadZeroWizardTrickWin: !!(rank === 1 && p.completedZeroWizardRound)
          });

          // Overwatch-Style Match-XP & Progression
          let totalBidsHit = 0;
          let totalBidsMade = 0;
          if (room.scoreHistory) {
            room.scoreHistory.forEach(h => {
              const entry = h.entries ? h.entries.find(e => e.sessionId === p.sessionId) : null;
              if (entry && entry.bid !== null && entry.bid !== undefined) {
                totalBidsMade++;
                if (entry.bid === entry.tricksWon) totalBidsHit++;
              }
            });
          }

          if (dbModule && typeof dbModule.applyMatchProgression === 'function') {
            try {
              const progRes = await dbModule.applyMatchProgression(p.userId, {
                rank: rank,
                isWinner: (rank === 1),
                bidsHit: totalBidsHit,
                roundsPlayed: maxRounds,
                isRanked: !!room.isRanked
              });
              if (progRes && p.socketId) {
                io.to(p.socketId).emit('progression:matchSummary', {
                  ...progRes,
                  sessionId: p.sessionId,
                  playerName: p.name
                });
              }
            } catch (err) {
              console.error('Fehler bei applyMatchProgression:', err);
            }
          }

          if (room.isRanked) {

            const res = await dbModule.recordRankedGameFinished(p.userId, {
              rank: rank,
              totalPlayers: totalPlayers,
              points: p.totalScore,
              bidsMade: totalBidsMade,
              bidsHit: totalBidsHit
            });

            if (res) {
              p.skillRating = res.newSR;
              p.rank = res.newRank;
              rankedResults[p.sessionId] = {
                ...res,
                sessionId: p.sessionId,
                playerName: p.name,
                userId: p.userId
              };
            }
          }
        }
      }
    }

    let bestHighlight = null;
    let mvpCandidates = [];
    if (isGameOver) {
      if (room.matchHighlights && room.matchHighlights.length > 0) {
        bestHighlight = room.matchHighlights.reduce((best, cur) => cur.spectacleScore > best.spectacleScore ? cur : best, room.matchHighlights[0]);
      }
      mvpCandidates = generateMvpCandidates(room);
      room.mvpState = {
        candidates: mvpCandidates,
        votes: {},
        voteCounts: {},
        votingActive: true
      };
      mvpCandidates.forEach(c => { room.mvpState.voteCounts[c.sessionId] = 0; });

      setRoomTimeout(room, () => {
        io.to(roomCode).emit('mvp:startVoting', {
          candidates: mvpCandidates,
          durationMs: 15000
        });

        // Bots stimmen zeitversetzt ab
        room.players.forEach(p => {
          if (p.isBot && p.connected !== false) {
            setTimeout(() => {
              if (room.mvpState && room.mvpState.votingActive && mvpCandidates.length > 0) {
                const targetCand = mvpCandidates[Math.floor(Math.random() * mvpCandidates.length)];
                if (targetCand) {
                  room.mvpState.votes[p.sessionId] = targetCand.sessionId;
                  room.mvpState.voteCounts[targetCand.sessionId] = (room.mvpState.voteCounts[targetCand.sessionId] || 0) + 1;
                  io.to(roomCode).emit('mvp:updateVotes', { voteCounts: room.mvpState.voteCounts });
                }
              }
            }, 2500 + Math.random() * 2000);
          }
        });

        room.mvpState.timer = setRoomTimeout(room, () => {
          finalizeMvpVoting(roomCode);
        }, 15000);
      }, bestHighlight ? 6000 : 1500);
    }

    const rankedResultsList = Object.values(rankedResults);

    io.to(roomCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId, room));
    io.to(roomCode).emit('roundFinished', {
      isGameOver,
      scoreHistory: room.scoreHistory,
      round: room.round,
      matchFormat: room.matchFormat || 'ffa',
      scoringMode: room.scoringMode || 'classic',
      biddingMode: room.biddingMode || 'classic',
      teams: room.teams || null,
      teamScores: teamScores,
      isRanked: !!room.isRanked,
      rankedResults: isGameOver ? rankedResultsList : null,
      rankedResultsMap: isGameOver ? rankedResults : null,
      highlight: isGameOver ? bestHighlight : null,
      mvpCandidates: isGameOver ? mvpCandidates : null
    });
    if (isGameOver && bestHighlight) {
      io.to(roomCode).emit('highlight:replay', bestHighlight);
    }
    if (isGameOver && room.isRanked && rankedResultsList.length > 0) {
      io.to(roomCode).emit('rankedResults', rankedResultsList);
    }
    io.to(roomCode).emit('turnChanged', { activePlayerSessionId: null, gameState: 'round_over' });

    if (!isGameOver) {
      setRoomTimeout(room, () => {
        proceedToNextRound(roomCode);
      }, 2000);
    }
  }

  // Vereinheitlichte Logik: Karte ausspielen (für Spieler und Bots)
  function handlePlayerPlayCard(room, playerSessionId, cardIndex, chosenRole, chosenSuit, witchSwap) {
    if (!room || room.gameState !== 'playing_tricks' || room.isPaused) {
      return { success: false, message: 'Nicht am Zug oder Spiel pausiert.' };
    }

    const currentPlayer = room.players[room.currentTurnIndex];
    if (!currentPlayer || currentPlayer.sessionId !== playerSessionId) {
      return { success: false, message: 'Du bist nicht an der Reihe!' };
    }

    const cardToPlay = currentPlayer.hand[cardIndex];
    if (!cardToPlay) {
      return { success: false, message: 'Karte nicht gefunden.' };
    }

    // Defaults für Runde 1 (wo Spieler blind legt):
    if (room.round === 1) {
      if (cardToPlay.type === 'shapeshifter' && !cardToPlay.chosenRole) {
        cardToPlay.chosenRole = 'wizard';
      }
      if (cardToPlay.type === 'cloud' && !cardToPlay.chosenSuit) {
        cardToPlay.chosenSuit = (room.trumpSuit && room.trumpSuit !== 'none') ? room.trumpSuit : 'red';
      }
      if (cardToPlay.type === 'juggler' && !cardToPlay.chosenSuit) {
        cardToPlay.chosenSuit = (room.trumpSuit && room.trumpSuit !== 'none') ? room.trumpSuit : 'red';
      }
    }

    // Gestaltenwandler: Rolle setzen
    if (cardToPlay.type === 'shapeshifter') {
      cardToPlay.chosenRole = (chosenRole === 'jester') ? 'jester' : 'wizard';
    }

    // Wolke: Farbe setzen
    if (cardToPlay.type === 'cloud') {
      cardToPlay.chosenSuit = ['red', 'blue', 'green', 'yellow'].includes(chosenSuit) ? chosenSuit : 'red';
    }

    // Jongleur: Farbe setzen
    if (cardToPlay.type === 'juggler') {
      cardToPlay.chosenSuit = ['red', 'blue', 'green', 'yellow'].includes(chosenSuit) ? chosenSuit : 'red';
    }

    // Vampir: Falls Trumpf ein Werwolf ist -> sofort neue Trumpfkarte aufdecken!
    if (cardToPlay.type === 'vampire') {
      const isWerewolfTrump = room.trumpCard && (
        room.trumpCard.type === 'werewolf_trump' ||
        room.trumpCard.type === 'werewolf_trump_pending' ||
        room.trumpCard.type === 'werewolf' ||
        room.trumpCard.isWerewolf
      );

      if (isWerewolfTrump) {
        let newTrump = (room.remainingDeck && room.remainingDeck.length > 0)
          ? room.remainingDeck.pop()
          : { type: 'jester', value: 0 };

        if (newTrump.type === 'color') {
          room.trumpSuit = newTrump.suit;
        } else if (['wizard', 'dragon', 'shapeshifter', 'cloud', 'vampire'].includes(newTrump.type)) {
          if (!newTrump.chosenSuit) newTrump.chosenSuit = room.trumpSuit || 'red';
          room.trumpSuit = newTrump.chosenSuit;
        } else {
          room.trumpSuit = 'none';
        }

        room.trumpCard = newTrump;
        room.vampireCopiedCard = { ...newTrump };
        cardToPlay.copiedCard = { ...newTrump };

        // Handkarten aller Spieler mit neuem Trumpf sortieren
        room.players.forEach(p => {
          p.hand.forEach(c => {
            if (c && c.type === 'vampire') {
              c.copiedCard = { ...newTrump };
            }
          });
          p.hand = sortCards(p.hand, room.trumpSuit);
          if (p.socketId) {
            if (room.round === 1) {
              io.to(p.socketId).emit('handDealt', [{ type: 'blind_card', isBlind: true, id: 'blind-1' }]);
            } else {
              io.to(p.socketId).emit('handDealt', p.hand);
            }
          }
        });

        io.to(room.roomCode).emit('vampireRevealedNewTrump', {
          vampirePlayerName: currentPlayer.name,
          vampirePlayerSessionId: currentPlayer.sessionId,
          newTrumpCard: newTrump,
          trumpSuit: room.trumpSuit
        });
      } else if (room.vampireCopiedCard) {
        cardToPlay.copiedCard = { ...room.vampireCopiedCard };
      }
    }

    if (!isValidMove(cardToPlay, currentPlayer.hand, room.currentTrick)) {
      return { success: false, message: 'Du musst die angespielte Farbe bedienen!', errorType: 'invalidMove' };
    }

    const playedCard = currentPlayer.hand.splice(cardIndex, 1)[0];
    if (currentPlayer.userId && playedCard) {
      dbModule.recordSpecialCard(currentPlayer.userId, playedCard.type);
    }

    // Handkarten erst NACH dem Entfernen der gespielten Karte sortieren!
    let currentTrumpSuit = 'none';
    if (room.trumpCard) {
      currentTrumpSuit = room.trumpCard.chosenSuit || (room.trumpCard.type === 'color' ? room.trumpCard.suit : 'none');
    }
    currentPlayer.hand = sortCards(currentPlayer.hand, currentTrumpSuit);

    // Card- & Void-Tracking für Bots
    if (!room.roundPlayedCards) room.roundPlayedCards = [];
    room.roundPlayedCards.push(playedCard);

    if (!room.playerVoids) room.playerVoids = {};
    if (!room.playerVoids[currentPlayer.sessionId]) room.playerVoids[currentPlayer.sessionId] = {};

    let leadSuit = 'none';
    for (let i = 0; i < room.currentTrick.length; i++) {
      const tc = getEffectiveCard(room.currentTrick[i].card);
      if (['wizard', 'dragon', 'unicorn', 'bomb'].includes(tc.type)) break;
      if (tc.type === 'color') {
        leadSuit = tc.suit;
        break;
      }
    }
    if (leadSuit !== 'none') {
      const effPlayed = getEffectiveCard(playedCard);
      if (effPlayed.type === 'color' && effPlayed.suit !== leadSuit) {
        room.playerVoids[currentPlayer.sessionId][leadSuit] = true;
      }
    }

    room.currentTrick.push({
      playerName: currentPlayer.name,
      playerSessionId: currentPlayer.sessionId,
      card: playedCard
    });

    if (currentPlayer.socketId) {
      if (room.round === 1) {
        io.to(currentPlayer.socketId).emit('handDealt', []);
      } else {
        io.to(currentPlayer.socketId).emit('handDealt', currentPlayer.hand);
      }
    }
    io.to(room.roomCode).emit('trickUpdated', room.currentTrick);
    io.to(room.roomCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId, room));

    room.currentTurnIndex = (room.currentTurnIndex + 1) % room.players.length;

    // Wenn alle Spieler eine Karte gelegt haben -> Stich auswerten
    if (room.currentTrick.length === room.players.length) {
      evaluateCompletedTrick(room);
    } else {
      notifyTurn(room.roomCode);
    }

    return { success: true };
  }

  // Wertet einen vollständigen Stich aus (inkl. Sonderkarten-Pipeline & Bots)
  function evaluateCompletedTrick(room) {
    room.gameState = 'evaluating_trick';

    const trickResult = evaluateTrickDetails(
      room.currentTrick.map(t => ({ playerId: t.playerSessionId, card: t.card })),
      room.trumpCard
    );

    const isBombed = trickResult.isBombed;
    const winnerSessionId = trickResult.winnerPlayerId;
    const nextLeadSessionId = trickResult.nextLeadPlayerId;

    const winner = winnerSessionId ? room.players.find(p => p.sessionId === winnerSessionId) : null;
    const nextLeadPlayer = nextLeadSessionId ? room.players.find(p => p.sessionId === nextLeadSessionId) : null;

    if (winner) {
      winner.tricksWon += 1;
      io.to(room.roomCode).emit('trickWinner', {
        winnerName: winner.name,
        winnerSessionId: winner.sessionId,
        isBombed: false,
        isUnicornVoided: false,
        isUnicornActive: !!trickResult.isUnicornActive
      });
      io.to(room.roomCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId, room));
    } else if (isBombed) {
      io.to(room.roomCode).emit('trickWinner', {
        winnerName: null,
        winnerSessionId: null,
        isBombed: true,
        isUnicornVoided: false,
        nextLeadName: nextLeadPlayer ? nextLeadPlayer.name : null,
        nextLeadSessionId: nextLeadSessionId
      });
    } else if (trickResult.isUnicornVoided) {
      io.to(room.roomCode).emit('trickWinner', {
        winnerName: null,
        winnerSessionId: null,
        isBombed: false,
        isUnicornVoided: true,
        nextLeadName: nextLeadPlayer ? nextLeadPlayer.name : null,
        nextLeadSessionId: nextLeadSessionId
      });
    }

    recordTrickHighlight(room, trickResult, winner);

    // Alle Spezial-Fähigkeiten (Jongleur, Hexe, Wolke) bleiben aktiv (auch bei Bombe oder Einhorn!)
    const hadJuggler = room.currentTrick.some(t => t.card && (t.card.type === 'juggler' || (t.card.type === 'vampire' && t.card.copiedCard && t.card.copiedCard.type === 'juggler')));
    const hadCloud = room.currentTrick.some(t => t.card && (t.card.type === 'cloud' || (t.card.type === 'vampire' && t.card.copiedCard && t.card.copiedCard.type === 'cloud')));
    const hadWitch = room.currentTrick.some(t => t.card && t.card.type === 'witch');

    setRoomTimeout(room, () => {
      // Pipeline: Wolke -> Hexe -> Jongleur -> Stich aufräumen & weiter
      function stepCloud(next) {
        // Bei Bombe wird der Stich zerstört und die Wolke vollständig negiert
        if (!hadCloud || trickResult.isBombed) return next();
        const targetSessionId = trickResult.winnerPlayerId || trickResult.nextLeadPlayerId;
        const cloudWinner = room.players.find(p => p.sessionId === targetSessionId);
        if (!cloudWinner || !cloudWinner.connected) return next();

        if (cloudWinner.isBot) {
          const delta = chooseBotCloudAdjustment(cloudWinner, cloudWinner.bid !== null ? cloudWinner.bid : 0, cloudWinner.tricksWon, cloudWinner.hand);
          const oldBid = cloudWinner.bid !== null ? cloudWinner.bid : 0;
          const newBid = Math.max(0, oldBid + delta);
          cloudWinner.bid = newBid;

          io.to(room.roomCode).emit('cloudBidAdjusted', {
            playerName: cloudWinner.name,
            oldBid: oldBid,
            newBid: newBid
          });
          io.to(room.roomCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId, room));

          setRoomTimeout(room, () => next(), 800);
          return;
        }

        room.gameState = 'cloud_adjust_bid';
        room.cloudPlayerSessionId = cloudWinner.sessionId;
        room.cloudNextCallback = next;

        io.to(room.roomCode).emit('cloudBidAdjustmentPending', {
          playerName: cloudWinner.name,
          playerSessionId: cloudWinner.sessionId
        });

        if (cloudWinner.socketId) {
          io.to(cloudWinner.socketId).emit('cloudBidAdjustmentPrompt', {
            currentBid: cloudWinner.bid !== null ? cloudWinner.bid : 0
          });
        }

        io.to(room.roomCode).emit('turnChanged', {
          activePlayerSessionId: cloudWinner.sessionId,
          gameState: 'cloud_adjust_bid'
        });
      }

      function stepWitch(next) {
        if (!hadWitch) return next();
        const witchEntry = room.currentTrick.find(t => t.card && t.card.type === 'witch');
        const witchPlayer = witchEntry ? room.players.find(p => p.sessionId === witchEntry.playerSessionId) : null;

        const swappableTrickCards = room.currentTrick.some(t => t.card && t.card.type !== 'witch');
        const canSwap = witchPlayer && witchPlayer.connected && witchPlayer.hand && witchPlayer.hand.length > 0 && swappableTrickCards;

        if (!canSwap) return next();

        if (witchPlayer.isBot) {
          const swapDecision = chooseBotWitchSwap(witchPlayer, room.currentTrick, witchPlayer.hand);
          if (swapDecision && swapDecision.handIndex !== null && swapDecision.trickIndex !== null && witchPlayer.hand[swapDecision.handIndex] && room.currentTrick[swapDecision.trickIndex]) {
            const handCard = witchPlayer.hand[swapDecision.handIndex];
            const trickEntry = room.currentTrick[swapDecision.trickIndex];
            const trickCard = trickEntry.card;

            witchPlayer.hand.splice(swapDecision.handIndex, 1, trickCard);
            trickEntry.card = handCard;
            witchPlayer.hand = sortCards(witchPlayer.hand, room.trumpSuit);

            io.to(room.roomCode).emit('witchSwapShowcase', {
              witchPlayerName: witchPlayer.name,
              takenCard: trickCard,
              givenCard: handCard
            });
            io.to(room.roomCode).emit('trickUpdated', room.currentTrick);
          }
          setRoomTimeout(room, () => next(), 1000);
          return;
        }

        room.gameState = 'witch_swap';
        room.witchPlayerSessionId = witchPlayer.sessionId;
        room.witchNextCallback = next;

        io.to(room.roomCode).emit('witchSwapPending', {
          playerName: witchPlayer.name,
          playerSessionId: witchPlayer.sessionId
        });

        if (witchPlayer.socketId) {
          io.to(witchPlayer.socketId).emit('witchSwapPrompt', {
            trickCards: room.currentTrick,
            handCards: witchPlayer.hand
          });
        }

        io.to(room.roomCode).emit('turnChanged', {
          activePlayerSessionId: witchPlayer.sessionId,
          gameState: 'witch_swap'
        });
      }

      function stepJuggler(next) {
        const anyPlayerHasCards = room.players.some(p => p.hand && p.hand.length > 0);
        if (!hadJuggler || !anyPlayerHasCards) return next();

        room.gameState = 'juggler_passing';
        room.jugglerPassSelections = {};
        room.jugglerNextLeadSessionId = nextLeadSessionId;
        room.jugglerNextCallback = next;

        io.to(room.roomCode).emit('trickUpdated', []);

        // Bots wählen eine Handkarte zum Weitergeben
        room.players.forEach(p => {
          if (p.isBot && p.hand && p.hand.length > 0) {
            room.jugglerPassSelections[p.sessionId] = chooseBotJugglerPass(p, p.hand);
          }
        });

        const activePlayers = room.players.filter(p => p.connected && p.hand && p.hand.length > 0);
        const allSelected = activePlayers.every(p => room.jugglerPassSelections[p.sessionId] !== undefined);

        if (allSelected) {
          setRoomTimeout(room, () => executeJugglerPassing(room.roomCode), 600);
          return;
        }

        room.players.forEach(p => {
          if (!p.isBot && p.connected && p.hand && p.hand.length > 0 && p.socketId) {
            io.to(p.socketId).emit('jugglerPassPrompt', {
              message: 'Der Jongleur fordert seinen Tribut! Wähle 1 Handkarte zum verdeckten Weitergeben.',
              hand: p.hand
            });
          }
        });
        io.to(room.roomCode).emit('turnChanged', { activePlayerSessionId: null, gameState: 'juggler_passing' });
      }

      function stepFinish() {
        if (winner) {
          if (!winner.wonCards) winner.wonCards = [];
          winner.wonCards.push(...room.currentTrick.map(t => t.card));
        }
        room.currentTrick = [];

        const anyPlayerHasCards = room.players.some(p => p.hand && p.hand.length > 0);
        if (!anyPlayerHasCards) {
          finishRoundScoring(room.roomCode);
        } else {
          room.gameState = 'playing_tricks';
          const nextIndex = room.players.findIndex(p => p.sessionId === nextLeadSessionId);
          room.currentTurnIndex = nextIndex !== -1 ? nextIndex : 0;
          io.to(room.roomCode).emit('trickUpdated', room.currentTrick);
          notifyTurn(room.roomCode);
        }
      }

      // Starte Pipeline: Wolke -> Hexe -> Jongleur -> Finish
      stepCloud(() => {
        stepWitch(() => {
          stepJuggler(() => {
            stepFinish();
          });
        });
      });
    }, 1200);

    io.to(room.roomCode).emit('turnChanged', { activePlayerSessionId: null, gameState: 'evaluating_trick' });
  }

  // Spieler spielt eine Karte aus (Socket Handler)
  socket.on('playCard', ({ roomCode, cardIndex, chosenRole, chosenSuit, witchSwap }) => {
    const normalizedCode = (roomCode || '').trim().toUpperCase();
    const room = rooms[normalizedCode];
    if (!room || room.gameState !== 'playing_tricks' || room.isPaused) return;

    const currentPlayer = room.players[room.currentTurnIndex];
    if (!currentPlayer || socket.id !== currentPlayer.socketId) return;

    const result = handlePlayerPlayCard(room, currentPlayer.sessionId, cardIndex, chosenRole, chosenSuit, witchSwap);
    if (result && !result.success && result.message) {
      socket.emit(result.errorType || 'actionError', { message: result.message });
    }
  });

  // MVP Abstimmung: Spieler gibt seine Stimme ab
  socket.on('mvp:vote', ({ roomCode, candidateSessionId }) => {
    const normalizedCode = (roomCode || '').trim().toUpperCase();
    const room = rooms[normalizedCode];
    if (!room || !room.mvpState || !room.mvpState.votingActive) return;

    const voter = room.players.find(p => p.socketId === socket.id);
    if (!voter) return;

    const prevVote = room.mvpState.votes[voter.sessionId];
    if (prevVote === candidateSessionId) return;

    if (prevVote) {
      room.mvpState.voteCounts[prevVote] = Math.max(0, (room.mvpState.voteCounts[prevVote] || 1) - 1);
    }
    room.mvpState.votes[voter.sessionId] = candidateSessionId;
    room.mvpState.voteCounts[candidateSessionId] = (room.mvpState.voteCounts[candidateSessionId] || 0) + 1;

    io.to(normalizedCode).emit('mvp:updateVotes', {
      voteCounts: room.mvpState.voteCounts
    });

    const humanPlayers = room.players.filter(p => p.connected && !p.isBot);
    const totalVotes = Object.keys(room.mvpState.votes).filter(sId => {
      const pl = room.players.find(p => p.sessionId === sId);
      return pl && !pl.isBot;
    }).length;

    if (totalVotes >= humanPlayers.length && humanPlayers.length > 0) {
      if (room.mvpState.timer) clearTimeout(room.mvpState.timer);
      finalizeMvpVoting(normalizedCode);
    }
  });

  // Spieler wählt verdeckt eine Handkarte zum Weitergeben an den linken Nachbarn (Jongleur)
  socket.on('submitJugglerPassCard', ({ roomCode, cardIndex }) => {
    const normalizedCode = (roomCode || '').trim().toUpperCase();
    const room = rooms[normalizedCode];
    if (!room || room.gameState !== 'juggler_passing' || room.isPaused) return;

    const player = room.players.find(p => p.socketId === socket.id);
    if (!player || !player.hand || player.hand.length === 0) return;

    const cIdx = parseInt(cardIndex, 10);
    if (isNaN(cIdx) || cIdx < 0 || cIdx >= player.hand.length) return;

    room.jugglerPassSelections[player.sessionId] = cIdx;
    socket.emit('jugglerCardConfirmed', { cardIndex: cIdx });

    const activePlayers = room.players.filter(p => p.connected && p.hand && p.hand.length > 0);
    io.to(normalizedCode).emit('jugglerPassProgress', {
      selectedCount: Object.keys(room.jugglerPassSelections).length,
      totalCount: activePlayers.length
    });

    const allSelected = activePlayers.every(p => room.jugglerPassSelections[p.sessionId] !== undefined);

    if (allSelected) {
      executeJugglerPassing(normalizedCode);
    }
  });

  function executeJugglerPassing(roomCode) {
    const room = rooms[roomCode];
    if (!room || room.gameState !== 'juggler_passing') return;

    // Für jeden Spieler die gewählte Handkarte entnehmen
    const passedCards = [];
    room.players.forEach(p => {
      const selIdx = (room.jugglerPassSelections[p.sessionId] !== undefined)
        ? room.jugglerPassSelections[p.sessionId]
        : 0;
      const passedCard = p.hand.splice(selIdx, 1)[0] || p.hand.pop();
      passedCards.push({ fromPlayer: p, card: passedCard });
    });

    let trumpSuit = 'none';
    if (room.trumpCard) {
      trumpSuit = room.trumpCard.chosenSuit || (room.trumpCard.type === 'color' ? room.trumpCard.suit : 'none');
    }

    // Im Uhrzeigersinn an den linken Nachbarn übergeben (p[i] gibt an p[(i+1)%N])
    const N = room.players.length;
    for (let i = 0; i < N; i++) {
      const receiver = room.players[(i + 1) % N];
      const passedItem = passedCards[i];
      receiver.hand.push(passedItem.card);
      receiver.hand = sortCards(receiver.hand, trumpSuit);

      // Private Zustellung nur an den jeweiligen Empfänger (Niemand sonst sieht die Karte!)
      io.to(receiver.socketId).emit('handDealt', receiver.hand);
      io.to(receiver.socketId).emit('jugglerCardReceived', {
        card: passedItem.card,
        fromPlayerName: passedItem.fromPlayer.name
      });
    }

    // Öffentliche Meldung an den Tisch (ohne Karten zu verraten!)
    io.to(roomCode).emit('jugglerPassingComplete', {
      message: 'Alle Magier haben eine Karte verdeckt nach links weitergegeben.'
    });
    io.to(roomCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId, room));

    room.jugglerPassSelections = {};

    setRoomTimeout(room, () => {
      const nextCb = room.jugglerNextCallback;
      room.jugglerNextCallback = null;
      if (typeof nextCb === 'function') {
        nextCb();
      } else {
        const anyPlayerHasCards = room.players.some(p => p.hand && p.hand.length > 0);
        if (!anyPlayerHasCards) {
          finishRoundScoring(roomCode);
        } else {
          room.gameState = 'playing_tricks';
          const nextLeadSessionId = room.jugglerNextLeadSessionId;
          const nextIndex = room.players.findIndex(p => p.sessionId === nextLeadSessionId);
          room.currentTurnIndex = nextIndex !== -1 ? nextIndex : 0;
          io.to(roomCode).emit('trickUpdated', room.currentTrick);
          notifyTurn(roomCode);
        }
      }
    }, 1000);
  }

  // Spieler, der die Wolke gespielt hat, passt seine Stichvorhersage um +1 oder -1 an
  socket.on('submitCloudBidAdjustment', ({ roomCode, adjustment }) => {
    const normalizedCode = (roomCode || '').trim().toUpperCase();
    const room = rooms[normalizedCode];
    if (!room || room.gameState !== 'cloud_adjust_bid' || room.isPaused) return;

    const player = room.players.find(p => p.sessionId === room.cloudPlayerSessionId || p.sessionId === room.cloudWinnerSessionId);
    if (!player || socket.id !== player.socketId) return;

    const delta = parseInt(adjustment, 10);
    if (delta !== 1 && delta !== -1) return;

    const oldBid = player.bid !== null ? player.bid : 0;
    const newBid = Math.max(0, oldBid + delta);
    player.bid = newBid;

    io.to(normalizedCode).emit('cloudBidAdjusted', {
      playerName: player.name,
      oldBid: oldBid,
      newBid: newBid
    });
    io.to(normalizedCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId, room));

    const nextCb = room.cloudNextCallback;
    room.cloudWinnerSessionId = null;
    room.cloudPlayerSessionId = null;
    room.cloudNextCallback = null;

    if (typeof nextCb === 'function') {
      nextCb();
    } else {
      const anyCards = room.players.some(p => p.hand && p.hand.length > 0);
      if (!anyCards) {
        finishRoundScoring(normalizedCode);
      } else {
        room.gameState = 'playing_tricks';
        notifyTurn(normalizedCode);
      }
    }
  });

  // Hexen-Spieler tauscht nach Beenden des Stichs 1 Karte aus dem Stich mit 1 Karte aus der Hand
  socket.on('submitWitchSwap', ({ roomCode, trickCardIndex, handCardIndex }) => {
    const normalizedCode = (roomCode || '').trim().toUpperCase();
    const room = rooms[normalizedCode];
    if (!room || room.gameState !== 'witch_swap' || room.isPaused) return;

    const player = room.players.find(p => p.sessionId === room.witchPlayerSessionId);
    if (!player || socket.id !== player.socketId) return;

    const tIdx = parseInt(trickCardIndex, 10);
    const hIdx = parseInt(handCardIndex, 10);

    if (isNaN(tIdx) || isNaN(hIdx)) return;
    if (tIdx < 0 || tIdx >= room.currentTrick.length) return;
    if (hIdx < 0 || hIdx >= player.hand.length) return;

    // Aus dem Stich darf nicht die Hexe selbst gewählt werden
    const trickEntry = room.currentTrick[tIdx];
    if (!trickEntry || !trickEntry.card || trickEntry.card.type === 'witch') {
      socket.emit('actionError', { message: 'Du darfst nicht die Hexe selbst aus dem Stich nehmen!' });
      return;
    }

    const takenCard = trickEntry.card;
    const givenCard = player.hand[hIdx];

    room.currentTrick[tIdx].card = givenCard;
    player.hand[hIdx] = takenCard;

    let currentTrumpSuit = 'none';
    if (room.trumpCard) {
      currentTrumpSuit = room.trumpCard.chosenSuit || (room.trumpCard.type === 'color' ? room.trumpCard.suit : 'none');
    }
    player.hand = sortCards(player.hand, currentTrumpSuit);

    if (room.round === 1) {
      io.to(player.socketId).emit('handDealt', []);
    } else {
      io.to(player.socketId).emit('handDealt', player.hand);
    }
    io.to(normalizedCode).emit('trickUpdated', room.currentTrick);

    io.to(normalizedCode).emit('witchSwapShowcase', {
      witchPlayerName: player.name,
      playerName: player.name,
      playerSessionId: player.sessionId,
      takenCard,
      givenCard,
      durationMs: 1500,
      updatedTrick: room.currentTrick
    });

    const nextCb = room.witchNextCallback;
    room.witchPlayerSessionId = null;
    room.witchNextCallback = null;

    setRoomTimeout(room, () => {
      if (typeof nextCb === 'function') {
        nextCb();
      } else {
        const anyCards = room.players.some(p => p.hand && p.hand.length > 0);
        if (!anyCards) {
          finishRoundScoring(normalizedCode);
        } else {
          room.gameState = 'playing_tricks';
          notifyTurn(normalizedCode);
        }
      }
    }, 1500);
  });

  // Spieler verlässt den Raum freiwillig (Leave-Button)
  socket.on('leaveRoom', ({ roomCode }) => {
    const normalizedCode = (roomCode || '').trim().toUpperCase();
    const room = rooms[normalizedCode];
    if (!room) return;

    const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
    if (playerIndex === -1) return;

    const leavingPlayer = room.players.splice(playerIndex, 1)[0];
    socket.leave(normalizedCode);

    if (playerIndex < room.dealerIndex) {
      room.dealerIndex--;
    } else if (room.dealerIndex >= room.players.length && room.players.length > 0) {
      room.dealerIndex = 0;
    }

    // Host migrieren, falls der scheidende Spieler Host war
    if (room.hostSessionId === leavingPlayer.sessionId && room.players.length > 0) {
      const nextHost = room.players.find(p => p.connected) || room.players[0];
      room.hostSessionId = nextHost.sessionId;
    }

    if (room.players.length === 0) {
      clearRoomTimers(room);
      delete rooms[normalizedCode];
      return;
    }

    if (room.gameState === 'lobby') {
      io.to(normalizedCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId, room));
    } else {
      // Während des Spiels verlassen:
      if (room.isRanked && leavingPlayer.userId) {
        dbModule.applyLeaverPenalty(leavingPlayer.userId);
      }
      if (room.players.length >= 3) {
        reDealCurrentRound(normalizedCode, `${leavingPlayer.name} hat das Spiel verlassen. Runde ${room.round} wird neu gestartet.`);
      } else {
        resetRoomToLobby(normalizedCode, `${leavingPlayer.name} hat das Spiel verlassen. Weniger als 3 Spieler im Raum – zurück zur Lobby.`);
      }
    }
  });

  // Verbindungsabbruch
  socket.on('disconnect', () => {
    unregisterUserSocket(socket);
    for (const code in rooms) {
      const room = rooms[code];
      const player = room.players.find(p => p.socketId === socket.id);
      if (player) {
        player.connected = false;

        // Host migrieren, falls der scheidende Spieler Host war
        if (room.hostSessionId === player.sessionId) {
          const nextHost = room.players.find(p => p.connected && p.sessionId !== player.sessionId);
          if (nextHost) room.hostSessionId = nextHost.sessionId;
        }

        // Im laufenden Spiel: Spiel pausieren
        if (room.gameState !== 'lobby') {
          room.isPaused = true;
          room.pausedReason = { playerName: player.name, sessionId: player.sessionId };
          clearRoomTimers(room);
          io.to(code).emit('gamePaused', {
            pausedPlayerName: player.name,
            sessionId: player.sessionId
          });
        }

        io.to(code).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId, room));
        checkRoomCleanup(code);
        break;
      }
    }
  });

  function notifyTurn(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;

    let activePlayer = null;
    if (room.gameState === 'choose_trump') {
      if (room.trumpChooserSessionId) {
        activePlayer = room.players.find(p => p.sessionId === room.trumpChooserSessionId);
      }
      if (!activePlayer) {
        activePlayer = room.players[room.dealerIndex];
      }
    } else if (room.players[room.currentTurnIndex]) {
      activePlayer = room.players[room.currentTurnIndex];
    }

    if (room.gameState === 'bidding' && (room.biddingMode === 'simultaneous' || room.biddingMode === 'secret')) {
      io.to(roomCode).emit('turnChanged', {
        activePlayerSessionId: 'all',
        gameState: 'bidding',
        forbiddenBid: null
      });

      broadcastRoomUpdated(room);

      // Triggere alle Bots, die noch nicht geboten haben
      room.players.forEach(p => {
        if (p.isBot && (p.bid === null || p.bid === undefined)) {
          let currentTrumpSuit = 'none';
          if (room.trumpCard) {
            currentTrumpSuit = room.trumpCard.chosenSuit || (room.trumpCard.type === 'color' ? room.trumpCard.suit : 'none');
          }
          const botBid = calculateBotBid(
            p.hand,
            room.trumpCard,
            currentTrumpSuit,
            [],
            false,
            room.round,
            room.players.length,
            p.difficulty || 'master',
            room.edition || 'classic'
          );
          const delay = 350 + Math.floor(Math.random() * 300);
          setRoomTimeout(room, () => {
            if (room.gameState === 'bidding' && (p.bid === null || p.bid === undefined)) {
              handlePlayerBid(room, p.sessionId, botBid);
            }
          }, delay);
        }
      });
      return;
    }

    const isLastPlayer = (room.currentTurnIndex === room.dealerIndex);
    let forbiddenBid = null;

    if (room.gameState === 'bidding' && isLastPlayer) {
      const totalBidsSoFar = room.players.reduce((sum, p) => sum + (p.bid !== null ? p.bid : 0), 0);
      forbiddenBid = room.round - totalBidsSoFar;
      if (forbiddenBid < 0) forbiddenBid = null;
    }

    io.to(roomCode).emit('turnChanged', {
      activePlayerSessionId: activePlayer ? activePlayer.sessionId : null,
      gameState: room.gameState,
      forbiddenBid: forbiddenBid
    });

    // Bot-Automatisierung für aktive Züge
    if (activePlayer && activePlayer.isBot && !room.isPaused) {
      triggerBotTurn(room, activePlayer);
    }
  }

  function triggerBotTurn(room, bot) {
    if (room.gameState === 'choose_trump') {
      let bestSuit = 'red';
      if (bot.hand && bot.hand.length > 0) {
        const counts = { red: 0, blue: 0, green: 0, yellow: 0 };
        bot.hand.forEach(c => {
          if (c && c.type === 'color' && counts[c.suit] !== undefined) {
            counts[c.suit]++;
          }
        });
        let maxCount = -1;
        for (const s of ['red', 'blue', 'green', 'yellow']) {
          if (counts[s] > maxCount) {
            maxCount = counts[s];
            bestSuit = s;
          }
        }
      }
      setRoomTimeout(room, () => {
        handleSelectTrumpSuit(room, bot.sessionId, bestSuit);
      }, 450 + Math.floor(Math.random() * 250));
    } else if (room.gameState === 'bidding') {
      let currentTrumpSuit = 'none';
      if (room.trumpCard) {
        currentTrumpSuit = room.trumpCard.chosenSuit || (room.trumpCard.type === 'color' ? room.trumpCard.suit : 'none');
      }
      const isDealer = (room.currentTurnIndex === room.dealerIndex);
      const playerBids = room.players.map(p => p.bid);
      const botBid = calculateBotBid(
        bot.hand,
        room.trumpCard,
        currentTrumpSuit,
        playerBids,
        isDealer,
        room.round,
        room.players.length,
        bot.difficulty || 'master',
        room.edition || 'classic'
      );

      setRoomTimeout(room, () => {
        handlePlayerBid(room, bot.sessionId, botBid);
      }, 450 + Math.floor(Math.random() * 300));
    } else if (room.gameState === 'playing_tricks') {
      const teammate = (room.matchFormat === 'team_2v2' && bot.team)
        ? room.players.find(p => p.team === bot.team && p.sessionId !== bot.sessionId)
        : null;

      const roomContext = {
        playedCards: room.roundPlayedCards || [],
        playerVoids: room.playerVoids || {},
        players: room.players,
        edition: room.edition || 'classic',
        botSessionId: bot.sessionId,
        matchFormat: room.matchFormat || 'ffa',
      scoringMode: room.scoringMode || 'classic',
      biddingMode: room.biddingMode || 'classic',
        team: bot.team || null,
        teammateSessionId: teammate ? teammate.sessionId : null,
        teammate: teammate ? { sessionId: teammate.sessionId, name: teammate.name, bid: teammate.bid, tricksWon: teammate.tricksWon } : null
      };

      const botDecision = chooseBotCard(
        bot.hand,
        room.currentTrick,
        room.trumpCard,
        bot.bid !== null ? bot.bid : 0,
        bot.tricksWon,
        room.round,
        bot.difficulty || 'master',
        roomContext
      );

      const cardIdx = (typeof botDecision === 'object' && botDecision !== null) ? botDecision.cardIndex : botDecision;
      const card = bot.hand[cardIdx];
      let chosenRole = (botDecision && botDecision.chosenRole) ? botDecision.chosenRole : 'wizard';
      let chosenSuit = (botDecision && botDecision.chosenSuit) ? botDecision.chosenSuit : ((room.trumpSuit && room.trumpSuit !== 'none') ? room.trumpSuit : 'red');

      if (card && card.type === 'shapeshifter' && !botDecision.chosenRole) {
        const needsTricks = (bot.bid !== null ? bot.bid : 0) > bot.tricksWon;
        chosenRole = needsTricks ? 'wizard' : 'jester';
      }

      setRoomTimeout(room, () => {
        handlePlayerPlayCard(room, bot.sessionId, cardIdx, chosenRole, chosenSuit);
      }, 450 + Math.floor(Math.random() * 300));
    }
  }

  function getSanitizedPlayers(players, dealerIndex, hostSessionId, room = null, viewerSessionId = null) {
    return players.map((p, idx) => {
      let bidVal = p.bid;
      const hasBid = (p.bid !== null && p.bid !== undefined);

      if (room && viewerSessionId) {
        const isSelf = (p.sessionId === viewerSessionId);
        // Im Simultan-Modus während der Bietphase: Fremde Tipps nicht verraten (nur '✓')
        if (room.biddingMode === 'simultaneous' && room.gameState === 'bidding') {
          if (!isSelf) {
            bidVal = hasBid ? '✓' : null;
          }
        }
        // Im Geheim-Modus während der Bietphase: Fremde Tipps als '✓' maskieren
        if (room.biddingMode === 'secret' && room.gameState === 'bidding') {
          if (!isSelf) {
            bidVal = hasBid ? '✓' : null;
          }
        }
        // Im Geheim-Modus während des Spiels: Fremde Tipps als '?' maskieren (auch für Teampartner!)
        if (room.biddingMode === 'secret' && room.gameState !== 'round_over' && room.gameState !== 'lobby' && room.gameState !== 'bidding') {
          if (!isSelf) {
            bidVal = hasBid ? '?' : null;
          }
        }
      }

      let userStats = p.userStats || null;
      if (!userStats && p.userId && dbModule && typeof dbModule.getUserById === 'function') {
        try {
          const u = dbModule.getUserById(p.userId);
          if (u && typeof u.then !== 'function') {
            userStats = {
              gamesPlayed: u.games_played || 0,
              gamesWon: u.games_won || 0,
              winRate: (u.games_played > 0) ? Math.round(((u.games_won || 0) / u.games_played) * 100) : 0,
              highestScore: u.highest_score || 0,
              skillRating: u.skill_rating || 1000
            };
          }
        } catch (e) {
          // Fallback falls DB temporär beschäftigt
        }
      }

      const pData = {
        sessionId: p.sessionId,
        name: p.name,
        avatarId: p.avatarId || 'wizard_blue',
        title: p.title || 'Zauberlehrling',
        accountLevel: p.accountLevel || 1,
        cardBack: p.cardBack || 'default',
        avatarFrame: p.avatarFrame || 'none',
        team: p.team || null,
        bid: bidVal,
        hasBid: hasBid,
        tricksWon: p.tricksWon,
        totalScore: p.totalScore,
        connected: p.connected,
        isDealer: idx === dealerIndex,
        isHost: p.sessionId === hostSessionId,
        handCount: p.hand ? p.hand.length : 0,
        userId: p.userId || null,
        userStats: userStats,
        isBot: !!p.isBot,
        difficulty: p.difficulty || (p.isBot ? 'master' : null),
        skillRating: p.isBot ? p.skillRating : (p.userId ? (p.skillRating || (p.rank ? p.rank.sr : 1000)) : null),
        rank: p.isBot ? p.rank : (p.userId ? (p.rank || dbModule.getRankDetailsFromSR(p.skillRating || 1000)) : null)
      };
      if (room && room.round === 1 && p.hand && p.hand[0]) {
        pData.round1Card = p.hand[0];
      }
      return pData;
    });
  }

  function broadcastRoomUpdated(room) {
    if (!room) return;
    const isSecret = (room.biddingMode === 'secret' && room.gameState !== 'round_over' && room.gameState !== 'lobby');
    const isSimultaneousBidding = (room.biddingMode === 'simultaneous' && room.gameState === 'bidding');
    const isSecretBidding = (room.biddingMode === 'secret' && room.gameState === 'bidding');

    if (isSecret || isSimultaneousBidding || isSecretBidding) {
      room.players.forEach(p => {
        if (p.socketId) {
          io.to(p.socketId).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId, room, p.sessionId));
        }
      });
    } else {
      io.to(room.roomCode).emit('roomUpdated', getSanitizedPlayers(room.players, room.dealerIndex, room.hostSessionId, room));
    }
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server läuft! Öffne http://localhost:${PORT}`);
});