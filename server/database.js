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

function getEngine() {
  return activeEngine.engine;
}

function isPostgres() {
  return activeEngine.engine === 'postgres';
}

function setEngine(engineInstance) {
  activeEngine = engineInstance;
}

function closeDatabase() {
  if (activeEngine && typeof activeEngine.closeDatabase === 'function') {
    return activeEngine.closeDatabase();
  }
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
    return activeEngine.db;
  },
  get pool() {
    return activeEngine.pool || null;
  },
  getEngine,
  isPostgres,
  setEngine,
  createSqliteEngine: (path) => createSqliteEngine(path, sharedHelpers),
  createPostgresEngine: (cfg) => createPostgresEngine(cfg, sharedHelpers),

  // Shared Helper
  getRankDetailsFromSR: sharedHelpers.getRankDetailsFromSR,
  formatUserWithRank: sharedHelpers.formatUserWithRank,
  validateUsername: sharedHelpers.validateUsername,
  RESERVED_USERNAMES: sharedHelpers.RESERVED_USERNAMES,

  // CRUD & Game Logging API
  isUsernameAvailable: (...args) => activeEngine.isUsernameAvailable(...args),
  registerUser: (...args) => activeEngine.registerUser(...args),
  loginUser: (...args) => activeEngine.loginUser(...args),
  getUserByToken: (...args) => activeEngine.getUserByToken(...args),
  touchSession: (...args) => activeEngine.touchSession(...args),
  backupDatabase: (...args) => activeEngine.backupDatabase(...args),
  logoutUser: (...args) => activeEngine.logoutUser(...args),
  updateUserProfile: (...args) => activeEngine.updateUserProfile(...args),
  recordRoundBid: (...args) => activeEngine.recordRoundBid(...args),
  recordSpecialCard: (...args) => activeEngine.recordSpecialCard(...args),
  recordGameFinished: (...args) => activeEngine.recordGameFinished(...args),
  recordRankedGameFinished: (...args) => activeEngine.recordRankedGameFinished(...args),
  applyLeaverPenalty: (...args) => activeEngine.applyLeaverPenalty(...args),
  popPenaltyNotice: (...args) => activeEngine.popPenaltyNotice(...args),
  getLeaderboard: (...args) => activeEngine.getLeaderboard(...args),
  getRankedLeaderboard: (...args) => activeEngine.getRankedLeaderboard(...args),
  getUserById: (...args) => activeEngine.getUserById(...args),
  addFriend: (...args) => activeEngine.addFriend(...args),
  removeFriend: (...args) => activeEngine.removeFriend(...args),
  getFriends: (...args) => activeEngine.getFriends(...args),
  closeDatabase
};
