(function () {
  'use strict';

  var STORAGE_KEY = 'sujal-chess-state';
  var GLYPH = { w: { P:'♙',N:'♘',B:'♗',R:'♖',Q:'♕',K:'♔' }, b: { P:'♟',N:'♞',B:'♝',R:'♜',Q:'♛',K:'♚' } };
  var PIP_MAP = { 1:[5], 2:[1,9], 3:[1,5,9], 4:[1,3,7,9], 5:[1,3,5,7,9], 6:[1,4,7,3,6,9] };
  var COLOR_LABEL = { w: 'Gold', b: 'Violet' };
  var PIECE_CLASS = { w: 'piece-gold', b: 'piece-violet' };

  var state = null;
  var selectedDiceSides = 6;

  /* ================= SCREEN SWITCHING (simple + defensive) ================= */
  function showOnly(id) {
    var ids = ['screen-splash', 'screen-menu', 'screen-board'];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (!el) continue;
      el.style.display = (ids[i] === id) ? 'flex' : 'none';
      el.style.opacity = '1';
    }
  }

  function fadeToScreen(fromId, toId) {
    var fromEl = document.getElementById(fromId);
    var toEl = document.getElementById(toId);
    if (!fromEl || !toEl) { showOnly(toId); return; }
    fromEl.style.transition = 'opacity 320ms ease';
    fromEl.style.opacity = '0';
    setTimeout(function () {
      fromEl.style.display = 'none';
      fromEl.style.opacity = '1';
      toEl.style.display = 'flex';
      toEl.style.opacity = '0';
      toEl.getBoundingClientRect();
      toEl.style.transition = 'opacity 320ms ease';
      toEl.style.opacity = '1';
    }, 320);
  }

  /* ================= chess engine (verified) ================= */
  function inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
  function initBoard() {
    var b = []; for (var r = 0; r < 8; r++) b.push(new Array(8).fill(null));
    var backRank = ['R','N','B','Q','K','B','N','R'];
    for (var c = 0; c < 8; c++) { b[0][c]={type:backRank[c],color:'b'}; b[1][c]={type:'P',color:'b'}; b[6][c]={type:'P',color:'w'}; b[7][c]={type:backRank[c],color:'w'}; }
    return b;
  }
  function cloneBoard(board){ return board.map(function(row){ return row.map(function(cell){ return cell?{type:cell.type,color:cell.color}:null; }); }); }
  function pieceIs(board,r,c,type,color){ var p=board[r][c]; return !!p && p.type===type && p.color===color; }
  function slideMoves(board,r,c,color,dirs){ var moves=[]; for (var i=0;i<dirs.length;i++){ var dr=dirs[i][0],dc=dirs[i][1]; var nr=r+dr,nc=c+dc; while(inBounds(nr,nc)){ var t=board[nr][nc]; if(!t){moves.push([nr,nc]);} else { if(t.color!==color) moves.push([nr,nc]); break; } nr+=dr; nc+=dc; } } return moves; }
  function stepMoves(board,r,c,color,offs){ var moves=[]; for (var i=0;i<offs.length;i++){ var nr=r+offs[i][0],nc=c+offs[i][1]; if(!inBounds(nr,nc)) continue; var t=board[nr][nc]; if(!t||t.color!==color) moves.push([nr,nc]); } return moves; }
  function pawnMoves(board,r,c,color){ var moves=[]; var dir=color==='w'?-1:1; var startRow=color==='w'?6:1; var oneR=r+dir; if(inBounds(oneR,c)&&!board[oneR][c]){ moves.push([oneR,c]); var twoR=r+2*dir; if(r===startRow&&!board[twoR][c]) moves.push([twoR,c]); } var diagCols=[c-1,c+1]; for (var i=0;i<diagCols.length;i++){ var nc=diagCols[i], nr=r+dir; if(inBounds(nr,nc)&&board[nr][nc]&&board[nr][nc].color!==color) moves.push([nr,nc]); } return moves; }
  var KN=[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  var KG=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  var DG=[[-1,-1],[-1,1],[1,-1],[1,1]];
  var ST=[[-1,0],[1,0],[0,-1],[0,1]];
  function getPseudoLegalMoves(board,r,c){ var p=board[r][c]; if(!p) return []; switch(p.type){ case 'P': return pawnMoves(board,r,c,p.color); case 'N': return stepMoves(board,r,c,p.color,KN); case 'B': return slideMoves(board,r,c,p.color,DG); case 'R': return slideMoves(board,r,c,p.color,ST); case 'Q': return slideMoves(board,r,c,p.color,DG.concat(ST)); case 'K': return stepMoves(board,r,c,p.color,KG); default: return []; } }
  function isSquareAttacked(board,r,c,byColor){ if(byColor==='w'){ if(inBounds(r+1,c-1)&&pieceIs(board,r+1,c-1,'P','w'))return true; if(inBounds(r+1,c+1)&&pieceIs(board,r+1,c+1,'P','w'))return true; } else { if(inBounds(r-1,c-1)&&pieceIs(board,r-1,c-1,'P','b'))return true; if(inBounds(r-1,c+1)&&pieceIs(board,r-1,c+1,'P','b'))return true; } for(var i=0;i<KN.length;i++){var nr=r+KN[i][0],nc=c+KN[i][1]; if(inBounds(nr,nc)&&pieceIs(board,nr,nc,'N',byColor))return true;} for(var j=0;j<KG.length;j++){var kr=r+KG[j][0],kc=c+KG[j][1]; if(inBounds(kr,kc)&&pieceIs(board,kr,kc,'K',byColor))return true;} for(var d=0;d<DG.length;d++){var dr=DG[d][0],dc=DG[d][1]; var sr=r+dr,sc=c+dc; while(inBounds(sr,sc)){var p=board[sr][sc]; if(p){ if(p.color===byColor&&(p.type==='B'||p.type==='Q'))return true; break;} sr+=dr; sc+=dc;}} for(var s=0;s<ST.length;s++){var sdr=ST[s][0],sdc=ST[s][1]; var tr=r+sdr,tc=c+sdc; while(inBounds(tr,tc)){var p2=board[tr][tc]; if(p2){ if(p2.color===byColor&&(p2.type==='R'||p2.type==='Q'))return true; break;} tr+=sdr; tc+=sdc;}} return false; }
  function findKing(board,color){ for(var r=0;r<8;r++) for(var c=0;c<8;c++) if(pieceIs(board,r,c,'K',color)) return [r,c]; return null; }
  function isInCheck(board,color){ var kp=findKing(board,color); if(!kp) return false; var opp=color==='w'?'b':'w'; return isSquareAttacked(board,kp[0],kp[1],opp); }
  function getLegalMoves(board,r,c){ var p=board[r][c]; if(!p) return []; var pseudo=getPseudoLegalMoves(board,r,c); var legal=[]; for(var i=0;i<pseudo.length;i++){ var tr=pseudo[i][0],tc=pseudo[i][1]; var clone=cloneBoard(board); clone[tr][tc]=clone[r][c]; clone[r][c]=null; if(!isInCheck(clone,p.color)) legal.push(pseudo[i]); } return legal; }
  function hasAnyLegalMove(board,color){ for(var r=0;r<8;r++) for(var c=0;c<8;c++){ var p=board[r][c]; if(p&&p.color===color&&getLegalMoves(board,r,c).length>0) return true; } return false; }

  /* ================= game state ================= */
  function freshState(diceSides) {
    return { board:initBoard(), current:'w', dice:null, movesLeft:0, selected:null, legalTargets:[], capturedByWhite:[], capturedByBlack:[], lastMove:null, gameOver:false, winner:null, endReason:null, diceSides: diceSides||6 };
  }

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  function rollFor(color) {
    if (state.gameOver || state.dice !== null || state.current !== color) return;
    var dieEl = document.getElementById(color==='w' ? 'die-white' : 'die-black');
    dieEl.classList.add('rolling');
    var ticks = 0, maxTicks = 7;
    var iv = setInterval(function () {
      var face = 1 + Math.floor(Math.random()*state.diceSides);
      renderDieFace(dieEl, face);
      ticks++;
      if (ticks >= maxTicks) {
        clearInterval(iv);
        dieEl.classList.remove('rolling');
        var finalVal = 1 + Math.floor(Math.random()*state.diceSides);
        state.dice = finalVal; state.movesLeft = finalVal;
        persist();
        render();
      }
    }, 70);
  }

  function passFor(color) {
    if (state.gameOver || state.dice === null || state.current !== color) return;
    endTurn(); persist(); render();
  }

  function endTurn() { state.current = state.current==='w'?'b':'w'; state.dice=null; state.movesLeft=0; state.selected=null; state.legalTargets=[]; }

  function selectSquare(r,c){ state.selected={r:r,c:c}; state.legalTargets=getLegalMoves(state.board,r,c); render(); }

  function executeMove(fr,fc,tr,tc) {
    var moving = state.board[fr][fc];
    var moverColor = moving.color, oppColor = moverColor==='w'?'b':'w';
    var captured = state.board[tr][tc];
    if (captured) {
      if (captured.type==='K') {
        state.board[tr][tc]=moving; state.board[fr][fc]=null;
        state.gameOver=true; state.winner=moverColor; state.endReason='capture';
        state.selected=null; state.legalTargets=[]; persist(); render(); return;
      }
      if (moverColor==='w') state.capturedByWhite.push(captured.type); else state.capturedByBlack.push(captured.type);
    }
    state.board[tr][tc]=moving; state.board[fr][fc]=null;
    if (moving.type==='P' && ((moving.color==='w'&&tr===0)||(moving.color==='b'&&tr===7))) moving.type='Q';
    state.lastMove={fr:fr,fc:fc,tr:tr,tc:tc};
    state.selected=null; state.legalTargets=[]; state.movesLeft-=1;

    var oppInCheck=isInCheck(state.board,oppColor), oppHasMoves=hasAnyLegalMove(state.board,oppColor);
    if (oppInCheck && !oppHasMoves) { state.gameOver=true; state.winner=moverColor; state.endReason='checkmate'; persist(); render(); return; }
    if (!oppInCheck && !oppHasMoves) { state.gameOver=true; state.winner=null; state.endReason='stalemate'; persist(); render(); return; }

    if (state.movesLeft>0) { if(!hasAnyLegalMove(state.board,moverColor)) endTurn(); } else { endTurn(); }
    persist(); render();
  }

  function onCellClick(r,c) {
    if (state.gameOver) return;
    if (state.dice===null || state.movesLeft<=0) return;
    var piece = state.board[r][c];
    if (state.selected) {
      var isTarget = state.legalTargets.some(function(t){return t[0]===r&&t[1]===c;});
      if (isTarget) { executeMove(state.selected.r,state.selected.c,r,c); return; }
      if (piece && piece.color===state.current) { selectSquare(r,c); return; }
      state.selected=null; state.legalTargets=[]; render(); return;
    }
    if (piece && piece.color===state.current) selectSquare(r,c);
  }

  function newGame() { state = freshState(state ? state.diceSides : selectedDiceSides); persist(); render(); }

  /* ================= rendering ================= */
  function renderDieFace(el, value) {
    el.innerHTML = '';
    var active = value ? (PIP_MAP[value] || []) : [];
    for (var i=1;i<=9;i++) {
      var slot = document.createElement('div'); slot.className='pip-slot';
      if (active.indexOf(i)!==-1) { var dot=document.createElement('div'); dot.className='pip'; slot.appendChild(dot); }
      el.appendChild(slot);
    }
  }

  function renderBoard() {
    var boardEl = document.getElementById('board');
    boardEl.innerHTML = '';
    var checkedKingPos = null;
    if (!state.gameOver && isInCheck(state.board, state.current)) checkedKingPos = findKing(state.board, state.current);
    for (var r=0;r<8;r++) for (var c=0;c<8;c++) {
      (function (r,c) {
        var cell = document.createElement('div');
        var isLight = (r+c)%2===0;
        cell.className = 'dc-cell ' + (isLight?'dc-cell-light':'dc-cell-dark');
        var isLastMove = state.lastMove && ((state.lastMove.fr===r&&state.lastMove.fc===c)||(state.lastMove.tr===r&&state.lastMove.tc===c));
        if (isLastMove) cell.classList.add('dc-cell-last-move');
        if (state.selected && state.selected.r===r && state.selected.c===c) cell.classList.add('dc-cell-selected');
        if (checkedKingPos && checkedKingPos[0]===r && checkedKingPos[1]===c) cell.classList.add('dc-cell-check');
        var isTarget = state.legalTargets.some(function(t){return t[0]===r&&t[1]===c;});
        if (isTarget) cell.classList.add(state.board[r][c] ? 'dc-cell-capture' : 'dc-cell-move');
        var piece = state.board[r][c];
        if (piece) {
          var span = document.createElement('span');
          span.className = 'dc-piece ' + PIECE_CLASS[piece.color];
          span.textContent = GLYPH[piece.color][piece.type];
          if (state.lastMove && state.lastMove.tr===r && state.lastMove.tc===c) span.classList.add('piece-pop');
          cell.appendChild(span);
        }
        cell.addEventListener('click', function(){ onCellClick(r,c); });
        boardEl.appendChild(cell);
      })(r,c);
    }
  }

  function renderCaptured() {
    var wEl = document.getElementById('captured-white'), bEl = document.getElementById('captured-black');
    wEl.innerHTML = '<span class="captured-label">Gold captured</span>';
    state.capturedByWhite.forEach(function(t){ var s=document.createElement('span'); s.className='captured-piece piece-violet'; s.textContent=GLYPH.b[t]; wEl.appendChild(s); });
    bEl.innerHTML = '<span class="captured-label">Violet captured</span>';
    state.capturedByBlack.forEach(function(t){ var s=document.createElement('span'); s.className='captured-piece piece-gold'; s.textContent=GLYPH.w[t]; bEl.appendChild(s); });
  }

  function renderPanel(color) {
    var panel = document.getElementById(color==='w' ? 'panel-white' : 'panel-black');
    var dieEl = document.getElementById(color==='w' ? 'die-white' : 'die-black');
    var movesEl = document.getElementById(color==='w' ? 'moves-white' : 'moves-black');
    var rollBtn = document.getElementById(color==='w' ? 'roll-white' : 'roll-black');
    var passBtn = document.getElementById(color==='w' ? 'pass-white' : 'pass-black');
    var isActive = state.current === color && !state.gameOver;

    panel.classList.toggle('dice-panel-inactive', !isActive);
    renderDieFace(dieEl, state.current===color ? state.dice : null);

    if (!isActive) {
      movesEl.textContent = state.current===color ? '' : 'Waiting…';
      rollBtn.style.display = 'none'; passBtn.style.display = 'none';
      return;
    }
    if (state.dice === null) {
      movesEl.textContent = 'Tap Roll to start your turn';
      rollBtn.style.display = 'inline-block'; passBtn.style.display = 'none';
    } else {
      movesEl.textContent = state.movesLeft + (state.movesLeft===1?' move left':' moves left');
      rollBtn.style.display = 'none';
      passBtn.style.display = state.movesLeft>0 ? 'inline-block' : 'none';
    }
  }

  function render() {
    renderBoard(); renderCaptured();
    renderPanel('w'); renderPanel('b');

    var statusEl = document.getElementById('status-bar');
    var overlay = document.getElementById('winner-overlay');
    var winnerText = document.getElementById('winner-text');

    if (state.gameOver) {
      overlay.style.display = 'flex';
      var side = state.winner ? COLOR_LABEL[state.winner] : null;
      if (state.endReason==='stalemate') winnerText.textContent = 'Draw — stalemate';
      else if (state.endReason==='checkmate') winnerText.textContent = side + ' wins by checkmate!';
      else winnerText.textContent = side + ' wins!';
      statusEl.textContent = '';
      return;
    }
    overlay.style.display = 'none';
    var inCheck = isInCheck(state.board, state.current);
    statusEl.textContent = COLOR_LABEL[state.current] + "'s move" + (inCheck ? ' — Check!' : '');
    statusEl.className = 'status-bar' + (inCheck ? ' in-check' : '');
  }

  /* ================= dice selector (menu) ================= */
  function buildDiceSelector() {
    var row = document.getElementById('dice-select-row');
    row.innerHTML = '';
    for (var n=1;n<=6;n++) {
      (function(n){
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'dice-chip' + (n===6 ? ' active' : '');
        chip.textContent = String(n);
        chip.addEventListener('click', function(){
          var all = row.querySelectorAll('.dice-chip');
          for (var i=0;i<all.length;i++) all[i].classList.remove('active');
          chip.classList.add('active');
          selectedDiceSides = n;
        });
        row.appendChild(chip);
      })(n);
    }
    selectedDiceSides = 6;
  }

  /* ================= init ================= */
  function init() {
    showOnly('screen-splash');
    buildDiceSelector();

    document.getElementById('start-btn').addEventListener('click', function () {
      fadeToScreen('screen-splash', 'screen-menu');
    });
    document.getElementById('play-btn').addEventListener('click', function () {
      state = freshState(selectedDiceSides);
      persist();
      render();
      fadeToScreen('screen-menu', 'screen-board');
    });
    document.getElementById('new-game-btn').addEventListener('click', newGame);
    document.getElementById('play-again-btn').addEventListener('click', newGame);

    document.getElementById('roll-white').addEventListener('click', function(){ rollFor('w'); });
    document.getElementById('roll-black').addEventListener('click', function(){ rollFor('b'); });
    document.getElementById('pass-white').addEventListener('click', function(){ passFor('w'); });
    document.getElementById('pass-black').addEventListener('click', function(){ passFor('b'); });

    state = freshState(6);
  }

  document.addEventListener('DOMContentLoaded', init);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function(){});
    });
  }
})();
