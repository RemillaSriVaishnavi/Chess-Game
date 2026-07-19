/* Chess Game - Full rules implementation */

const PIECES = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟',
};

const PIECE_NAMES = { K: 'King', Q: 'Queen', R: 'Rook', B: 'Bishop', N: 'Knight', P: 'Pawn' };
const FILES = 'abcdefgh';
const PIECE_VALUES = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000 };
const AI_DEPTH = 3;

class ChessGame {
  constructor() {
    this.board = [];
    this.turn = 'w';
    this.selected = null;
    this.validMoves = [];
    this.moveHistory = [];
    this.capturedByWhite = [];
    this.capturedByBlack = [];
    this.flipped = false;
    this.gameOver = false;
    this.halfMoveClock = 0;
    this.enPassantTarget = null;
    this.castlingRights = { wK: true, wQ: true, bK: true, bQ: true };
    this.pendingPromotion = null;
    this.playerColor = null;
    this.computerColor = null;
    this.gameStarted = false;
    this.computerThinking = false;

    this.boardEl = document.getElementById('chess-board');
    this.turnText = document.getElementById('turn-text');
    this.turnIndicator = document.getElementById('turn-indicator');
    this.gameStatus = document.getElementById('game-status');
    this.playerInfo = document.getElementById('player-info');
    this.thinkingIndicator = document.getElementById('thinking-indicator');
    this.moveHistoryEl = document.getElementById('move-history');
    this.capturedWhiteEl = document.getElementById('captured-by-white');
    this.capturedBlackEl = document.getElementById('captured-by-black');
    this.promotionModal = new bootstrap.Modal(document.getElementById('promotionModal'));
    this.gameOverModal = new bootstrap.Modal(document.getElementById('gameOverModal'));
    this.colorModal = new bootstrap.Modal(document.getElementById('colorModal'));

    this.bindEvents();
    this.resetBoardState();
    this.render();
    this.showColorSelection();
  }

  bindEvents() {
    document.getElementById('btn-new-game').addEventListener('click', () => this.showColorSelection());
    document.getElementById('btn-undo').addEventListener('click', () => this.undoMove());
    document.getElementById('btn-flip').addEventListener('click', () => this.flipBoard());
    document.getElementById('btn-play-again').addEventListener('click', () => this.showColorSelection());
    document.getElementById('choose-white').addEventListener('click', () => this.startGame('w'));
    document.getElementById('choose-black').addEventListener('click', () => this.startGame('b'));
  }

  showColorSelection() {
    this.gameOverModal.hide();
    this.promotionModal.hide();
    this.gameStarted = false;
    this.playerColor = null;
    this.computerColor = null;
    this.computerThinking = false;
    this.resetBoardState();
    this.render();
    this.updateUI();
    this.colorModal.show();
  }

  startGame(color) {
    this.colorModal.hide();
    this.playerColor = color;
    this.computerColor = color === 'w' ? 'b' : 'w';
    this.gameStarted = true;
    this.resetBoardState();

    if (color === 'b') {
      this.flipped = true;
      this.boardEl.classList.add('flipped');
    } else {
      this.flipped = false;
      this.boardEl.classList.remove('flipped');
    }

    this.render();
    this.updateUI();

    if (this.turn === this.computerColor) {
      this.scheduleComputerMove();
    }
  }

  resetBoardState() {
    this.board = this.createInitialBoard();
    this.turn = 'w';
    this.selected = null;
    this.validMoves = [];
    this.moveHistory = [];
    this.capturedByWhite = [];
    this.capturedByBlack = [];
    this.gameOver = false;
    this.halfMoveClock = 0;
    this.enPassantTarget = null;
    this.castlingRights = { wK: true, wQ: true, bK: true, bQ: true };
    this.pendingPromotion = null;
    this.lastMove = null;
    this.computerThinking = false;
  }

  isPlayerTurn() {
    return this.gameStarted && this.turn === this.playerColor && !this.computerThinking;
  }

  isComputerTurn() {
    return this.gameStarted && this.turn === this.computerColor && !this.gameOver;
  }

  createInitialBoard() {
    const empty = Array(8).fill(null);
    return [
      ['bR', 'bN', 'bB', 'bQ', 'bK', 'bB', 'bN', 'bR'],
      Array(8).fill('bP'),
      [...empty],
      [...empty],
      [...empty],
      [...empty],
      Array(8).fill('wP'),
      ['wR', 'wN', 'wB', 'wQ', 'wK', 'wB', 'wN', 'wR'],
    ];
  }

  flipBoard() {
    this.flipped = !this.flipped;
    this.boardEl.classList.toggle('flipped', this.flipped);
  }

  getSquareColor(row, col) {
    return (row + col) % 2 === 0 ? 'light' : 'dark';
  }

  render() {
    this.boardEl.innerHTML = '';
    this.boardEl.classList.toggle('computer-turn', this.computerThinking || this.isComputerTurn());

    const rows = this.flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
    const cols = this.flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

    for (const row of rows) {
      for (const col of cols) {
        const square = document.createElement('div');
        square.className = `square ${this.getSquareColor(row, col)}`;
        square.dataset.row = row;
        square.dataset.col = col;

        if (this.selected && this.selected.row === row && this.selected.col === col) {
          square.classList.add('selected');
        }

        if (this.lastMove) {
          const { from, to } = this.lastMove;
          if ((from.row === row && from.col === col) || (to.row === row && to.col === col)) {
            square.classList.add('last-move');
          }
        }

        const kingPos = this.findKing(this.turn);
        if (kingPos && kingPos.row === row && kingPos.col === col && this.isInCheck(this.turn)) {
          square.classList.add('in-check');
        }

        const move = this.validMoves.find(m => m.row === row && m.col === col);
        if (move) {
          square.classList.add(move.capture ? 'valid-capture' : 'valid-move');
        }

        const piece = this.board[row][col];
        if (piece) {
          const pieceEl = document.createElement('span');
          pieceEl.className = `piece ${piece[0] === 'w' ? 'white' : 'black'}`;
          pieceEl.textContent = PIECES[piece];
          square.appendChild(pieceEl);
        }

        square.addEventListener('click', () => this.handleClick(row, col));
        this.boardEl.appendChild(square);
      }
    }
  }

  handleClick(row, col) {
    if (!this.gameStarted || this.gameOver || this.pendingPromotion || this.computerThinking) return;
    if (this.turn !== this.playerColor) return;

    const piece = this.board[row][col];
    const isOwnPiece = piece && piece[0] === this.playerColor;

    const validMove = this.validMoves.find(m => m.row === row && m.col === col);
    if (validMove && this.selected) {
      this.makeMove(this.selected, { row, col }, validMove);
      return;
    }

    if (isOwnPiece) {
      this.selected = { row, col };
      this.validMoves = this.getLegalMoves(row, col);
      this.render();
    } else {
      this.selected = null;
      this.validMoves = [];
      this.render();
    }
  }

  getLegalMoves(row, col) {
    const piece = this.board[row][col];
    if (!piece) return [];

    const pseudoMoves = this.getPseudoLegalMoves(row, col, piece);
    return pseudoMoves.filter(move => {
      const snapshot = this.simulateMove({ row, col }, move);
      const legal = !this.isInCheck(this.turn, snapshot.board);
      return legal;
    });
  }

  getPseudoLegalMoves(row, col, piece) {
    const type = piece[1];
    const color = piece[0];
    const moves = [];

    switch (type) {
      case 'P': moves.push(...this.getPawnMoves(row, col, color)); break;
      case 'N': moves.push(...this.getKnightMoves(row, col, color)); break;
      case 'B': moves.push(...this.getSlidingMoves(row, col, color, [[1,1],[1,-1],[-1,1],[-1,-1]])); break;
      case 'R': moves.push(...this.getSlidingMoves(row, col, color, [[1,0],[-1,0],[0,1],[0,-1]])); break;
      case 'Q': moves.push(...this.getSlidingMoves(row, col, color, [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]])); break;
      case 'K': moves.push(...this.getKingMoves(row, col, color)); break;
    }

    return moves;
  }

  getPawnMoves(row, col, color) {
    const moves = [];
    const dir = color === 'w' ? -1 : 1;
    const startRow = color === 'w' ? 6 : 1;
    const promoRow = color === 'w' ? 0 : 7;

    const forward = row + dir;
    if (this.inBounds(forward, col) && !this.board[forward][col]) {
      moves.push({ row: forward, col, capture: false });
      if (row === startRow && !this.board[forward + dir][col]) {
        moves.push({ row: forward + dir, col, capture: false });
      }
    }

    for (const dc of [-1, 1]) {
      const nr = row + dir;
      const nc = col + dc;
      if (!this.inBounds(nr, nc)) continue;

      const target = this.board[nr][nc];
      if (target && target[0] !== color) {
        moves.push({ row: nr, col: nc, capture: true });
      }

      if (this.enPassantTarget && this.enPassantTarget.row === nr && this.enPassantTarget.col === nc) {
        moves.push({ row: nr, col: nc, capture: true, enPassant: true });
      }
    }

    return moves;
  }

  getKnightMoves(row, col, color) {
    const moves = [];
    const offsets = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];

    for (const [dr, dc] of offsets) {
      const nr = row + dr;
      const nc = col + dc;
      if (!this.inBounds(nr, nc)) continue;
      const target = this.board[nr][nc];
      if (!target || target[0] !== color) {
        moves.push({ row: nr, col: nc, capture: !!target });
      }
    }
    return moves;
  }

  getSlidingMoves(row, col, color, directions) {
    const moves = [];

    for (const [dr, dc] of directions) {
      let nr = row + dr;
      let nc = col + dc;

      while (this.inBounds(nr, nc)) {
        const target = this.board[nr][nc];
        if (!target) {
          moves.push({ row: nr, col: nc, capture: false });
        } else {
          if (target[0] !== color) {
            moves.push({ row: nr, col: nc, capture: true });
          }
          break;
        }
        nr += dr;
        nc += dc;
      }
    }
    return moves;
  }

  getKingMoves(row, col, color) {
    const moves = [];
    const offsets = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

    for (const [dr, dc] of offsets) {
      const nr = row + dr;
      const nc = col + dc;
      if (!this.inBounds(nr, nc)) continue;
      const target = this.board[nr][nc];
      if (!target || target[0] !== color) {
        moves.push({ row: nr, col: nc, capture: !!target });
      }
    }

    if (!this.isInCheck(color)) {
      if (color === 'w' && row === 7 && col === 4) {
        if (this.castlingRights.wK && !this.board[7][5] && !this.board[7][6] &&
            this.board[7][7] === 'wR' && !this.isSquareAttacked(7, 5, 'b') && !this.isSquareAttacked(7, 6, 'b')) {
          moves.push({ row: 7, col: 6, capture: false, castle: 'wK' });
        }
        if (this.castlingRights.wQ && !this.board[7][1] && !this.board[7][2] && !this.board[7][3] &&
            this.board[7][0] === 'wR' && !this.isSquareAttacked(7, 2, 'b') && !this.isSquareAttacked(7, 3, 'b')) {
          moves.push({ row: 7, col: 2, capture: false, castle: 'wQ' });
        }
      }
      if (color === 'b' && row === 0 && col === 4) {
        if (this.castlingRights.bK && !this.board[0][5] && !this.board[0][6] &&
            this.board[0][7] === 'bR' && !this.isSquareAttacked(0, 5, 'w') && !this.isSquareAttacked(0, 6, 'w')) {
          moves.push({ row: 0, col: 6, capture: false, castle: 'bK' });
        }
        if (this.castlingRights.bQ && !this.board[0][1] && !this.board[0][2] && !this.board[0][3] &&
            this.board[0][0] === 'bR' && !this.isSquareAttacked(0, 2, 'w') && !this.isSquareAttacked(0, 3, 'w')) {
          moves.push({ row: 0, col: 2, capture: false, castle: 'bQ' });
        }
      }
    }

    return moves;
  }

  makeMove(from, to, moveInfo) {
    const piece = this.board[from.row][from.col];
    const captured = this.board[to.row][to.col];
    const color = piece[0];

    const state = {
      board: this.cloneBoard(),
      turn: this.turn,
      castlingRights: { ...this.castlingRights },
      enPassantTarget: this.enPassantTarget,
      halfMoveClock: this.halfMoveClock,
      capturedByWhite: [...this.capturedByWhite],
      capturedByBlack: [...this.capturedByBlack],
      from,
      to,
      piece,
      captured,
      moveInfo,
      castle: moveInfo.castle || null,
      promotion: null,
    };

    let capturedPiece = captured;

    if (moveInfo.enPassant) {
      const capRow = color === 'w' ? to.row + 1 : to.row - 1;
      capturedPiece = this.board[capRow][to.col];
      this.board[capRow][to.col] = null;
    }
/*
    this.board[to.row][to.col] = piece;
    this.board[from.row][from.col] = null;

    if (moveInfo.castle) {
      if (moveInfo.castle === 'wK') { this.board[7][5] = 'wR'; this.board[7][7] = null; }
      if (moveInfo.castle === 'wQ') { this.board[7][3] = 'wR'; this.board[7][0] = null; }
      if (moveInfo.castle === 'bK') { this.board[0][5] = 'bR'; this.board[0][7] = null; }
      if (moveInfo.castle === 'bQ') { this.board[0][3] = 'bR'; this.board[0][0] = null; }
    }

    this.updateCastlingRights(from, to, piece);
    this.updateEnPassantTarget(from, to, piece);
*/
    if (capturedPiece) {
      if (color === 'w') this.capturedByWhite.push(capturedPiece);
      else this.capturedByBlack.push(capturedPiece);
    }

    if (piece[1] === 'P' || capturedPiece) this.halfMoveClock = 0;
    else this.halfMoveClock++;

    const promoRow = color === 'w' ? 0 : 7;
    if (piece[1] === 'P' && to.row === promoRow) {
      if (color === this.computerColor) {
        this.applyMoveToBoard(from, to, moveInfo, color + 'Q');
        this.finishMove(state, color + 'Q');
        return;
      }
      this.pendingPromotion = { from, to, state, color };
      this.showPromotionModal(color);
      return;
    }

    this.applyMoveToBoard(from, to, moveInfo);
    this.finishMove(state);
  }

  applyMoveToBoard(from, to, moveInfo, promotionPiece = null) {
    const piece = this.board[from.row][from.col];
    const color = piece[0];

    if (moveInfo.enPassant) {
      const capRow = color === 'w' ? to.row + 1 : to.row - 1;
      this.board[capRow][to.col] = null;
    }

    this.board[to.row][to.col] = promotionPiece || piece;
    this.board[from.row][from.col] = null;

    if (moveInfo.castle) {
      if (moveInfo.castle === 'wK') { this.board[7][5] = 'wR'; this.board[7][7] = null; }
      if (moveInfo.castle === 'wQ') { this.board[7][3] = 'wR'; this.board[7][0] = null; }
      if (moveInfo.castle === 'bK') { this.board[0][5] = 'bR'; this.board[0][7] = null; }
      if (moveInfo.castle === 'bQ') { this.board[0][3] = 'bR'; this.board[0][0] = null; }
    }

    this.updateCastlingRights(from, to, piece);
    this.updateEnPassantTarget(from, to, piece);
  }

  finishMove(state, promotionPiece = null) {
    if (promotionPiece) {
      state.promotion = promotionPiece;
    }

    const notation = this.toNotation(state);
    this.moveHistory.push({ state, notation, byComputer: state.piece[0] === this.computerColor });
    this.lastMove = { from: state.from, to: state.to };
    this.turn = this.turn === 'w' ? 'b' : 'w';
    this.selected = null;
    this.validMoves = [];
    this.pendingPromotion = null;

    this.render();
    this.updateUI();
    this.checkGameEnd();

    if (!this.gameOver && this.isComputerTurn()) {
      this.scheduleComputerMove();
    }
  }

  scheduleComputerMove() {
    this.computerThinking = true;
    this.render();
    this.updateUI();

    setTimeout(() => {
      if (!this.gameOver && this.isComputerTurn()) {
        this.makeComputerMove();
      }
      this.computerThinking = false;
      this.render();
      this.updateUI();
    }, 400);
  }

  makeComputerMove() {
    const move = this.findBestMove();
    if (!move) return;

    const { from, to, moveInfo } = move;
    const piece = this.board[from.row][from.col];
    const captured = this.board[to.row][to.col];
    const color = piece[0];

    const state = {
      board: this.cloneBoard(),
      turn: this.turn,
      castlingRights: { ...this.castlingRights },
      enPassantTarget: this.enPassantTarget,
      halfMoveClock: this.halfMoveClock,
      capturedByWhite: [...this.capturedByWhite],
      capturedByBlack: [...this.capturedByBlack],
      from,
      to,
      piece,
      captured,
      moveInfo,
      castle: moveInfo.castle || null,
      promotion: null,
    };

    let capturedPiece = captured;
    if (moveInfo.enPassant) {
      const capRow = color === 'w' ? to.row + 1 : to.row - 1;
      capturedPiece = this.board[capRow][to.col];
    }

    if (capturedPiece) {
      if (color === 'w') this.capturedByWhite.push(capturedPiece);
      else this.capturedByBlack.push(capturedPiece);
    }

    if (piece[1] === 'P' || capturedPiece) this.halfMoveClock = 0;
    else this.halfMoveClock++;

    const promoRow = color === 'w' ? 0 : 7;
    const promotion = piece[1] === 'P' && to.row === promoRow ? color + 'Q' : null;

    this.applyMoveToBoard(from, to, moveInfo, promotion);
    this.finishMove(state, promotion);
  }

  findBestMove() {
    const moves = this.getAllLegalMoves(this.computerColor);
    if (moves.length === 0) return null;

    let bestScore = -Infinity;
    let bestMoves = [];

    for (const move of moves) {
      const score = this.minimax(move, AI_DEPTH - 1, -Infinity, Infinity, false);
      if (score > bestScore) {
        bestScore = score;
        bestMoves = [move];
      } else if (score === bestScore) {
        bestMoves.push(move);
      }
    }

    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }

  getAllLegalMoves(color) {
    const moves = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (!piece || piece[0] !== color) continue;

        const savedTurn = this.turn;
        this.turn = color;
        const legal = this.getLegalMoves(r, c);
        this.turn = savedTurn;

        for (const m of legal) {
          moves.push({ from: { row: r, col: c }, to: { row: m.row, col: m.col }, moveInfo: m });
        }
      }
    }
    return moves;
  }

  minimax(move, depth, alpha, beta, isMaximizing) {
    const saved = this.saveState();
    this.applyMoveForSearch(move.from, move.to, move.moveInfo);
    this.turn = this.turn === 'w' ? 'b' : 'w';

    const currentColor = this.turn;
    const hasMoves = this.getAllLegalMoves(currentColor).length > 0;
    const inCheck = this.isInCheck(currentColor);

    let score;

    if (!hasMoves) {
      score = inCheck
        ? (currentColor === this.computerColor ? -90000 + (AI_DEPTH - depth) : 90000 - (AI_DEPTH - depth))
        : 0;
    } else if (depth === 0) {
      score = this.evaluateBoard(this.computerColor);
    } else {
      const moves = this.getAllLegalMoves(currentColor);
      if (isMaximizing) {
        score = -Infinity;
        for (const m of moves) {
          score = Math.max(score, this.minimax(m, depth - 1, alpha, beta, false));
          alpha = Math.max(alpha, score);
          if (beta <= alpha) break;
        }
      } else {
        score = Infinity;
        for (const m of moves) {
          score = Math.min(score, this.minimax(m, depth - 1, alpha, beta, true));
          beta = Math.min(beta, score);
          if (beta <= alpha) break;
        }
      }
    }

    this.restoreState(saved);
    return score;
  }

  applyMoveForSearch(from, to, moveInfo) {
    const piece = this.board[from.row][from.col];
    const color = piece[0];

    if (moveInfo.enPassant) {
      const capRow = color === 'w' ? to.row + 1 : to.row - 1;
      this.board[capRow][to.col] = null;
    }

    const promoRow = color === 'w' ? 0 : 7;
    const promoted = piece[1] === 'P' && to.row === promoRow ? color + 'Q' : piece;
    this.board[to.row][to.col] = promoted;
    this.board[from.row][from.col] = null;

    if (moveInfo.castle) {
      if (moveInfo.castle === 'wK') { this.board[7][5] = 'wR'; this.board[7][7] = null; }
      if (moveInfo.castle === 'wQ') { this.board[7][3] = 'wR'; this.board[7][0] = null; }
      if (moveInfo.castle === 'bK') { this.board[0][5] = 'bR'; this.board[0][7] = null; }
      if (moveInfo.castle === 'bQ') { this.board[0][3] = 'bR'; this.board[0][0] = null; }
    }

    this.updateCastlingRights(from, to, piece);
    this.updateEnPassantTarget(from, to, piece);
  }

  evaluateBoard(forColor) {
    const opponent = forColor === 'w' ? 'b' : 'w';
    let score = 0;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (!piece) continue;
        const val = PIECE_VALUES[piece[1]];
        const centerBonus = (piece[1] !== 'P' && piece[1] !== 'K')
          ? (3.5 - Math.abs(3.5 - c)) * 2 + (3.5 - Math.abs(3.5 - r)) * 2
          : 0;
        score += piece[0] === forColor ? val + centerBonus : -(val + centerBonus);
      }
    }

    if (this.isInCheck(opponent)) score += 30;
    if (this.isInCheck(forColor)) score -= 50;

    return score;
  }

  saveState() {
    return {
      board: this.cloneBoard(),
      turn: this.turn,
      castlingRights: { ...this.castlingRights },
      enPassantTarget: this.enPassantTarget ? { ...this.enPassantTarget } : null,
      halfMoveClock: this.halfMoveClock,
    };
  }

  restoreState(saved) {
    this.board = saved.board;
    this.turn = saved.turn;
    this.castlingRights = { ...saved.castlingRights };
    this.enPassantTarget = saved.enPassantTarget;
    this.halfMoveClock = saved.halfMoveClock;
  }

  showPromotionModal(color) {
    const container = document.getElementById('promotion-choices');
    container.innerHTML = '';
    const pieces = color === 'w' ? ['wQ', 'wR', 'wB', 'wN'] : ['bQ', 'bR', 'bB', 'bN'];

    for (const p of pieces) {
      const btn = document.createElement('button');
      btn.className = `promotion-btn ${color === 'w' ? 'white' : 'black'}`;
      btn.textContent = PIECES[p];
      btn.addEventListener('click', () => {
        this.promotionModal.hide();
        this.applyMoveToBoard(this.pendingPromotion.from, this.pendingPromotion.to, this.pendingPromotion.state.moveInfo, p);
        this.finishMove(this.pendingPromotion.state, p);
      });
      container.appendChild(btn);
    }

    this.promotionModal.show();
  }

  updateCastlingRights(from, to, piece) {
    if (piece === 'wK') { this.castlingRights.wK = false; this.castlingRights.wQ = false; }
    if (piece === 'bK') { this.castlingRights.bK = false; this.castlingRights.bQ = false; }
    if (from.row === 7 && from.col === 0) this.castlingRights.wQ = false;
    if (from.row === 7 && from.col === 7) this.castlingRights.wK = false;
    if (from.row === 0 && from.col === 0) this.castlingRights.bQ = false;
    if (from.row === 0 && from.col === 7) this.castlingRights.bK = false;
    if (to.row === 7 && to.col === 0) this.castlingRights.wQ = false;
    if (to.row === 7 && to.col === 7) this.castlingRights.wK = false;
    if (to.row === 0 && to.col === 0) this.castlingRights.bQ = false;
    if (to.row === 0 && to.col === 7) this.castlingRights.bK = false;
  }

  updateEnPassantTarget(from, to, piece) {
    this.enPassantTarget = null;
    if (piece[1] === 'P' && Math.abs(to.row - from.row) === 2) {
      this.enPassantTarget = { row: (from.row + to.row) / 2, col: from.col };
    }
  }

  undoMove() {
    if (!this.gameStarted || this.pendingPromotion || this.computerThinking) return;

    if (this.moveHistory.length === 0) return;

    const last = this.moveHistory[this.moveHistory.length - 1];
    const undoCount = last.byComputer ? 2 : 1;

    for (let i = 0; i < undoCount && this.moveHistory.length > 0; i++) {
      this.moveHistory.pop();
    }

    if (this.moveHistory.length === 0) {
      this.resetBoardState();
      this.turn = 'w';
    } else {
      const prev = this.moveHistory[this.moveHistory.length - 1];
      const { state } = prev;
      this.board = this.cloneBoard(state.board);
      this.turn = state.turn === 'w' ? 'b' : 'w';
      this.castlingRights = { ...state.castlingRights };
      this.enPassantTarget = state.enPassantTarget;
      this.halfMoveClock = state.halfMoveClock;
      this.capturedByWhite = [...state.capturedByWhite];
      this.capturedByBlack = [...state.capturedByBlack];

      const lastMove = this.moveHistory[this.moveHistory.length - 1];
      this.lastMove = { from: lastMove.state.from, to: lastMove.state.to };

      const applied = this.moveHistory[this.moveHistory.length - 1];
      this.replayMove(applied.state);
      //this.turn = this.playerColor;
      this.turn = state.turn;
    }

    this.gameOver = false;
    this.selected = null;
    this.validMoves = [];
    this.render();
    this.updateUI();
  }

  replayMove(state) {
    const { from, to, piece, moveInfo, promotion } = state;
    const color = piece[0];

    if (moveInfo.enPassant) {
      const capRow = color === 'w' ? to.row + 1 : to.row - 1;
      this.board[capRow][to.col] = null;
    }

    this.board[to.row][to.col] = promotion || piece;
    this.board[from.row][from.col] = null;

    if (moveInfo.castle) {
      if (moveInfo.castle === 'wK') { this.board[7][5] = 'wR'; this.board[7][7] = null; }
      if (moveInfo.castle === 'wQ') { this.board[7][3] = 'wR'; this.board[7][0] = null; }
      if (moveInfo.castle === 'bK') { this.board[0][5] = 'bR'; this.board[0][7] = null; }
      if (moveInfo.castle === 'bQ') { this.board[0][3] = 'bR'; this.board[0][0] = null; }
    }

    this.updateCastlingRights(from, to, piece);
    this.updateEnPassantTarget(from, to, piece);

    const captured = state.captured;
    let capturedPiece = captured;
    if (moveInfo.enPassant) {
      capturedPiece = state.captured;
    }
    if (capturedPiece) {
      if (color === 'w') this.capturedByWhite.push(capturedPiece);
      else this.capturedByBlack.push(capturedPiece);
    }

    if (piece[1] === 'P' || capturedPiece) this.halfMoveClock = 0;
    else this.halfMoveClock++;
  }

  toNotation(state) {
    const { from, to, piece, captured, moveInfo, promotion, castle } = state;
    const pieceType = piece[1];

    if (castle) {
      return castle.endsWith('K') ? 'O-O' : 'O-O-O';
    }

    let notation = '';
    if (pieceType !== 'P') {
      notation = pieceType;
    }

    if (captured || moveInfo.enPassant) {
      if (pieceType === 'P') notation += FILES[from.col];
      notation += 'x';
    }

    notation += FILES[to.col] + (8 - to.row);

    if (promotion) {
      notation += '=' + promotion[1];
    }

    return notation;
  }

  checkGameEnd() {
    const inCheck = this.isInCheck(this.turn);
    const hasLegalMove = this.hasAnyLegalMove(this.turn);

    if (!hasLegalMove) {
      this.gameOver = true;
      if (inCheck) {
        const winner = this.turn === 'w' ? 'Black' : 'White';
        this.showGameOver('Checkmate!', `${winner} wins by checkmate.`);
        this.gameStatus.textContent = `Checkmate — ${winner} wins!`;
      } else {
        this.showGameOver('Stalemate!', 'The game is a draw by stalemate.');
        this.gameStatus.textContent = 'Stalemate — Draw!';
      }
      return;
    }

    if (inCheck) {
      this.gameStatus.textContent = 'Check!';
    } else {
      this.gameStatus.textContent = '';
    }

    if (this.halfMoveClock >= 100) {
      this.gameOver = true;
      this.showGameOver('Draw', 'Fifty-move rule — the game is a draw.');
      this.gameStatus.textContent = 'Draw by fifty-move rule';
    }
  }

  showGameOver(title, message) {
    document.getElementById('gameOverTitle').textContent = title;
    document.getElementById('gameOverMessage').textContent = message;
    document.getElementById('gameOverIcon').innerHTML = title.includes('Checkmate')
      ? '<i class="bi bi-trophy-fill text-warning"></i>'
      : '<i class="bi bi-handshake-fill text-secondary"></i>';
    this.gameOverModal.show();
  }

  hasAnyLegalMove(color) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (piece && piece[0] === color) {
          if (this.getLegalMoves(r, c).length > 0) return true;
        }
      }
    }
    return false;
  }

  isInCheck(color, board = this.board) {
    const kingPos = this.findKing(color, board);
    if (!kingPos) return false;
    const opponent = color === 'w' ? 'b' : 'w';
    return this.isSquareAttacked(kingPos.row, kingPos.col, opponent, board);
  }

  isSquareAttacked(row, col, byColor, board = this.board) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (!piece || piece[0] !== byColor) continue;

        const moves = this.getAttackSquares(r, c, piece, board);
        if (moves.some(m => m.row === row && m.col === col)) return true;
      }
    }
    return false;
  }

  getAttackSquares(row, col, piece, board) {
    const type = piece[1];
    const color = piece[0];
    const squares = [];

    if (type === 'P') {
      const dir = color === 'w' ? -1 : 1;
      for (const dc of [-1, 1]) {
        const nr = row + dir;
        const nc = col + dc;
        if (this.inBounds(nr, nc)) squares.push({ row: nr, col: nc });
      }
      return squares;
    }

    if (type === 'N') {
      const offsets = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
      for (const [dr, dc] of offsets) {
        const nr = row + dr;
        const nc = col + dc;
        if (this.inBounds(nr, nc)) squares.push({ row: nr, col: nc });
      }
      return squares;
    }

    if (type === 'K') {
      const offsets = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
      for (const [dr, dc] of offsets) {
        const nr = row + dr;
        const nc = col + dc;
        if (this.inBounds(nr, nc)) squares.push({ row: nr, col: nc });
      }
      return squares;
    }

    const directions = type === 'B' ? [[1,1],[1,-1],[-1,1],[-1,-1]]
      : type === 'R' ? [[1,0],[-1,0],[0,1],[0,-1]]
      : [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];

    for (const [dr, dc] of directions) {
      let nr = row + dr;
      let nc = col + dc;
      while (this.inBounds(nr, nc)) {
        squares.push({ row: nr, col: nc });
        if (board[nr][nc]) break;
        nr += dr;
        nc += dc;
      }
    }

    return squares;
  }

  findKing(color, board = this.board) {
    const king = color + 'K';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (board[r][c] === king) return { row: r, col: c };
      }
    }
    return null;
  }

  simulateMove(from, to) {
    const board = this.cloneBoard();
    const piece = board[from.row][from.col];
    board[to.row][to.col] = piece;
    board[from.row][from.col] = null;
    return { board };
  }

  cloneBoard(source = this.board) {
    return source.map(row => [...row]);
  }

  inBounds(row, col) {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
  }

  updateUI() {
    const isWhite = this.turn === 'w';
    this.turnText.textContent = isWhite ? 'White to move' : 'Black to move';
    this.turnIndicator.className = `turn-badge ${isWhite ? 'turn-white' : 'turn-black'} mb-2`;

    this.renderMoveHistory();
    this.renderCaptured();
  }

  renderMoveHistory() {
    if (this.moveHistory.length === 0) {
      this.moveHistoryEl.innerHTML = '<p class="text-muted text-center py-3 mb-0 small">No moves yet</p>';
      return;
    }

    let html = '<table class="table table-sm mb-0"><tbody>';
    for (let i = 0; i < this.moveHistory.length; i += 2) {
      const moveNum = Math.floor(i / 2) + 1;
      const white = this.moveHistory[i].notation;
      const black = this.moveHistory[i + 1] ? this.moveHistory[i + 1].notation : '';
      html += `<tr><td class="text-muted">${moveNum}.</td><td>${white}</td><td>${black}</td></tr>`;
    }
    html += '</tbody></table>';
    this.moveHistoryEl.innerHTML = html;
    this.moveHistoryEl.scrollTop = this.moveHistoryEl.scrollHeight;
  }

  renderCaptured() {
    this.capturedWhiteEl.innerHTML = this.capturedByWhite.map(p =>
      `<span class="piece black">${PIECES[p]}</span>`
    ).join('');

    this.capturedBlackEl.innerHTML = this.capturedByBlack.map(p =>
      `<span class="piece white">${PIECES[p]}</span>`
    ).join('');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new ChessGame();
});
