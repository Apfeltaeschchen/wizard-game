const sharedHelpers = require('./db/sharedHelpers');
const { createSqliteEngine } = require('./db/sqliteEngine');
const { createPostgresEngine } = require('./db/postgresEngine');

const isPostgresEnv = !!(
  process.env.DATABASE_URL ||
  process.env.PGHOST ||
  process.env.DB_CLIENT === 'postgres'
);

let activeEngine = isPostgresEnv
  ? createPostgresEngine(process.env.DATABASE_URL, sharedHelpers)
  : createSqliteEngine(process.env.WIZARD_DB_PATH, sharedHelpers);

let sqliteFallbackInstance = null;

function getSqliteFallback() {
  if (!sqliteFallbackInstance) {
    sqliteFallbackInstance = createSqliteEngine(process.env.WIZARD_DB_PATH, sharedHelpers);
  }
  return sqliteFallbackInstance;
}

function switchToSqlite(reason) {
  if (activeEngine && activeEngine.engine === 'sqlite') {
    return activeEngine;
  }
  console.warn(`[Database] PostgreSQL nicht verfügbar oder abgebrochen (${reason || 'Unbekannter Grund'}). Wechsle unterbrechungsfrei zu SQLite.`);
  try {
    if (activeEngine && typeof activeEngine.closeDatabase === 'function') {
      const closeRes = activeEngine.closeDatabase();
      if (closeRes && typeof closeRes.catch === 'function') {
        closeRes.catch(() => {});
      }
    }
  } catch (e) {}
  activeEngine = getSqliteFallback();
  return activeEngine;
}

if (isPostgresEnv && activeEngine.engine === 'postgres' && typeof activeEngine.ensureInitialized === 'function') {
  activeEngine.ensureInitialized().catch((err) => {
    console.warn('[Database] Initialer PostgreSQL-Verbindungsversuch fehlgeschlagen:', err.message);
    switchToSqlite(err.message);
  });
}

function invokeEngine(methodName, ...args) {
  if (!activeEngine) {
    activeEngine = getSqliteFallback();
  }

  if (activeEngine.engine === 'postgres') {
    try {
      const res = activeEngine[methodName](...args);
      if (res && typeof res.then === 'function') {
        return res.catch((err) => {
          console.warn(`[Database] PostgreSQL-Fehler bei "${methodName}": ${err.message}. Schalte auf SQLite-Fallback um.`);
          const fallback = switchToSqlite(err.message);
          return fallback[methodName](...args);
        });
      }
      return res;
    } catch (err) {
      console.warn(`[Database] Synchroner Fehler bei "${methodName}" (PostgreSQL): ${err.message}. Schalte auf SQLite-Fallback um.`);
      const fallback = switchToSqlite(err.message);
      return fallback[methodName](...args);
    }
  }

  return activeEngine[methodName](...args);
}

function getEngine() {
  if (!activeEngine) {
    activeEngine = getSqliteFallback();
  }
  return activeEngine ? activeEngine.engine : 'sqlite';
}

function isPostgres() {
  return activeEngine ? (activeEngine.engine === 'postgres') : false;
}

function setEngine(engineInstance) {
  activeEngine = engineInstance;
}

function closeDatabase() {
  const promises = [];
  if (activeEngine && typeof activeEngine.closeDatabase === 'function') {
    try {
      const res = activeEngine.closeDatabase();
      if (res && typeof res.then === 'function') promises.push(res);
    } catch (e) {}
  }
  if (sqliteFallbackInstance && sqliteFallbackInstance !== activeEngine && typeof sqliteFallbackInstance.closeDatabase === 'function') {
    try {
      const res = sqliteFallbackInstance.closeDatabase();
      if (res && typeof res.then === 'function') promises.push(res);
    } catch (e) {}
  }
  activeEngine = null;
  sqliteFallbackInstance = null;
  return promises.length ? Promise.all(promises) : undefined;
}

process.once('SIGINT', () => {
  try { closeDatabase(); } catch (e) {}
  process.exit(0);
});

process.once('SIGTERM', () => {
  try { closeDatabase(); } catch (e) {}
  process.exit(0);
});

module.exports = {
  // Underlying DB instance (better-sqlite3 db or pg.Pool)
  get db() {
    if (!activeEngine) {
      activeEngine = getSqliteFallback();
    }
    return activeEngine ? activeEngine.db : null;
  },
  get pool() {
    return (activeEngine && activeEngine.pool) || null;
  },
  getEngine,
  isPostgres,
  setEngine,
  switchToSqlite,
  getSqliteFallback,
  createSqliteEngine: (path) => createSqliteEngine(path, sharedHelpers),
  createPostgresEngine: (cfg) => createPostgresEngine(cfg, sharedHelpers),

  // Shared Helper
  getRankDetailsFromSR: sharedHelpers.getRankDetailsFromSR,
  formatUserWithRank: sharedHelpers.formatUserWithRank,
  validateUsername: sharedHelpers.validateUsername,
  RESERVED_USERNAMES: sharedHelpers.RESERVED_USERNAMES,

  // CRUD & Game Logging API mit automatischem Fallback
  isUsernameAvailable: (...args) => invokeEngine('isUsernameAvailable', ...args),
  registerUser: (...args) => invokeEngine('registerUser', ...args),
  loginUser: (...args) => invokeEngine('loginUser', ...args),
  getUserByToken: (...args) => invokeEngine('getUserByToken', ...args),
  touchSession: (...args) => invokeEngine('touchSession', ...args),
  backupDatabase: (...args) => invokeEngine('backupDatabase', ...args),
  logoutUser: (...args) => invokeEngine('logoutUser', ...args),
  updateUserProfile: (...args) => invokeEngine('updateUserProfile', ...args),
  recordRoundBid: (...args) => invokeEngine('recordRoundBid', ...args),
  recordSpecialCard: (...args) => invokeEngine('recordSpecialCard', ...args),
  recordGameFinished: (...args) => invokeEngine('recordGameFinished', ...args),
  recordRankedGameFinished: (...args) => invokeEngine('recordRankedGameFinished', ...args),
  applyLeaverPenalty: (...args) => invokeEngine('applyLeaverPenalty', ...args),
  popPenaltyNotice: (...args) => invokeEngine('popPenaltyNotice', ...args),
  getLeaderboard: (...args) => invokeEngine('getLeaderboard', ...args),
  getRankedLeaderboard: (...args) => invokeEngine('getRankedLeaderboard', ...args),
  getUserById: (...args) => invokeEngine('getUserById', ...args),
  addFriend: (...args) => invokeEngine('addFriend', ...args),
  removeFriend: (...args) => invokeEngine('removeFriend', ...args),
  getFriends: (...args) => invokeEngine('getFriends', ...args),
  getUserCosmetics: (...args) => invokeEngine('getUserCosmetics', ...args),
  openChest: (...args) => invokeEngine('openChest', ...args),
  equipCosmetic: (...args) => invokeEngine('equipCosmetic', ...args),
  craftCosmetic: (...args) => invokeEngine('craftCosmetic', ...args),
  claimWeeklyMilestone: (...args) => invokeEngine('claimWeeklyMilestone', ...args),
  applyMatchProgression: (...args) => invokeEngine('applyMatchProgression', ...args),
  awardBonusXP: (...args) => invokeEngine('awardBonusXP', ...args),
  awardCosmetic: (...args) => invokeEngine('awardCosmetic', ...args),
  exportAccountsBackup: (...args) => invokeEngine('exportAccountsBackup', ...args),
  importAccountsBackupIfEmpty: (...args) => invokeEngine('importAccountsBackupIfEmpty', ...args),
  closeDatabase
};
