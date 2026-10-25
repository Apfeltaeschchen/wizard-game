/**
 * matchHighlightAndMvp.js
 * In-Engine Cinematic Highlight des Spiels (POTG) und Post-Match MVP-Voting Logik
 */

function calculateSpectacleScore(room, trickResult = {}, winner = null) {
  if (!room) return { spectacleScore: 0, headline: '', description: '' };

  const currentTrick = room.currentTrick || [];
  const hasDragon = currentTrick.some(t => t.card && (t.card.type === 'dragon' || (t.card.type === 'vampire' && t.card.copiedCard && t.card.copiedCard.type === 'dragon')));
  const hasFairy = currentTrick.some(t => t.card && (t.card.type === 'fairy' || t.card.type === 'unicorn'));
  const isBombed = !!trickResult.isBombed;
  const wizardCount = currentTrick.filter(t => t.card && (t.card.type === 'wizard' || (t.card.type === 'shapeshifter' && t.card.chosenRole === 'wizard'))).length;

  let spectacleScore = 50 + ((room.round || 1) * 5);
  let headline = `${winner ? winner.name : 'Die Zitadelle'} – Stich in Runde ${room.round || 1}`;
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
  } else if (winner && winner.bid === 0 && (room.round || 1) >= 2) {
    spectacleScore += 95;
    headline = `${winner.name} – Meisterstück der Prophezeiung!`;
    description = 'Trotz Null-Ansage meisterhaft kalkuliert und den Stich abgetreten!';
  } else if (winner) {
    spectacleScore += 40 + ((winner.tricksWon || 0) * 10);
    headline = `${winner.name} – Triumphzug in Runde ${room.round}!`;
    description = 'Wichtiger Stich zur Erfüllung der Prophezeiung gesichert!';
  }

  return { spectacleScore, headline, description };
}

function recordTrickHighlight(room, trickResult = {}, winner = null) {
  if (!room) return null;
  if (!room.matchHighlights) room.matchHighlights = [];

  const trickCards = (room.currentTrick || []).map(t => ({
    playerName: t.playerName,
    playerSessionId: t.playerSessionId,
    card: t.card
  }));

  const { spectacleScore, headline, description } = calculateSpectacleScore(room, trickResult, winner);

  const highlightEntry = {
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
  };

  room.matchHighlights.push(highlightEntry);
  return highlightEntry;
}

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

function resolveMvpVotingWinner(candidates = [], voteCounts = {}) {
  let maxVotes = -1;
  let winnerSessionId = null;

  candidates.forEach(c => {
    const v = voteCounts[c.sessionId] || 0;
    if (v > maxVotes) {
      maxVotes = v;
      winnerSessionId = c.sessionId;
    }
  });

  if (!winnerSessionId && candidates.length > 0) {
    winnerSessionId = candidates[0].sessionId;
  }

  return {
    winnerSessionId,
    maxVotes: Math.max(0, maxVotes)
  };
}

module.exports = {
  calculateSpectacleScore,
  recordTrickHighlight,
  generateMvpCandidates,
  resolveMvpVotingWinner
};
