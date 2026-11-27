// Pure Klondike Solitaire Game Engine (1-card / 3-card draw, undo, hint, auto-complete)
export const SUITS = Object.freeze(["spades", "hearts", "clubs", "diamonds"]);
export const SUIT_SYMBOLS = Object.freeze({ spades: "♠", hearts: "♥", clubs: "♣", diamonds: "♦" });
export const RANK_LABELS = Object.freeze(["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]);

export function isRedSuit(suit) {
  return suit === "hearts" || suit === "diamonds";
}

// 버린 카드 더미에서 펼쳐 보일 장수: 1장 뽑기는 1장, 3장 뽑기는 3장.
export function wasteFanCount(drawCount) {
  return drawCount === 3 ? 3 : 1;
}

export function createDeck(seed = null) {
  const deck = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ id: `${suit}-${rank}`, suit, rank, faceUp: false });
    }
  }
  let s = typeof seed === "number" ? seed : ((Date.now() ^ 0x5f3759df) >>> 0);
  const rand = () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function createSolitaireGame({ drawCount = 1, seed = null } = {}) {
  const deck = createDeck(seed);
  const tableau = Array.from({ length: 7 }, () => []);
  let cursor = 0;
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row <= col; row++) {
      const card = { ...deck[cursor++] };
      card.faceUp = row === col;
      tableau[col].push(card);
    }
  }
  const stock = deck.slice(cursor).map((c) => ({ ...c, faceUp: false }));
  return {
    drawCount: drawCount === 3 ? 3 : 1,
    stock,
    waste: [],
    foundations: [[], [], [], []],
    tableau,
    moves: 0,
    score: 0,
    history: [],
  };
}

function snapshot(game) {
  return {
    stock: game.stock.map((c) => ({ ...c })),
    waste: game.waste.map((c) => ({ ...c })),
    foundations: game.foundations.map((p) => p.map((c) => ({ ...c }))),
    tableau: game.tableau.map((p) => p.map((c) => ({ ...c }))),
    moves: game.moves,
    score: game.score,
  };
}

export function undoSolitaire(game) {
  if (!game.history.length) return false;
  const prev = game.history.pop();
  game.stock = prev.stock;
  game.waste = prev.waste;
  game.foundations = prev.foundations;
  game.tableau = prev.tableau;
  game.moves = prev.moves;
  game.score = prev.score;
  return true;
}

export function canMoveToFoundation(card, foundationPile) {
  if (!card) return false;
  if (!foundationPile.length) return card.rank === 1;
  const top = foundationPile[foundationPile.length - 1];
  return top.suit === card.suit && card.rank === top.rank + 1;
}

export function canMoveToTableau(card, tableauPile) {
  if (!card) return false;
  if (!tableauPile.length) return card.rank === 13;
  const top = tableauPile[tableauPile.length - 1];
  if (!top.faceUp) return false;
  return isRedSuit(card.suit) !== isRedSuit(top.suit) && card.rank === top.rank - 1;
}

export function drawFromStock(game) {
  game.history.push(snapshot(game));
  if (game.stock.length > 0) {
    const count = Math.min(game.drawCount, game.stock.length);
    for (let i = 0; i < count; i++) {
      const card = { ...game.stock.pop(), faceUp: true };
      game.waste.push(card);
    }
    game.moves++;
    return true;
  }
  if (game.waste.length > 0) {
    while (game.waste.length) {
      const card = { ...game.waste.pop(), faceUp: false };
      game.stock.push(card);
    }
    game.score = Math.max(0, game.score - 20);
    game.moves++;
    return true;
  }
  game.history.pop();
  return false;
}

export function moveCards(game, source, target) {
  let moving = [];
  if (source.kind === "waste") {
    if (!game.waste.length) return false;
    moving = [game.waste[game.waste.length - 1]];
  } else if (source.kind === "tableau") {
    const pile = game.tableau[source.index];
    if (!pile || source.cardIndex < 0 || source.cardIndex >= pile.length) return false;
    if (!pile[source.cardIndex].faceUp) return false;
    moving = pile.slice(source.cardIndex);
  } else if (source.kind === "foundation") {
    const pile = game.foundations[source.index];
    if (!pile?.length) return false;
    moving = [pile[pile.length - 1]];
  } else {
    return false;
  }

  const lead = moving[0];
  if (target.kind === "foundation") {
    if (moving.length !== 1) return false;
    const fPile = game.foundations[target.index];
    if (!fPile || !canMoveToFoundation(lead, fPile)) return false;
  } else if (target.kind === "tableau") {
    const tPile = game.tableau[target.index];
    if (!tPile || !canMoveToTableau(lead, tPile)) return false;
  } else {
    return false;
  }

  game.history.push(snapshot(game));

  if (source.kind === "waste") game.waste.pop();
  else if (source.kind === "tableau") {
    const pile = game.tableau[source.index];
    pile.splice(source.cardIndex);
    if (pile.length && !pile[pile.length - 1].faceUp) {
      pile[pile.length - 1].faceUp = true;
      game.score += 5;
    }
  } else if (source.kind === "foundation") {
    game.foundations[source.index].pop();
  }

  if (target.kind === "foundation") {
    game.foundations[target.index].push(lead);
    game.score += 15;
  } else {
    for (const c of moving) game.tableau[target.index].push(c);
    if (source.kind !== "tableau") game.score += 5;
  }
  game.moves++;
  return true;
}

export function autoMoveToFoundation(game, source) {
  for (let fi = 0; fi < 4; fi++) {
    if (moveCards(game, source, { kind: "foundation", index: fi })) return true;
  }
  return false;
}

export function isSolitaireWon(game) {
  return game.foundations.every((p) => p.length === 13);
}

export function canAutoComplete(game) {
  if (isSolitaireWon(game)) return false;
  if (game.stock.length > 0 || game.waste.length > 0) return false;
  return game.tableau.every((pile) => pile.every((c) => c.faceUp));
}

export function stepAutoComplete(game) {
  for (let ti = 0; ti < 7; ti++) {
    const pile = game.tableau[ti];
    if (!pile.length) continue;
    if (autoMoveToFoundation(game, { kind: "tableau", index: ti, cardIndex: pile.length - 1 })) {
      return true;
    }
  }
  return false;
}

export function findSolitaireHint(game) {
  if (game.waste.length) {
    const w = game.waste[game.waste.length - 1];
    for (let fi = 0; fi < 4; fi++) {
      if (canMoveToFoundation(w, game.foundations[fi])) {
        return { source: { kind: "waste" }, target: { kind: "foundation", index: fi } };
      }
    }
  }
  for (let ti = 0; ti < 7; ti++) {
    const pile = game.tableau[ti];
    if (!pile.length) continue;
    const top = pile[pile.length - 1];
    for (let fi = 0; fi < 4; fi++) {
      if (canMoveToFoundation(top, game.foundations[fi])) {
        return { source: { kind: "tableau", index: ti, cardIndex: pile.length - 1 }, target: { kind: "foundation", index: fi } };
      }
    }
  }
  for (let ti = 0; ti < 7; ti++) {
    const pile = game.tableau[ti];
    const firstFaceUp = pile.findIndex((c) => c.faceUp);
    if (firstFaceUp < 0) continue;
    const card = pile[firstFaceUp];
    for (let dest = 0; dest < 7; dest++) {
      if (dest === ti) continue;
      // Avoid shuffling a King from an already empty base column to another empty column.
      if (firstFaceUp === 0 && game.tableau[dest].length === 0) continue;
      if (canMoveToTableau(card, game.tableau[dest])) {
        return { source: { kind: "tableau", index: ti, cardIndex: firstFaceUp }, target: { kind: "tableau", index: dest } };
      }
    }
  }
  if (game.waste.length) {
    const w = game.waste[game.waste.length - 1];
    for (let dest = 0; dest < 7; dest++) {
      if (canMoveToTableau(w, game.tableau[dest])) {
        return { source: { kind: "waste" }, target: { kind: "tableau", index: dest } };
      }
    }
  }
  if (game.stock.length || game.waste.length) return { action: "draw" };
  return null;
}
