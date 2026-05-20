'use strict';

const RANKS = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
const SUITS = ['c','d','h','s'];
const SUIT_COLOR = { c: 'black', d: 'red', h: 'red', s: 'black' };

const SUIT_SVG = {
  s: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M12 2C12 2 3.5 9 3.5 14.5a4.5 4.5 0 0 0 7.5 3.35V19l-1.5 2.5h5l-1.5-2.5v-1.15a4.5 4.5 0 0 0 7.5-3.35C20.5 9 12 2 12 2z"/></svg>',
  h: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M12 21.5s-8-5.2-8-11.2C4 6.8 6.3 5 8.7 5c1.7 0 3 .9 3.3 1.8C12.3 5.9 13.6 5 15.3 5 17.7 5 20 6.8 20 10.3c0 6-8 11.2-8 11.2z"/></svg>',
  d: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M12 2L21 12 12 22 3 12z"/></svg>',
  c: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M12 2a3.5 3.5 0 0 0-3.18 5A3.5 3.5 0 1 0 9.7 13.7L9 19l-1.5 2.5h9L15 19l-.7-5.3A3.5 3.5 0 1 0 15.18 7 3.5 3.5 0 0 0 12 2z"/></svg>'
};

const OPP_NAMES = ['Aria', 'Bruno', 'Carla', 'Diego', 'Elena', 'Felix', 'Greta', 'Hugo'];

const state = {
  players: [],
  deck: [],
  board: [],
  pot: 0,
  currentBet: 0,
  minRaise: 0,
  street: 'preflop',
  dealerIdx: 0,
  actorIdx: 0,
  smallBlind: 10,
  bigBlind: 20,
  handNum: 0,
  waitingForHuman: false,
  gameOver: false,
};

/* ============================================================
 * Deck / cards
 * ============================================================ */
function freshDeck() {
  const deck = [];
  for (const r of RANKS) for (const s of SUITS) deck.push(r + s);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function cardEl(code, hidden = false) {
  const el = document.createElement('div');
  if (hidden) {
    el.className = 'card back';
    return el;
  }
  const rank = code[0] === 'T' ? '10' : code[0];
  const suit = code[1];
  el.className = 'card ' + SUIT_COLOR[suit];
  el.innerHTML =
    '<div class="corner tl">' + rank + SUIT_SVG[suit] + '</div>' +
    '<div class="center-suit">' + SUIT_SVG[suit] + '</div>' +
    '<div class="corner br">' + rank + SUIT_SVG[suit] + '</div>';
  return el;
}

/* ============================================================
 * Table layout — places opponents around the top arc
 * ============================================================ */
function opponentPositions(nOpp) {
  const slots = [];
  for (let i = 0; i < nOpp; i++) {
    const t = nOpp === 1 ? 0.5 : i / (nOpp - 1);
    const angleDeg = 205 + t * 130;
    const a = angleDeg * Math.PI / 180;
    const x = 0.5 + 0.44 * Math.cos(a);
    const y = 0.5 + 0.45 * Math.sin(a);
    slots.push({ x, y });
  }
  return slots;
}

/* ============================================================
 * Build/refresh table DOM
 * ============================================================ */
function buildTable() {
  const table = document.getElementById('table');
  table.querySelectorAll('.player-slot').forEach(el => el.remove());

  const hero = document.createElement('div');
  hero.className = 'player-slot hero';
  hero.id = 'slot-0';
  hero.style.bottom = '8px';
  hero.style.left = '50%';
  hero.style.transform = 'translateX(-50%)';
  hero.innerHTML = `
    <div class="player-cards" id="cards-0"></div>
    <div class="player-info">
      <div class="name">${state.players[0].name}</div>
      <div class="stack" id="stack-0">${state.players[0].stack}</div>
      <div class="status" id="status-0"></div>
    </div>
  `;
  table.appendChild(hero);

  const positions = opponentPositions(state.players.length - 1);
  for (let i = 1; i < state.players.length; i++) {
    const p = positions[i - 1];
    const slot = document.createElement('div');
    slot.className = 'player-slot';
    slot.id = 'slot-' + i;
    slot.style.left = (p.x * 100) + '%';
    slot.style.top = (p.y * 100) + '%';
    slot.style.transform = 'translate(-50%, -50%)';
    slot.innerHTML = `
      <div class="player-cards" id="cards-${i}"></div>
      <div class="player-info">
        <div class="name">${state.players[i].name}</div>
        <div class="stack" id="stack-${i}">${state.players[i].stack}</div>
        <div class="status" id="status-${i}"></div>
      </div>
    `;
    table.appendChild(slot);
  }
}

/* ============================================================
 * UI helpers
 * ============================================================ */
function log(msg, cls) {
  const logEl = document.getElementById('log');
  const e = document.createElement('div');
  e.className = 'entry ' + (cls || '');
  e.textContent = msg;
  logEl.appendChild(e);
  logEl.scrollTop = logEl.scrollHeight;
}

function updateUI() {
  state.players.forEach((p, i) => {
    const stackEl = document.getElementById('stack-' + i);
    const statusEl = document.getElementById('status-' + i);
    if (!stackEl) return;
    stackEl.textContent = p.stack;
    let status = '';
    if (p.eliminated) status = 'Eliminado';
    else if (p.folded) status = 'Retirado';
    else if (p.allIn) status = 'ALL-IN';
    else if (p.betThisRound > 0) status = 'Apuesta: ' + p.betThisRound;
    statusEl.textContent = status;

    const slot = document.getElementById('slot-' + i);
    slot.classList.toggle('folded', p.folded || p.eliminated);
    slot.classList.toggle('active', i === state.actorIdx && !p.folded && !p.allIn && !state.gameOver);
    slot.classList.toggle('winner', !!p.lastWinner);
  });
  document.getElementById('pot').textContent = state.pot;
  document.getElementById('cbet').textContent = state.currentBet;
  document.getElementById('hand-num').textContent = state.handNum;

  document.querySelectorAll('.dealer-btn').forEach(el => el.remove());
  const dealerSlot = document.getElementById('slot-' + state.dealerIdx);
  if (dealerSlot && !state.players[state.dealerIdx].eliminated) {
    const d = document.createElement('div');
    d.className = 'dealer-btn';
    d.textContent = 'D';
    d.style.bottom = '-6px';
    d.style.right = '-6px';
    dealerSlot.appendChild(d);
  }
}

function renderHoleCards() {
  state.players.forEach((p, i) => {
    const el = document.getElementById('cards-' + i);
    if (!el) return;
    el.innerHTML = '';
    if (p.eliminated || p.holeCards.length === 0) return;
    p.holeCards.forEach((c, k) => {
      const reveal = (i === 0) || state.street === 'showdown' || p.revealed;
      const node = cardEl(c, !reveal);
      node.style.animationDelay = (k * 0.08) + 's';
      el.appendChild(node);
    });
  });
}

function renderCommunity() {
  const comm = document.getElementById('community');
  comm.innerHTML = '';
  state.board.forEach((c, k) => {
    const node = cardEl(c);
    node.style.animationDelay = (k * 0.12) + 's';
    comm.appendChild(node);
  });
}

/* ============================================================
 * Game flow — start / new hand
 * ============================================================ */
function startGame(numOpponents, startingStack, sb, bb) {
  state.players = [{
    name: 'Tú', stack: startingStack, holeCards: [],
    folded: false, allIn: false, eliminated: false, isHuman: true,
    betThisRound: 0, totalContrib: 0, hasActed: false, lastWinner: false, revealed: false,
  }];
  for (let i = 0; i < numOpponents; i++) {
    state.players.push({
      name: OPP_NAMES[i], stack: startingStack, holeCards: [],
      folded: false, allIn: false, eliminated: false, isHuman: false,
      betThisRound: 0, totalContrib: 0, hasActed: false, lastWinner: false, revealed: false,
    });
  }
  state.smallBlind = sb;
  state.bigBlind = bb;
  state.dealerIdx = Math.floor(Math.random() * state.players.length);
  state.handNum = 0;
  state.gameOver = false;

  document.getElementById('setup-screen').classList.remove('active');
  document.getElementById('game-screen').classList.add('active');
  document.getElementById('log').innerHTML = '';
  log('Partida iniciada con ' + numOpponents + ' contrincantes. Stack: ' + startingStack, 'hand');
  buildTable();
  setTimeout(newHand, 400);
}

function newHand() {
  if (state.gameOver) return;

  state.players.forEach(p => {
    if (p.stack <= 0) p.eliminated = true;
  });

  const alive = state.players.filter(p => !p.eliminated);
  if (alive.length < 2) return endGame(alive[0]);
  if (state.players[0].eliminated) return endGame(null);

  state.handNum++;
  state.deck = freshDeck();
  state.board = [];
  state.pot = 0;
  state.currentBet = 0;
  state.minRaise = state.bigBlind;
  state.street = 'preflop';

  state.players.forEach(p => {
    p.holeCards = [];
    p.folded = p.eliminated;
    p.allIn = false;
    p.betThisRound = 0;
    p.totalContrib = 0;
    p.hasActed = false;
    p.lastWinner = false;
    p.revealed = false;
  });

  state.dealerIdx = nextAlive(state.dealerIdx);

  state.players.forEach((_, i) => {
    const el = document.getElementById('cards-' + i);
    if (el) el.innerHTML = '';
  });
  document.getElementById('community').innerHTML = '';
  log('— Mano #' + state.handNum + ' —', 'hand');

  // Heads-up rule: with 2 players, dealer = SB
  const heads = alive.length === 2;
  const sbIdx = heads ? state.dealerIdx : nextAlive(state.dealerIdx);
  const bbIdx = nextAlive(sbIdx);

  postBet(sbIdx, state.smallBlind);
  postBet(bbIdx, state.bigBlind);
  state.currentBet = state.bigBlind;
  log(state.players[sbIdx].name + ' pone ciega pequeña (' + state.smallBlind + ')');
  log(state.players[bbIdx].name + ' pone ciega grande (' + state.bigBlind + ')');

  dealHoleCards();
  renderHoleCards();
  updateUI();

  state.actorIdx = nextActive(bbIdx);
  setTimeout(advanceAction, 700);
}

function endGame(winner) {
  state.gameOver = true;
  updateUI();
  const banner = document.getElementById('banner');
  banner.classList.remove('hidden');
  if (winner && winner.isHuman) {
    document.getElementById('banner-title').textContent = '¡Has ganado!';
    document.getElementById('banner-text').textContent = 'Stack final: ' + winner.stack;
  } else if (winner) {
    document.getElementById('banner-title').textContent = 'Has perdido';
    document.getElementById('banner-text').textContent = winner.name + ' se llevó todas las fichas.';
  } else {
    document.getElementById('banner-title').textContent = 'Eliminado';
    document.getElementById('banner-text').textContent = 'Te quedaste sin fichas.';
  }
}

/* ============================================================
 * Player order helpers
 * ============================================================ */
function nextAlive(idx) {
  for (let k = 1; k <= state.players.length; k++) {
    const i = (idx + k) % state.players.length;
    if (!state.players[i].eliminated) return i;
  }
  return idx;
}

function nextActive(idx) {
  for (let k = 1; k <= state.players.length; k++) {
    const i = (idx + k) % state.players.length;
    const p = state.players[i];
    if (!p.folded && !p.allIn && !p.eliminated) return i;
  }
  return -1;
}

function postBet(idx, amt) {
  const p = state.players[idx];
  const real = Math.min(amt, p.stack);
  p.stack -= real;
  p.betThisRound += real;
  p.totalContrib += real;
  state.pot += real;
  if (p.stack === 0) p.allIn = true;
}

function dealHoleCards() {
  const order = [];
  let i = state.dealerIdx;
  for (let k = 0; k < state.players.length; k++) {
    i = nextAlive(i);
    if (order.includes(i)) break;
    order.push(i);
  }
  for (let round = 0; round < 2; round++) {
    order.forEach(idx => state.players[idx].holeCards.push(state.deck.pop()));
  }
}

/* ============================================================
 * Action loop
 * ============================================================ */
function advanceAction() {
  if (state.gameOver) return;

  const inHand = state.players.filter(p => !p.folded && !p.eliminated);
  if (inHand.length === 1) {
    const winnerIdx = state.players.indexOf(inHand[0]);
    return awardUncontested(winnerIdx);
  }

  const canAct = state.players.filter(p => !p.folded && !p.allIn && !p.eliminated);
  if (canAct.length === 0) return advanceStreet(true);
  if (canAct.length === 1 && canAct[0].betThisRound >= state.currentBet) {
    return advanceStreet(true);
  }

  if (isBettingRoundComplete()) return advanceStreet(false);

  const idx = state.actorIdx;
  const p = state.players[idx];
  if (!p || p.folded || p.allIn || p.eliminated) {
    state.actorIdx = nextActive(idx);
    if (state.actorIdx === -1) return advanceStreet(true);
    return advanceAction();
  }

  updateUI();

  if (p.isHuman) {
    showActionPanel();
  } else {
    hideActionPanel();
    setTimeout(() => aiAct(idx), 700 + Math.random() * 500);
  }
}

function isBettingRoundComplete() {
  const canAct = state.players.filter(p => !p.folded && !p.allIn && !p.eliminated);
  if (canAct.length === 0) return true;
  return canAct.every(p => p.hasActed && p.betThisRound === state.currentBet);
}

function advanceStreet(skipBets) {
  state.players.forEach(p => {
    p.betThisRound = 0;
    p.hasActed = false;
  });
  state.currentBet = 0;
  state.minRaise = state.bigBlind;

  if (state.street === 'preflop') {
    state.street = 'flop';
    state.deck.pop();
    state.board.push(state.deck.pop(), state.deck.pop(), state.deck.pop());
    log('Flop: ' + state.board.map(formatCard).join(' '), 'street');
  } else if (state.street === 'flop') {
    state.street = 'turn';
    state.deck.pop();
    state.board.push(state.deck.pop());
    log('Turn: ' + formatCard(state.board[3]), 'street');
  } else if (state.street === 'turn') {
    state.street = 'river';
    state.deck.pop();
    state.board.push(state.deck.pop());
    log('River: ' + formatCard(state.board[4]), 'street');
  } else if (state.street === 'river') {
    return showdown();
  }

  renderCommunity();
  updateUI();

  const canAct = state.players.filter(p => !p.folded && !p.allIn && !p.eliminated);
  if (skipBets || canAct.length < 2) {
    setTimeout(() => advanceStreet(true), 1300);
    return;
  }

  state.actorIdx = nextActive(state.dealerIdx);
  setTimeout(advanceAction, 800);
}

function formatCard(c) {
  const r = c[0] === 'T' ? '10' : c[0];
  const glyph = { c: '♣', d: '♦', h: '♥', s: '♠' }[c[1]];
  return r + glyph;
}

/* ============================================================
 * Showdown & pot distribution (with side pots)
 * ============================================================ */
function awardUncontested(winnerIdx) {
  const p = state.players[winnerIdx];
  p.stack += state.pot;
  p.lastWinner = true;
  log(p.name + ' gana ' + state.pot + ' fichas (sin oposición)', 'win');
  state.pot = 0;
  state.players.forEach(pl => pl.totalContrib = 0);
  updateUI();
  setTimeout(() => {
    state.players.forEach(pl => pl.lastWinner = false);
    newHand();
  }, 2800);
}

function showdown() {
  state.street = 'showdown';
  state.players.forEach(p => { if (!p.folded && !p.eliminated) p.revealed = true; });
  renderHoleCards();
  log('— Showdown —', 'street');

  distributePots();

  setTimeout(() => {
    state.players.forEach(pl => pl.lastWinner = false);
    newHand();
  }, 4500);
}

function distributePots() {
  const all = state.players;
  const contributions = all
    .map(p => p.totalContrib)
    .filter(c => c > 0);
  const levels = [...new Set(contributions)].sort((a, b) => a - b);

  let prev = 0;
  for (const level of levels) {
    const slice = level - prev;
    let potAmt = 0;
    const eligible = [];
    all.forEach((p, i) => {
      if (p.totalContrib >= level) {
        potAmt += slice;
        if (!p.folded) eligible.push(i);
      } else if (p.totalContrib > prev) {
        potAmt += p.totalContrib - prev;
      }
    });

    if (potAmt > 0 && eligible.length > 0) {
      const hands = eligible.map(i => ({
        idx: i,
        hand: Hand.solve([...all[i].holeCards, ...state.board])
      }));
      const wins = Hand.winners(hands.map(h => h.hand));
      const winnerIdxs = hands.filter(h => wins.includes(h.hand)).map(h => h.idx);
      const share = Math.floor(potAmt / winnerIdxs.length);
      let remainder = potAmt - share * winnerIdxs.length;
      winnerIdxs.forEach(idx => {
        const win = share + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder--;
        all[idx].stack += win;
        all[idx].lastWinner = true;
        const handObj = hands.find(h => h.idx === idx).hand;
        log(all[idx].name + ' gana ' + win + ' con ' + handObj.descr, 'win');
      });
    }
    prev = level;
  }
  state.pot = 0;
  state.players.forEach(p => p.totalContrib = 0);
  updateUI();
}

/* ============================================================
 * Action application
 * ============================================================ */
function applyAction(idx, action, raiseTotalTo) {
  const p = state.players[idx];
  const toCall = state.currentBet - p.betThisRound;

  if (action === 'fold') {
    p.folded = true;
    p.hasActed = true;
    log(p.name + ': se retira');
  } else if (action === 'check') {
    if (toCall > 0) {
      action = 'call';
    } else {
      p.hasActed = true;
      log(p.name + ': pasa');
    }
  }
  if (action === 'call') {
    const amt = Math.min(toCall, p.stack);
    postBet(idx, amt);
    p.hasActed = true;
    if (amt === 0) log(p.name + ': pasa');
    else if (p.allIn) log(p.name + ': all-in con ' + amt);
    else log(p.name + ': iguala ' + amt);
  } else if (action === 'raise') {
    const maxTotal = p.stack + p.betThisRound;
    const target = Math.min(raiseTotalTo, maxTotal);
    const add = target - p.betThisRound;
    const raiseSize = target - state.currentBet;
    postBet(idx, add);
    p.hasActed = true;
    if (target <= state.currentBet) {
      log(p.name + ': all-in con ' + add);
    } else {
      // Under-min all-in raise does not re-open action
      const fullRaise = raiseSize >= state.minRaise;
      if (fullRaise) {
        state.minRaise = raiseSize;
        state.players.forEach((other, i) => {
          if (i !== idx && !other.folded && !other.allIn && !other.eliminated) {
            other.hasActed = false;
          }
        });
      }
      state.currentBet = target;
      if (p.allIn) log(p.name + ': all-in a ' + target);
      else log(p.name + ': sube a ' + target);
    }
  }

  updateUI();
  state.actorIdx = nextActive(idx);
  setTimeout(advanceAction, 500);
}

/* ============================================================
 * Human action panel
 * ============================================================ */
function showActionPanel() {
  state.waitingForHuman = true;
  const panel = document.getElementById('action-panel');
  panel.classList.remove('hidden');
  const p = state.players[0];
  const toCall = state.currentBet - p.betThisRound;

  const checkBtn = document.getElementById('check-btn');
  const callBtn = document.getElementById('call-btn');
  const raiseBtn = document.getElementById('raise-btn');
  const raiseGroup = document.getElementById('raise-group');
  const raiseInput = document.getElementById('raise-amount');
  const raiseRange = document.getElementById('raise-range');

  if (toCall <= 0) {
    checkBtn.style.display = '';
    callBtn.style.display = 'none';
  } else {
    checkBtn.style.display = 'none';
    callBtn.style.display = '';
    const actual = Math.min(toCall, p.stack);
    callBtn.textContent = (actual === p.stack && actual < toCall)
      ? 'Igualar all-in (' + actual + ')'
      : 'Igualar ' + actual;
  }

  const maxTotal = p.stack + p.betThisRound;
  const minTotal = Math.min(maxTotal, state.currentBet + state.minRaise);
  if (maxTotal <= state.currentBet) {
    raiseGroup.style.display = 'none';
  } else {
    raiseGroup.style.display = '';
    raiseRange.min = minTotal;
    raiseRange.max = maxTotal;
    raiseRange.value = minTotal;
    raiseInput.min = minTotal;
    raiseInput.max = maxTotal;
    raiseInput.value = minTotal;
    raiseBtn.textContent = (maxTotal === minTotal) ? 'All-in (' + maxTotal + ')' : 'Subir';
  }
}

function hideActionPanel() {
  document.getElementById('action-panel').classList.add('hidden');
  state.waitingForHuman = false;
}

function humanAction(action, raiseTotalTo) {
  if (!state.waitingForHuman) return;
  hideActionPanel();
  applyAction(0, action, raiseTotalTo);
}

/* ============================================================
 * AI player
 * ============================================================ */
function preflopStrength(cards) {
  const r1 = RANKS.indexOf(cards[0][0]);
  const r2 = RANKS.indexOf(cards[1][0]);
  const high = Math.max(r1, r2);
  const low = Math.min(r1, r2);
  const pair = r1 === r2;
  const suited = cards[0][1] === cards[1][1];
  const gap = high - low;

  if (pair) {
    if (high >= 10) return 0.93;
    if (high >= 6) return 0.72;
    return 0.55;
  }
  let score = 0.15 + (high + low) / 36;
  if (suited) score += 0.10;
  if (high === 12) score += 0.08;
  if (gap === 1) score += 0.06;
  if (gap === 2) score += 0.03;
  if (gap >= 5) score -= 0.12;
  if (high <= 6) score -= 0.10;
  return Math.max(0.05, Math.min(0.92, score));
}

const HAND_BUCKET = {
  'Royal Flush': 1.0,
  'Straight Flush': 0.98,
  'Four of a Kind': 0.95,
  'Full House': 0.88,
  'Flush': 0.78,
  'Straight': 0.68,
  'Three of a Kind': 0.58,
  'Two Pair': 0.45,
  'Pair': 0.30,
  'High Card': 0.14,
};

function handStrength(player) {
  if (state.board.length === 0) return preflopStrength(player.holeCards);
  const h = Hand.solve([...player.holeCards, ...state.board]);
  return HAND_BUCKET[h.name] !== undefined ? HAND_BUCKET[h.name] : 0.15;
}

function aiAct(idx) {
  if (state.gameOver) return;
  const p = state.players[idx];
  if (!p || p.folded || p.allIn || p.eliminated) {
    state.actorIdx = nextActive(idx);
    return advanceAction();
  }
  const toCall = state.currentBet - p.betThisRound;
  const strength = handStrength(p);
  const potOdds = state.pot > 0 ? toCall / (state.pot + toCall) : 0;
  const bluffRoll = Math.random();

  if (toCall === 0) {
    if (strength > 0.55 && Math.random() < 0.65) {
      const baseRaise = state.bigBlind * (2 + Math.floor(Math.random() * 3));
      const potBet = Math.floor(state.pot * (0.4 + Math.random() * 0.5));
      const raiseTo = Math.max(state.bigBlind, baseRaise, potBet);
      return applyAction(idx, 'raise', raiseTo);
    }
    if (strength < 0.25 && bluffRoll < 0.10) {
      const raiseTo = Math.max(state.bigBlind * 2, Math.floor(state.pot * 0.5));
      return applyAction(idx, 'raise', raiseTo);
    }
    return applyAction(idx, 'check');
  }

  if (strength > 0.78 && Math.random() < 0.55 && p.stack > toCall) {
    const target = state.currentBet + Math.max(state.minRaise, Math.floor(state.pot * 0.7));
    return applyAction(idx, 'raise', target);
  }
  if (strength < potOdds - 0.05 && bluffRoll > 0.15) {
    return applyAction(idx, 'fold');
  }
  if (toCall >= p.stack && strength < 0.5 && bluffRoll > 0.25) {
    return applyAction(idx, 'fold');
  }
  if (strength > 0.35 || toCall <= state.bigBlind * 2) {
    return applyAction(idx, 'call');
  }
  if (bluffRoll < 0.30) return applyAction(idx, 'call');
  return applyAction(idx, 'fold');
}

/* ============================================================
 * Init / wiring
 * ============================================================ */
window.addEventListener('DOMContentLoaded', () => {
  const oppRange = document.getElementById('opp-count');
  const oppVal = document.getElementById('opp-count-val');
  oppRange.addEventListener('input', () => oppVal.textContent = oppRange.value);

  document.getElementById('start-btn').addEventListener('click', () => {
    if (typeof Hand === 'undefined') {
      alert('No se ha podido cargar pokersolver.js. Asegúrate de que el fichero está en la misma carpeta que index.html.');
      return;
    }
    const opp = parseInt(oppRange.value);
    const stack = parseInt(document.getElementById('start-stack').value);
    const [sb, bb] = document.getElementById('blinds').value.split(',').map(Number);
    startGame(opp, stack, sb, bb);
  });

  document.getElementById('fold-btn').addEventListener('click', () => humanAction('fold'));
  document.getElementById('check-btn').addEventListener('click', () => humanAction('check'));
  document.getElementById('call-btn').addEventListener('click', () => humanAction('call'));
  document.getElementById('raise-btn').addEventListener('click', () => {
    const amt = parseInt(document.getElementById('raise-amount').value);
    humanAction('raise', amt);
  });

  const inp = document.getElementById('raise-amount');
  const rng = document.getElementById('raise-range');
  rng.addEventListener('input', () => inp.value = rng.value);
  inp.addEventListener('input', () => {
    let v = parseInt(inp.value);
    if (!isFinite(v)) return;
    if (v < parseInt(rng.min)) v = parseInt(rng.min);
    if (v > parseInt(rng.max)) v = parseInt(rng.max);
    rng.value = v;
  });

  document.getElementById('banner-btn').addEventListener('click', () => {
    document.getElementById('banner').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('active');
    document.getElementById('setup-screen').classList.add('active');
  });
});
