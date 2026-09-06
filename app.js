(() => {
  'use strict';

  // ---------------- State ----------------
  let expr = '';
  let cursorPos = 0;
  let history = loadHistory();
  let selectedHistoryItem = null;

  const FONT_STEPS = [56, 50, 44, 38, 33, 28, 24];
  const OPERATORS = ['+', '−', '×', '÷'];

  // ---------------- DOM ----------------
  const displayWrap = document.getElementById('display-wrap');
  const display = document.getElementById('display');
  const exprLine = document.getElementById('expr-line');
  const exprBefore = document.getElementById('expr-before');
  const exprAfter = document.getElementById('expr-after');
  const previewLine = document.getElementById('preview-line');
  const keypad = document.getElementById('keypad');

  const historyPanel = document.getElementById('history-panel');
  const historyList = document.getElementById('history-list');
  const historyHeader = document.getElementById('history-panel-header');
  const historyClose = document.getElementById('history-close');

  const menuOverlay = document.getElementById('menu-overlay');
  const contextMenu = document.getElementById('context-menu');
  const contextMenuExpr = document.getElementById('context-menu-expr');

  // ---------------- Rendering ----------------
  function setExpr(newExpr, newCursor) {
    expr = newExpr;
    cursorPos = Math.max(0, Math.min(newExpr.length, newCursor));
    render();
  }

  function render() {
    exprBefore.textContent = expr.slice(0, cursorPos);
    exprAfter.textContent = expr.slice(cursorPos);
    updatePreview();
    fitFont();
  }

  function fitFont() {
    let chosen = FONT_STEPS[FONT_STEPS.length - 1];
    for (const size of FONT_STEPS) {
      exprLine.style.fontSize = size + 'px';
      // display.scrollHeight already includes both lines + its own padding,
      // so compare it directly with the visible height (+1px for subpixels).
      if (display.scrollHeight <= display.clientHeight + 1) {
        chosen = size;
        break;
      }
    }
    exprLine.style.fontSize = chosen + 'px';
    requestAnimationFrame(() => {
      display.scrollTop = display.scrollHeight;
    });
  }

  function updatePreview() {
    const hasOp = /[+\-−×÷(]/.test(expr);
    if (!hasOp) {
      previewLine.textContent = '';
      return;
    }
    const val = tryEvaluateForgiving(expr);
    if (val === null) {
      previewLine.textContent = '';
      return;
    }
    previewLine.textContent = '= ' + formatPretty(val);
  }

  function shakeError() {
    exprLine.classList.remove('error');
    void exprLine.offsetWidth;
    exprLine.classList.add('error');
    if (navigator.vibrate) navigator.vibrate(30);
  }

  // ---------------- Math engine ----------------
  function normalize(str) {
    return str
      .replace(/,/g, '.')
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-');
  }

  function evaluate(str) {
    let i = 0;
    const peek = () => str[i];

    function parseExpr() {
      let v = parseTerm();
      while (true) {
        const c = peek();
        if (c === '+' || c === '-') {
          i++;
          v = c === '+' ? v + parseTerm() : v - parseTerm();
        } else break;
      }
      return v;
    }
    function parseTerm() {
      let v = parseFactor();
      while (true) {
        const c = peek();
        if (c === '*' || c === '/') {
          i++;
          const rhs = parseFactor();
          if (c === '/') {
            if (rhs === 0) throw new Error('div0');
            v = v / rhs;
          } else v = v * rhs;
        } else break;
      }
      return v;
    }
    function parseFactor() {
      const c = peek();
      if (c === '+') { i++; return parseFactor(); }
      if (c === '-') { i++; return -parseFactor(); }
      if (c === '(') {
        i++;
        const v = parseExpr();
        if (peek() !== ')') throw new Error('paren');
        i++;
        return v;
      }
      return parseNumber();
    }
    function parseNumber() {
      const start = i;
      while (i < str.length && /[0-9.]/.test(str[i])) i++;
      if (i === start) throw new Error('expected number');
      const numStr = str.slice(start, i);
      if ((numStr.match(/\./g) || []).length > 1) throw new Error('bad number');
      return parseFloat(numStr);
    }

    if (!str) throw new Error('empty');
    const result = parseExpr();
    if (i !== str.length) throw new Error('trailing chars');
    if (!isFinite(result)) throw new Error('not finite');
    return result;
  }

  function forgive(str) {
    let s = normalize(str);
    s = s.replace(/[+\-*/.]+$/, '');
    const open = (s.match(/\(/g) || []).length;
    const close = (s.match(/\)/g) || []).length;
    s += ')'.repeat(Math.max(0, open - close));
    return s;
  }

  function tryEvaluateForgiving(str) {
    try {
      const s = forgive(str);
      if (!s) return null;
      return evaluate(s);
    } catch (e) {
      return null;
    }
  }

  function formatPretty(val) {
    const rounded = parseFloat(val.toPrecision(12));
    if (Math.abs(rounded) >= 1e15 || (Math.abs(rounded) < 1e-9 && rounded !== 0)) {
      return rounded.toExponential(6).replace('.', ',');
    }
    return rounded.toLocaleString('ru-RU', { maximumFractionDigits: 10 });
  }

  function formatPlain(val) {
    const rounded = parseFloat(val.toPrecision(12));
    let s;
    if (Math.abs(rounded) >= 1e15 || (Math.abs(rounded) < 1e-9 && rounded !== 0)) {
      s = rounded.toExponential(6);
    } else {
      s = rounded.toString();
      if (s.includes('e')) {
        s = rounded.toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
      }
    }
    return s.replace('.', ',');
  }

  // ---------------- Key handling ----------------
  function pressKey(key) {
    if (key === 'clear') { setExpr('', 0); return; }
    if (key === 'back') {
      if (cursorPos > 0) setExpr(expr.slice(0, cursorPos - 1) + expr.slice(cursorPos), cursorPos - 1);
      return;
    }
    if (key === '=') { handleEquals(); return; }

    const before = expr.slice(0, cursorPos);
    const after = expr.slice(cursorPos);
    const lastChar = before.slice(-1);

    if (key === ',') {
      const seg = before.split(/[+\-−×÷()]/).pop();
      if (seg.includes(',')) return;
      const ins = seg === '' ? '0,' : ',';
      setExpr(before + ins + after, cursorPos + ins.length);
      return;
    }

    if (/[0-9]/.test(key)) {
      const ins = lastChar === ')' ? '×' + key : key;
      setExpr(before + ins + after, cursorPos + ins.length);
      return;
    }

    if (key === '(') {
      const ins = (lastChar && /[0-9,)]/.test(lastChar)) ? '×(' : '(';
      setExpr(before + ins + after, cursorPos + ins.length);
      return;
    }

    if (key === ')') {
      const openCount = (before.match(/\(/g) || []).length;
      const closeCount = (before.match(/\)/g) || []).length;
      if (openCount <= closeCount) return;
      if (!lastChar || OPERATORS.includes(lastChar) || lastChar === '(') return;
      setExpr(before + ')' + after, cursorPos + 1);
      return;
    }

    if (OPERATORS.includes(key)) {
      if (!lastChar) {
        if (key === '−') setExpr(before + key + after, cursorPos + 1);
        return;
      }
      if (OPERATORS.includes(lastChar)) {
        if (key === '−' && lastChar !== '−') {
          setExpr(before + key + after, cursorPos + 1);
        } else {
          const nb = before.slice(0, -1) + key;
          setExpr(nb + after, nb.length);
        }
        return;
      }
      if (lastChar === '(') {
        if (key === '−') setExpr(before + key + after, cursorPos + 1);
        return;
      }
      setExpr(before + key + after, cursorPos + 1);
      return;
    }
  }

  function handleEquals() {
    if (!expr.trim()) return;
    const s = forgive(expr);
    try {
      const val = evaluate(s);
      const resultPretty = formatPretty(val);
      const resultPlain = formatPlain(val);
      addHistory(expr, resultPretty, resultPlain);
      setExpr(resultPlain, resultPlain.length);
    } catch (e) {
      shakeError();
    }
  }

  keypad.addEventListener('click', (e) => {
    const btn = e.target.closest('.key');
    if (!btn) return;
    pressKey(btn.dataset.key);
  });

  // ---------------- Cursor placement by tap ----------------
  display.addEventListener('click', (e) => {
    if (historyPanel.classList.contains('open')) return;
    placeCursorAt(e.clientX, e.clientY);
  });

  function placeCursorAt(x, y) {
    let node = null, offset = 0;
    if (document.caretRangeFromPoint) {
      const range = document.caretRangeFromPoint(x, y);
      if (!range) return;
      node = range.startContainer;
      offset = range.startOffset;
    } else if (document.caretPositionFromPoint) {
      const pos = document.caretPositionFromPoint(x, y);
      if (!pos) return;
      node = pos.offsetNode;
      offset = pos.offset;
    } else {
      return;
    }
    let newPos = null;
    if (exprBefore.contains(node)) newPos = offset;
    else if (exprAfter.contains(node)) newPos = exprBefore.textContent.length + offset;
    else return;
    cursorPos = Math.max(0, Math.min(expr.length, newPos));
    render();
  }

  // ---------------- History storage ----------------
  function loadHistory() {
    try {
      const raw = localStorage.getItem('calc_history_v1');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveHistory() {
    try {
      localStorage.setItem('calc_history_v1', JSON.stringify(history.slice(-300)));
    } catch (e) { /* storage unavailable, continue silently */ }
  }

  function addHistory(rawExpr, resultPretty, resultPlain) {
    history.push({ expr: rawExpr, resultPretty, resultPlain, time: Date.now() });
    saveHistory();
  }

  function formatTime(ms) {
    const d = new Date(ms);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) {
      return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) +
      ', ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  function renderHistoryList() {
    historyPanel.classList.toggle('empty', history.length === 0);
    historyList.innerHTML = '';
    for (let idx = history.length - 1; idx >= 0; idx--) {
      const item = history[idx];
      const row = document.createElement('div');
      row.className = 'history-row';
      row.dataset.idx = String(idx);
      row.innerHTML =
        '<div class="h-expr"></div>' +
        '<div class="h-result"></div>' +
        '<div class="h-time"></div>';
      row.querySelector('.h-expr').textContent = item.expr + ' =';
      row.querySelector('.h-result').textContent = item.resultPretty;
      row.querySelector('.h-time').textContent = formatTime(item.time);
      historyList.appendChild(row);
    }
  }

  historyList.addEventListener('click', (e) => {
    const row = e.target.closest('.history-row');
    if (!row) return;
    selectedHistoryItem = history[parseInt(row.dataset.idx, 10)];
    openContextMenu();
  });

  // ---------------- History panel open/close ----------------
  // Opening pushes a history entry so the system Back button/gesture
  // closes the panel instead of leaving the app. Closing via UI goes
  // back() to keep the stack balanced (the popstate handler then no-ops).
  let historyPushed = false;
  function openHistory() {
    renderHistoryList();
    historyPanel.classList.add('open');
    historyPanel.setAttribute('aria-hidden', 'false');
    // Newest entry is first — pin to top so it's visible immediately.
    historyList.scrollTop = 0;
    if (!historyPushed) {
      try { window.history.pushState({ calcHistory: true }, ''); historyPushed = true; } catch (e) { /* ignore: file:// etc. */ }
    }
  }
  function closeHistory() {
    if (!historyPanel.classList.contains('open')) return;
    historyPanel.classList.remove('open');
    historyPanel.setAttribute('aria-hidden', 'true');
    if (historyPushed) {
      historyPushed = false;
      try { window.history.back(); } catch (e) { /* ignore */ }
    }
  }
  window.addEventListener('popstate', () => {
    if (!historyPanel.classList.contains('open')) return;
    historyPushed = false; // the back press already popped our entry
    closeContextMenu();
    historyPanel.classList.remove('open');
    historyPanel.setAttribute('aria-hidden', 'true');
  });
  historyClose.addEventListener('click', closeHistory);

  // ---------------- Context menu ----------------
  function openContextMenu() {
    if (!selectedHistoryItem) return;
    contextMenuExpr.textContent = selectedHistoryItem.expr + ' = ' + selectedHistoryItem.resultPretty;
    menuOverlay.classList.add('open');
    contextMenu.classList.add('open');
  }
  function closeContextMenu() {
    menuOverlay.classList.remove('open');
    contextMenu.classList.remove('open');
    selectedHistoryItem = null;
  }
  menuOverlay.addEventListener('click', closeContextMenu);
  contextMenu.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn || !selectedHistoryItem) return;
    if (btn.dataset.action === 'op') {
      setExpr(selectedHistoryItem.expr, selectedHistoryItem.expr.length);
    } else {
      setExpr(selectedHistoryItem.resultPlain, selectedHistoryItem.resultPlain.length);
    }
    closeContextMenu();
    closeHistory();
  });

  // ---------------- Gestures: swipe down on display to open history ----------------
  let touchStartY = null, touchStartX = null, pulling = false, pullDist = 0;

  displayWrap.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || historyPanel.classList.contains('open')) return;
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
    pulling = false;
  }, { passive: true });

  displayWrap.addEventListener('touchmove', (e) => {
    if (touchStartY === null) return;
    const dy = e.touches[0].clientY - touchStartY;
    const dx = e.touches[0].clientX - touchStartX;
    if (!pulling) {
      if (display.scrollTop <= 0 && dy > 8 && Math.abs(dy) > Math.abs(dx) * 1.4) {
        pulling = true;
      } else if (Math.abs(dx) > Math.abs(dy) || dy < -8 || display.scrollTop > 0) {
        touchStartY = null;
        return;
      } else {
        return;
      }
    }
    e.preventDefault();
    pullDist = Math.max(0, Math.min(dy, window.innerHeight));
    if (pullDist > 0 && !historyPanel.classList.contains('open')) {
      renderHistoryList();
      historyPanel.classList.add('dragging');
      historyPanel.style.transform = `translateY(calc(-100% + ${pullDist}px))`;
    }
  }, { passive: false });

  function endPull() {
    if (pulling) {
      historyPanel.classList.remove('dragging');
      historyPanel.style.transform = '';
      if (pullDist > 120) openHistory();
    }
    touchStartY = null;
    pulling = false;
    pullDist = 0;
  }
  displayWrap.addEventListener('touchend', endPull);
  displayWrap.addEventListener('touchcancel', endPull);

  // ---------------- Gesture: swipe up on history header to close ----------------
  let closeStartY = null, closePulling = false, closeDist = 0;
  historyHeader.addEventListener('touchstart', (e) => {
    closeStartY = e.touches[0].clientY;
    closePulling = false;
  }, { passive: true });
  historyHeader.addEventListener('touchmove', (e) => {
    if (closeStartY === null) return;
    const dy = e.touches[0].clientY - closeStartY;
    if (dy < -6) {
      closePulling = true;
      e.preventDefault();
      closeDist = Math.min(-dy, window.innerHeight);
      historyPanel.classList.add('dragging');
      historyPanel.style.transform = `translateY(${-closeDist}px)`;
    }
  }, { passive: false });
  function endClosePull() {
    if (closePulling) {
      historyPanel.classList.remove('dragging');
      historyPanel.style.transform = '';
      if (closeDist > 80) closeHistory();
    }
    closeStartY = null;
    closePulling = false;
    closeDist = 0;
  }
  historyHeader.addEventListener('touchend', endClosePull);
  historyHeader.addEventListener('touchcancel', endClosePull);

  // ---------------- Gesture: swipe up on the open history list to close ----
  // Same drag-to-close as the header, but only when the list is already at
  // the very top — otherwise the gesture scrolls the list natively.
  historyList.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    closeStartY = e.touches[0].clientY;
    closePulling = false;
  }, { passive: true });
  historyList.addEventListener('touchmove', (e) => {
    if (closeStartY === null) return;
    if (historyList.scrollTop > 0) { closeStartY = null; return; }
    const dy = e.touches[0].clientY - closeStartY;
    if (dy < -6) {
      closePulling = true;
      e.preventDefault();
      closeDist = Math.min(-dy, window.innerHeight);
      historyPanel.classList.add('dragging');
      historyPanel.style.transform = `translateY(${-closeDist}px)`;
    }
  }, { passive: false });
  historyList.addEventListener('touchend', endClosePull);
  historyList.addEventListener('touchcancel', endClosePull);

  // ---------------- Keyboard support (for desktop/testing) ----------------
  window.addEventListener('keydown', (e) => {
    if (historyPanel.classList.contains('open') || contextMenu.classList.contains('open')) {
      if (e.key === 'Escape') { closeContextMenu(); closeHistory(); }
      return;
    }
    const map = { '*': '×', '/': '÷', '-': '−', '.': ',' };
    if (/[0-9]/.test(e.key)) pressKey(e.key);
    else if (map[e.key]) pressKey(map[e.key]);
    else if (['+', '(', ')', ','].includes(e.key)) pressKey(e.key);
    else if (e.key === 'Enter' || e.key === '=') pressKey('=');
    else if (e.key === 'Backspace') pressKey('back');
    else if (e.key === 'Escape') pressKey('clear');
    else if (e.key === 'ArrowLeft') setExpr(expr, cursorPos - 1);
    else if (e.key === 'ArrowRight') setExpr(expr, cursorPos + 1);
  });

  // ---------------- Init ----------------
  window.addEventListener('resize', fitFont);
  render();
})();
