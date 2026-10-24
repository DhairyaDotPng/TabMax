// TabMax - Bookmarks Module & Chrome Bookmarks CRUD

let allBookmarksCache = [];
let cachedFolderCards = [];
let cachedGridEl = null;
let cachedOnEmojiClick = null;
let rootBookmarkBarId = '1';
let rootOtherBookmarksId = '2';
let draggedBookmark = null;
let isInternalMove = false;

export function isInternalBookmarkMoving() {
  return isInternalMove;
}

// Folder Modes & Width Configuration (Stored in localStorage: 'tabmax_folder_modes')
export function getFolderModeConfig(folderId) {
  try {
    const raw = localStorage.getItem('tabmax_folder_modes');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed[folderId]) {
        return {
          mode: parsed[folderId].mode === 'horizontal' ? 'horizontal' : 'vertical',
          span: parsed[folderId].span || '2'
        };
      }
    }
  } catch (_) {}
  return { mode: 'vertical', span: '2' };
}

export function setFolderModeConfig(folderId, partialConfig) {
  try {
    const raw = localStorage.getItem('tabmax_folder_modes');
    const all = raw ? JSON.parse(raw) : {};
    all[folderId] = {
      ...(all[folderId] || { mode: 'vertical', span: '2' }),
      ...partialConfig
    };
    localStorage.setItem('tabmax_folder_modes', JSON.stringify(all));
  } catch (_) {}
}

// Column span helper for a given folder (1, 2, 3, or 4 columns)
export function getFolderSpan(folderId) {
  const config = getFolderModeConfig(folderId);
  if (config.mode !== 'horizontal') {
    return 1;
  }
  const s = String(config.span || '2');
  if (s === 'full') return 4;
  const num = parseInt(s, 10);
  return isNaN(num) ? 2 : Math.max(1, Math.min(4, num));
}

// Calculate the total column span consumed by an array of items in a row
export function calculateRowSpan(row) {
  if (!Array.isArray(row)) return 0;
  return row.reduce((sum, item) => sum + getFolderSpan(item.id || item), 0);
}

// Helper to find the first column (1 to 4 - span + 1) in a row where a card of given span fits without overlap
function findAvailableColInRow(row, span) {
  const maxStart = 4 - span + 1;
  for (let c = 1; c <= maxStart; c++) {
    let overlap = false;
    for (const item of row) {
      const itemSpan = getFolderSpan(item.id);
      if (!(c + span - 1 < item.col || c > item.col + itemSpan - 1)) {
        overlap = true;
        break;
      }
    }
    if (!overlap) return c;
  }
  return null;
}

// Rebalance rows so that overlapping cards shift right and overflowing cards cascade to subsequent rows
export function rebalanceRows(rows, startIdx = 0) {
  for (let i = startIdx; i < rows.length; i++) {
    const row = rows[i];
    row.sort((a, b) => a.col - b.col);

    // Push right any overlapping cards within the row
    for (let j = 0; j < row.length - 1; j++) {
      const current = row[j];
      const next = row[j + 1];
      const currentSpan = getFolderSpan(current.id);
      const minNextCol = current.col + currentSpan;
      if (next.col < minNextCol) {
        next.col = minNextCol;
      }
    }

    // Check if any cards overflow past column 4
    while (row.length > 1) {
      const last = row[row.length - 1];
      const lastSpan = getFolderSpan(last.id);
      if (last.col + lastSpan - 1 > 4) {
        row.pop();
        last.col = 1;
        if (i + 1 < rows.length) {
          rows[i + 1].unshift(last);
        } else {
          rows.push([last]);
        }
      } else {
        break;
      }
    }

    // Clamp single card to max valid column
    if (row.length === 1) {
      const only = row[0];
      const span = getFolderSpan(only.id);
      only.col = Math.max(1, Math.min(4 - span + 1, only.col));
    }
  }
}

// Get saved folder rows layout (each row is an array of { id, col })
export function getSavedFolderRows(cards) {
  let savedRows = [];
  try {
    const raw = localStorage.getItem('tabmax_folder_rows');
    if (raw) savedRows = JSON.parse(raw);
  } catch (_) {}

  const cardList = (cards && cards.length > 0) ? cards : cachedFolderCards;
  const cardMap = new Map((cardList || []).map(c => [c.id, c]));
  const seenIds = new Set();
  const validRows = [];

  // Filter & normalize saved rows
  if (Array.isArray(savedRows) && savedRows.length > 0) {
    for (const row of savedRows) {
      if (!Array.isArray(row)) continue;
      const cleanRow = [];
      let nextAutoCol = 1;

      for (const item of row) {
        let id, col;
        if (typeof item === 'string') {
          id = item;
          col = nextAutoCol;
        } else if (item && typeof item === 'object' && item.id) {
          id = item.id;
          col = typeof item.col === 'number' ? item.col : nextAutoCol;
        } else {
          continue;
        }

        if (cardMap.has(id) && !seenIds.has(id)) {
          const span = getFolderSpan(id);
          col = Math.max(1, Math.min(4 - span + 1, col));
          cleanRow.push({ id, col });
          seenIds.add(id);
          nextAutoCol = col + span;
        }
      }

      if (cleanRow.length > 0) {
        cleanRow.sort((a, b) => a.col - b.col);
        validRows.push(cleanRow);
      }
    }
  }

  // Any cards not yet placed (newly created folders or migration)
  const remainingCards = (cardList || []).filter(c => !seenIds.has(c.id));
  if (remainingCards.length > 0) {
    let currentRow = validRows.length > 0 ? validRows[validRows.length - 1] : null;

    for (const card of remainingCards) {
      const span = getFolderSpan(card.id);
      let placedCol = null;

      if (currentRow) {
        placedCol = findAvailableColInRow(currentRow, span);
      }

      if (placedCol === null) {
        currentRow = [{ id: card.id, col: 1 }];
        validRows.push(currentRow);
      } else {
        currentRow.push({ id: card.id, col: placedCol });
        currentRow.sort((a, b) => a.col - b.col);
      }
      seenIds.add(card.id);
    }
  }

  rebalanceRows(validRows);
  const cleanRows = validRows.filter(r => r.length > 0);
  saveFolderRows(cleanRows);
  return cleanRows;
}

// Save folder rows and keep flat cards order in sync
export function saveFolderRows(rows) {
  const cleanRows = (rows || [])
    .filter(r => Array.isArray(r) && r.length > 0)
    .map(r => r.map(item => ({ id: item.id, col: item.col })));
  localStorage.setItem('tabmax_folder_rows', JSON.stringify(cleanRows));
  const flatOrder = cleanRows.flat().map(item => item.id);
  saveCardsOrder(flatOrder);
}

// Check if a folder card shares its row with other folders
export function isFolderInMultiCardRow(folderId) {
  const rows = getSavedFolderRows(cachedFolderCards);
  const row = rows.find(r => r.some(item => item.id === folderId));
  return Boolean(row && row.length > 1);
}

// Move folder to its own new row immediately below its current row
export function moveFolderToNewRow(folderId) {
  const rows = getSavedFolderRows(cachedFolderCards);
  const rowIdx = rows.findIndex(r => r.some(item => item.id === folderId));
  if (rowIdx === -1) return;
  if (rows[rowIdx].length <= 1) return;

  rows[rowIdx] = rows[rowIdx].filter(item => item.id !== folderId);
  rows.splice(rowIdx + 1, 0, [{ id: folderId, col: 1 }]);
  saveFolderRows(rows);
  refreshCardsGrid();
}

// Check if a folder can merge into the row above without exceeding 4 columns
export function canMergeFolderWithRowAbove(folderId) {
  const rows = getSavedFolderRows(cachedFolderCards);
  const rowIdx = rows.findIndex(r => r.some(item => item.id === folderId));
  if (rowIdx <= 0) return false;
  const rowAbove = rows[rowIdx - 1];
  const thisSpan = getFolderSpan(folderId);
  return findAvailableColInRow(rowAbove, thisSpan) !== null;
}

// Merge folder into the row above
export function mergeFolderWithRowAbove(folderId) {
  const rows = getSavedFolderRows(cachedFolderCards);
  const rowIdx = rows.findIndex(r => r.some(item => item.id === folderId));
  if (rowIdx <= 0) return;
  const rowAbove = rows[rowIdx - 1];
  const thisSpan = getFolderSpan(folderId);
  const targetCol = findAvailableColInRow(rowAbove, thisSpan);
  if (targetCol === null) return;

  rows[rowIdx] = rows[rowIdx].filter(item => item.id !== folderId);
  rowAbove.push({ id: folderId, col: targetCol });
  rowAbove.sort((a, b) => a.col - b.col);
  saveFolderRows(rows);
  refreshCardsGrid();
}

// Triggered when folder mode or folder width span changes
export function onFolderSpanOrModeChanged() {
  const rows = getSavedFolderRows(cachedFolderCards);
  rebalanceRows(rows);
  saveFolderRows(rows);
  refreshCardsGrid();
}

// Re-renders the folder cards grid with cached parameters
export function refreshCardsGrid() {
  if (cachedGridEl && cachedFolderCards) {
    renderCardsGrid(cachedFolderCards, cachedGridEl, cachedOnEmojiClick);
  }
}

export async function loadBookmarks() {
  if (!chrome.bookmarks) {
    console.warn('chrome.bookmarks API is not available.');
    return { quickBookmarks: [], folderCards: [] };
  }

  const tree = await chrome.bookmarks.getTree();
  if (!tree || !tree[0] || !tree[0].children) {
    return { quickBookmarks: [], folderCards: [] };
  }

  const rootChildren = tree[0].children;
  // Usually: rootChildren[0] is Bookmarks Bar, rootChildren[1] is Other Bookmarks
  let bookmarkBar = rootChildren.find(n => n.id === '1' || n.title.toLowerCase().includes('bar')) || rootChildren[0];
  let otherBookmarks = rootChildren.find(n => n.id === '2' || n.title.toLowerCase().includes('other')) || rootChildren[1];

  if (bookmarkBar) rootBookmarkBarId = bookmarkBar.id;
  if (otherBookmarks) rootOtherBookmarksId = otherBookmarks.id;

  // 1. Quick Bar Bookmarks (Direct links inside Bookmark Bar)
  const quickBookmarks = [];
  if (bookmarkBar && bookmarkBar.children) {
    for (const item of bookmarkBar.children) {
      if (item.url) {
        quickBookmarks.push(item);
      }
    }
  }

  // 2. Folder Cards (Each subfolder directly inside Other Bookmarks)
  let folderCards = [];
  if (otherBookmarks && otherBookmarks.children) {
    const looseLinks = [];
    for (const item of otherBookmarks.children) {
      if (item.url) {
        looseLinks.push(item);
      } else if (item.children) {
        // Collect direct link children inside this subfolder
        const links = (item.children || []).filter(sub => Boolean(sub.url));
        folderCards.push({
          id: item.id,
          title: item.title || 'Untitled Folder',
          bookmarks: links
        });
      }
    }
    // If there were any direct loose bookmarks outside subfolders, add a card for them
    if (looseLinks.length > 0) {
      folderCards.unshift({
        id: otherBookmarks.id,
        title: otherBookmarks.title || 'Other Bookmarks',
        bookmarks: looseLinks
      });
    }
  }

  // Reorder folder cards according to saved order
  const savedOrder = getSavedCardsOrder();
  if (savedOrder.length > 0) {
    folderCards.sort((a, b) => {
      const idxA = savedOrder.indexOf(a.id);
      const idxB = savedOrder.indexOf(b.id);
      if (idxA === -1 && idxB === -1) return 0;
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
  }

  // Flatten all bookmarks for live fuzzy bookmark search
  indexAllBookmarks(tree);

  return { quickBookmarks, folderCards };
}

function indexAllBookmarks(nodes) {
  allBookmarksCache = [];
  function traverse(list, folderPath = '') {
    for (const item of list) {
      if (item.url) {
        allBookmarksCache.push({
          id: item.id,
          title: item.title || item.url,
          url: item.url,
          folder: folderPath
        });
      }
      if (item.children) {
        traverse(item.children, folderPath ? `${folderPath} > ${item.title}` : item.title);
      }
    }
  }
  traverse(nodes);
}

export function getAllSearchableBookmarks() {
  return allBookmarksCache;
}

export function getFaviconUrl(pageUrl) {
  try {
    return `/_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=32`;
  } catch (e) {
    return '';
  }
}

export function getSavedEmoji(folderId) {
  return localStorage.getItem(`tabmax_emoji_${folderId}`) || '📁';
}

export function saveEmoji(folderId, emoji) {
  localStorage.setItem(`tabmax_emoji_${folderId}`, emoji);
}

export function getSavedCardsOrder() {
  try {
    const raw = localStorage.getItem('tabmax_cards_order');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveCardsOrder(orderArray) {
  localStorage.setItem('tabmax_cards_order', JSON.stringify(orderArray));
}

export function getCollapsedFolders() {
  try {
    const raw = localStorage.getItem('tabmax_collapsed_folders');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function toggleFolderCollapsed(folderId) {
  const collapsed = getCollapsedFolders();
  const index = collapsed.indexOf(folderId);
  let isNowCollapsed = false;
  if (index === -1) {
    collapsed.push(folderId);
    isNowCollapsed = true;
  } else {
    collapsed.splice(index, 1);
    isNowCollapsed = false;
  }
  localStorage.setItem('tabmax_collapsed_folders', JSON.stringify(collapsed));
  return isNowCollapsed;
}

export function getRootIds() {
  return {
    bookmarkBarId: rootBookmarkBarId,
    otherBookmarksId: rootOtherBookmarksId
  };
}

// Full Browser-Level Bookmarks CRUD (Real-Time Sync with Chrome)
export async function createFolder(title, parentId = null) {
  if (!chrome.bookmarks) return;
  const targetParent = parentId || rootOtherBookmarksId;
  return await chrome.bookmarks.create({
    parentId: targetParent,
    title: title.trim() || 'New Folder'
  });
}

export async function renameFolder(folderId, newTitle) {
  if (!chrome.bookmarks) return;
  return await chrome.bookmarks.update(folderId, {
    title: newTitle.trim() || 'Untitled Folder'
  });
}

export async function deleteFolder(folderId) {
  if (!chrome.bookmarks) return;
  try {
    const raw = localStorage.getItem('tabmax_folder_modes');
    if (raw) {
      const all = JSON.parse(raw);
      if (all[folderId]) {
        delete all[folderId];
        localStorage.setItem('tabmax_folder_modes', JSON.stringify(all));
      }
    }
    const rawRows = localStorage.getItem('tabmax_folder_rows');
    if (rawRows) {
      let rows = JSON.parse(rawRows);
      rows = rows.map(r => r.filter(item => (item.id || item) !== folderId)).filter(r => r.length > 0);
      localStorage.setItem('tabmax_folder_rows', JSON.stringify(rows));
      saveCardsOrder(rows.flat().map(item => item.id || item));
    }
  } catch (_) {}
  return await chrome.bookmarks.removeTree(folderId);
}

export async function createBookmark(parentId, title, url) {
  if (!chrome.bookmarks) return;
  let validUrl = url.trim();
  if (!validUrl.startsWith('http://') && !validUrl.startsWith('https://') && !validUrl.startsWith('chrome://')) {
    validUrl = 'https://' + validUrl;
  }
  return await chrome.bookmarks.create({
    parentId: parentId,
    title: title.trim() || validUrl,
    url: validUrl
  });
}

export async function updateBookmark(bookmarkId, newTitle, newUrl) {
  if (!chrome.bookmarks) return;
  let validUrl = newUrl.trim();
  if (!validUrl.startsWith('http://') && !validUrl.startsWith('https://') && !validUrl.startsWith('chrome://')) {
    validUrl = 'https://' + validUrl;
  }
  return await chrome.bookmarks.update(bookmarkId, {
    title: newTitle.trim() || validUrl,
    url: validUrl
  });
}

export async function deleteBookmark(bookmarkId) {
  if (!chrome.bookmarks) return;
  return await chrome.bookmarks.remove(bookmarkId);
}

export async function moveBookmark(bookmarkId, folderId, newIndex) {
  if (!chrome.bookmarks) return;
  isInternalMove = true;
  try {
    await chrome.bookmarks.move(bookmarkId, {
      parentId: folderId,
      index: newIndex
    });
  } catch (err) {
    console.error('Failed to move bookmark in Chrome:', err);
  } finally {
    setTimeout(() => {
      isInternalMove = false;
    }, 250);
  }
}

export function shouldOpenInNewTab() {
  return localStorage.getItem('tabmax_open_new_tab') === 'true';
}

// Render Quick Bar
export function renderQuickBar(bookmarks, containerEl) {
  containerEl.innerHTML = '';
  if (!bookmarks || bookmarks.length === 0) {
    containerEl.style.display = 'none';
    return;
  }
  containerEl.style.display = 'flex';

  const inNewTab = shouldOpenInNewTab();

  for (const bkm of bookmarks) {
    const a = document.createElement('a');
    a.className = 'quick-pill';
    a.href = bkm.url;
    a.title = bkm.title || bkm.url;
    a.dataset.id = bkm.id;
    a.dataset.title = bkm.title || bkm.url;
    a.dataset.url = bkm.url;
    a.dataset.isQuickbarItem = 'true';
    a.draggable = false;

    if (inNewTab) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    } else {
      a.target = '_self';
    }

    // Favicon
    const icon = createFaviconElement(bkm.url, bkm.title);
    a.appendChild(icon);

    const span = document.createElement('span');
    span.textContent = bkm.title || bkm.url;
    a.appendChild(span);

    setupQuickPillReorder(a, containerEl);

    containerEl.appendChild(a);
  }
}

// Long-press & Drag Reordering for Favourites in Quick Bar & Horizontal Folders
function setupQuickPillReorder(pill, containerEl, parentFolderId = rootBookmarkBarId) {
  let longPressTimer = null;
  let isDragging = false;
  let hasDragged = false;
  let startX = 0;
  let startY = 0;
  let initialIndex = -1;

  pill.addEventListener('dragstart', (e) => e.preventDefault());

  const onPointerMove = (e) => {
    if (!isDragging) {
      if (longPressTimer) {
        const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
        if (dist > 8) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
          pill.classList.remove('long-pressing');
        }
      }
      return;
    }

    e.preventDefault();

    const target = findTargetSiblingPill(containerEl, e.clientX, e.clientY, pill);
    if (target) {
      if (target.isAfter) {
        if (target.pill.nextSibling !== pill) {
          containerEl.insertBefore(pill, target.pill.nextSibling);
        }
      } else {
        if (pill.nextSibling !== target.pill) {
          containerEl.insertBefore(pill, target.pill);
        }
      }
    }
  };

  const onPointerUp = async () => {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);

    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    pill.classList.remove('long-pressing');

    if (isDragging) {
      isDragging = false;

      pill.classList.remove('is-dragging');
      containerEl.classList.remove('is-reordering-pills');
      document.body.classList.remove('is-reordering-favourites');

      const allPills = Array.from(containerEl.querySelectorAll('.quick-pill'));
      const newIndex = allPills.indexOf(pill);

      if (newIndex !== -1 && newIndex !== initialIndex) {
        if (parentFolderId !== rootBookmarkBarId) {
          const cardObj = cachedFolderCards.find(c => c.id === parentFolderId);
          if (cardObj && cardObj.bookmarks) {
            const bkmIndex = cardObj.bookmarks.findIndex(b => b.id === pill.dataset.id);
            if (bkmIndex !== -1) {
              const [moved] = cardObj.bookmarks.splice(bkmIndex, 1);
              cardObj.bookmarks.splice(newIndex, 0, moved);
            }
          }
        }
        await moveBookmark(pill.dataset.id, parentFolderId, newIndex);
      }

      // Keep hasDragged true briefly so the following click event is swallowed
      setTimeout(() => {
        hasDragged = false;
      }, 60);
    }
  };

  pill.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return; // Only primary mouse button or touch

    startX = e.clientX;
    startY = e.clientY;
    hasDragged = false;
    const allPills = Array.from(containerEl.querySelectorAll('.quick-pill'));
    initialIndex = allPills.indexOf(pill);

    pill.classList.add('long-pressing');

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    longPressTimer = setTimeout(() => {
      isDragging = true;
      hasDragged = true;
      pill.classList.remove('long-pressing');
      pill.classList.add('is-dragging');
      containerEl.classList.add('is-reordering-pills');
      document.body.classList.add('is-reordering-favourites');

      if (navigator.vibrate) {
        try { navigator.vibrate(30); } catch (_) {}
      }
    }, 220);
  });

  pill.addEventListener('click', (e) => {
    if (hasDragged) {
      e.preventDefault();
      e.stopPropagation();
      hasDragged = false;
    }
  });
}

function findTargetSiblingPill(container, clientX, clientY, currentPill) {
  const el = document.elementFromPoint(clientX, clientY);
  const fromPoint = el ? el.closest('.quick-pill') : null;
  if (fromPoint && fromPoint !== currentPill && fromPoint.parentNode === container) {
    const rect = fromPoint.getBoundingClientRect();
    return { pill: fromPoint, isAfter: clientX > (rect.left + rect.width / 2) };
  }

  const pills = Array.from(container.querySelectorAll('.quick-pill:not(.is-dragging)'));
  if (pills.length === 0) return null;

  for (const pill of pills) {
    const rect = pill.getBoundingClientRect();
    if (clientY >= rect.top - 8 && clientY <= rect.bottom + 8) {
      if (clientX < rect.left + rect.width / 2) {
        return { pill, isAfter: false };
      }
      if (clientX <= rect.right + 8) {
        return { pill, isAfter: true };
      }
    }
  }

  const last = pills[pills.length - 1];
  const lastRect = last.getBoundingClientRect();
  if (clientY > lastRect.bottom || (clientY >= lastRect.top && clientX > lastRect.right)) {
    return { pill: last, isAfter: true };
  }

  const first = pills[0];
  const firstRect = first.getBoundingClientRect();
  if (clientY < firstRect.top || (clientY <= firstRect.bottom && clientX < firstRect.left)) {
    return { pill: first, isAfter: false };
  }

  return null;
}

// Render Folder Cards Grid with Explicit Row Architecture
export function renderCardsGrid(cards, gridEl, onEmojiClick) {
  cachedFolderCards = cards || [];
  cachedGridEl = gridEl;
  cachedOnEmojiClick = onEmojiClick;
  gridEl.innerHTML = '';

  if (!cards || cards.length === 0) {
    gridEl.innerHTML = `
      <div class="empty-card-state" style="grid-column: 1 / -1;">
        <p>No bookmark folders found inside "Other bookmarks".</p>
        <p style="margin-top: 0.5rem; font-size: 0.75rem;">Right-click anywhere on the background to create a new folder!</p>
      </div>`;
    return;
  }

  const rows = getSavedFolderRows(cards);
  const cardMap = new Map(cards.map(c => [c.id, c]));

  for (let rIdx = 0; rIdx < rows.length; rIdx++) {
    // Divider before this row (Start a new row)
    const divider = createRowDropDivider(rIdx);
    gridEl.appendChild(divider);

    // Row Container
    const rowEl = document.createElement('div');
    rowEl.className = 'folder-row';
    rowEl.dataset.rowIdx = String(rIdx);

    // 4-Column Row Track
    const trackEl = document.createElement('div');
    trackEl.className = 'folder-row-track';
    trackEl.dataset.rowIdx = String(rIdx);

    // 4 Snap Slot Guides across the 4 grid columns
    for (let c = 1; c <= 4; c++) {
      const slotGuide = document.createElement('div');
      slotGuide.className = 'grid-snap-slot';
      slotGuide.dataset.col = String(c);
      slotGuide.style.gridColumn = String(c);
      slotGuide.style.gridRow = '1';
      trackEl.appendChild(slotGuide);
    }

    for (const item of rows[rIdx]) {
      const cardId = item.id || item;
      const cardCol = typeof item.col === 'number' ? item.col : 1;
      const card = cardMap.get(cardId);
      if (!card) continue;

      const cardEl = document.createElement('div');
      cardEl.className = 'bookmark-card';
      cardEl.dataset.folderId = card.id;
      cardEl.dataset.folderTitle = card.title;
      cardEl.dataset.col = String(cardCol);
      cardEl.draggable = true;

      const span = getFolderSpan(card.id);
      cardEl.style.gridColumn = `${cardCol} / span ${span}`;
      cardEl.style.gridRow = '1';

      // 1. Header
      const header = document.createElement('div');
      header.className = 'card-header';

      const titleGroup = document.createElement('div');
      titleGroup.className = 'card-title-group';

      // Check if card is previously collapsed
      const isCollapsed = getCollapsedFolders().includes(card.id);
      if (isCollapsed) {
        cardEl.classList.add('collapsed');
      }

      // Emoji button
      const emojiBtn = document.createElement('button');
      emojiBtn.className = 'card-emoji-btn';
      emojiBtn.title = 'Click to customize folder emoji';
      emojiBtn.textContent = getSavedEmoji(card.id);
      emojiBtn.draggable = false;
      emojiBtn.onclick = (e) => {
        e.stopPropagation();
        if (onEmojiClick) onEmojiClick(card.id, card.title);
      };
      emojiBtn.addEventListener('mousedown', (e) => e.stopPropagation());

      const title = document.createElement('h3');
      title.className = 'card-title';
      title.textContent = card.title;
      title.title = card.title;

      titleGroup.appendChild(emojiBtn);
      titleGroup.appendChild(title);

      // Meta (Count + Collapse Chevron Button)
      const meta = document.createElement('div');
      meta.className = 'card-meta';

      const count = document.createElement('span');
      count.className = 'card-count';
      count.textContent = card.bookmarks.length;

      const collapseBtn = document.createElement('button');
      collapseBtn.className = 'card-collapse-btn';
      collapseBtn.type = 'button';
      collapseBtn.draggable = false;
      collapseBtn.title = isCollapsed ? 'Expand folder' : 'Collapse folder';
      collapseBtn.setAttribute('aria-label', isCollapsed ? 'Expand folder' : 'Collapse folder');
      collapseBtn.innerHTML = `
        <svg class="chevron-icon" viewBox="0 0 24 24" width="16" height="16">
          <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;

      collapseBtn.onclick = (e) => {
        e.stopPropagation();
        const nowCollapsed = toggleFolderCollapsed(card.id);
        cardEl.classList.toggle('collapsed', nowCollapsed);
        collapseBtn.title = nowCollapsed ? 'Expand folder' : 'Collapse folder';
        collapseBtn.setAttribute('aria-label', nowCollapsed ? 'Expand folder' : 'Collapse folder');
      };
      collapseBtn.addEventListener('mousedown', (e) => e.stopPropagation());

      meta.appendChild(count);
      meta.appendChild(collapseBtn);

      header.appendChild(titleGroup);
      header.appendChild(meta);
      cardEl.appendChild(header);

      // 2. Bookmarks List Body (Vertical or Horizontal based on Folder Mode)
      const body = document.createElement('div');
      body.className = 'card-body';
      renderCardBody(card, cardEl, body);

      cardEl.appendChild(body);

      // Enable Card Drag & Drop
      setupCardDragDrop(cardEl);

      trackEl.appendChild(cardEl);
    }

    // Attach Row Track Empty-Slot Drag & Drop handler
    setupRowTrackDragDrop(trackEl, rIdx);

    rowEl.appendChild(trackEl);
    gridEl.appendChild(rowEl);
  }

  // Final divider below the last row
  const bottomDivider = createRowDropDivider(rows.length);
  gridEl.appendChild(bottomDivider);
}

// Create a Row Drop Divider ("Start a new row")
function createRowDropDivider(rowIdx) {
  const divider = document.createElement('div');
  divider.className = 'row-drop-divider';
  divider.dataset.rowIdx = String(rowIdx);
  divider.innerHTML = `
    <div class="row-drop-divider-line"></div>
    <div class="row-drop-divider-badge">
      <svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
      <span>Start a new row</span>
    </div>
  `;
  setupRowDividerDragDrop(divider);
  return divider;
}

// Render Bookmarks inside Card Body (Handles Vertical vs Horizontal List modes)
function renderCardBody(card, cardEl, body) {
  body.innerHTML = '';

  const config = getFolderModeConfig(card.id);
  const isHorizontal = config.mode === 'horizontal';
  const span = config.span || '2';

  cardEl.classList.remove('folder-mode-horizontal', 'folder-span-1', 'folder-span-2', 'folder-span-3', 'folder-span-full');
  if (isHorizontal) {
    cardEl.classList.add('folder-mode-horizontal', `folder-span-${span}`);
  }

  if (card.bookmarks.length === 0) {
    body.innerHTML = `<div class="empty-card-state">Folder is empty. Right-click to add a bookmark.</div>`;
    return;
  }

  const inNewTab = shouldOpenInNewTab();

  if (isHorizontal) {
    // Mode: Horizontal List (horizontal wrapped favourite pills, draggable without drag handle)
    for (const bkm of card.bookmarks) {
      const link = document.createElement('a');
      link.className = 'quick-pill folder-pill bookmark-link';
      link.href = bkm.url;
      link.title = bkm.title || bkm.url;
      link.dataset.id = bkm.id;
      link.dataset.title = bkm.title || bkm.url;
      link.dataset.url = bkm.url;
      link.dataset.folderId = card.id;
      link.dataset.isBookmarkItem = 'true';
      link.draggable = false;

      if (inNewTab) {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      } else {
        link.target = '_self';
      }

      const icon = createFaviconElement(bkm.url, bkm.title);
      const spanEl = document.createElement('span');
      spanEl.textContent = bkm.title || bkm.url;

      link.appendChild(icon);
      link.appendChild(spanEl);
      body.appendChild(link);

      setupQuickPillReorder(link, body, card.id);
    }
  } else {
    // Mode: Vertical List (standard vertical list with drag handle)
    for (const bkm of card.bookmarks) {
      const link = document.createElement('a');
      link.className = 'bookmark-link';
      link.href = bkm.url;
      link.title = bkm.title || bkm.url;
      link.dataset.id = bkm.id;
      link.dataset.title = bkm.title || bkm.url;
      link.dataset.url = bkm.url;
      link.dataset.folderId = card.id;
      link.dataset.isBookmarkItem = 'true';

      if (inNewTab) {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      } else {
        link.target = '_self';
      }

      const icon = createFaviconElement(bkm.url, bkm.title);
      const span = document.createElement('span');
      span.className = 'bookmark-title';
      span.textContent = bkm.title || bkm.url;

      // Bookmark Drag Handle on the right corner
      const dragHandle = document.createElement('span');
      dragHandle.className = 'bookmark-drag-handle';
      dragHandle.title = 'Drag to reorder bookmark';
      dragHandle.innerHTML = `
        <svg class="icon" viewBox="0 0 24 24" width="12" height="12">
          <circle cx="9" cy="6" r="1.5" fill="currentColor"/>
          <circle cx="15" cy="6" r="1.5" fill="currentColor"/>
          <circle cx="9" cy="12" r="1.5" fill="currentColor"/>
          <circle cx="15" cy="12" r="1.5" fill="currentColor"/>
          <circle cx="9" cy="18" r="1.5" fill="currentColor"/>
          <circle cx="15" cy="18" r="1.5" fill="currentColor"/>
        </svg>`;

      link.appendChild(icon);
      link.appendChild(span);
      link.appendChild(dragHandle);
      body.appendChild(link);

      setupBookmarkDragDrop(link, dragHandle, body);
    }
  }
}

// Update Folder Card Appearance Dynamically in Place
export function updateFolderCardAppearance(folderId) {
  const cardEl = document.querySelector(`.bookmark-card[data-folder-id="${folderId}"]`);
  if (!cardEl) return;
  const bodyEl = cardEl.querySelector('.card-body');
  if (!bodyEl) return;

  const card = cachedFolderCards.find(c => c.id === folderId);
  if (!card) return;

  renderCardBody(card, cardEl, bodyEl);
}

function createFaviconElement(url, title) {
  const img = document.createElement('img');
  img.className = 'favicon-img';
  img.src = getFaviconUrl(url);
  img.alt = '';
  img.loading = 'lazy';

  // Fallback to letter avatar if favicon fails to load
  img.onerror = () => {
    const parent = img.parentNode;
    if (parent) {
      const fallback = document.createElement('div');
      fallback.className = 'favicon-fallback';
      const letter = (title || url || '?').trim().charAt(0).toUpperCase();
      fallback.textContent = letter;
      parent.replaceChild(fallback, img);
    }
  };
  return img;
}

// Drag & Drop Bookmark Reordering within Folder
function setupBookmarkDragDrop(link, dragHandle, cardBody) {
  // Prevent clicking drag handle from opening the bookmark link
  dragHandle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  // Only enable dragging on the link when cursor hovers over the drag handle
  dragHandle.addEventListener('mouseenter', () => {
    link.draggable = true;
  });

  dragHandle.addEventListener('mouseleave', () => {
    if (draggedBookmark !== link) {
      link.draggable = false;
    }
  });

  link.addEventListener('dragstart', (e) => {
    e.stopPropagation();
    draggedBookmark = link;
    link.classList.add('dragging-bookmark');
    document.body.classList.add('is-dragging-bookmark');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', link.dataset.id);
  });

  link.addEventListener('dragend', () => {
    link.draggable = false;
    link.classList.remove('dragging-bookmark');
    document.body.classList.remove('is-dragging-bookmark');
    document.querySelectorAll('.bookmark-link').forEach(el => {
      el.classList.remove('drag-over-top', 'drag-over-bottom');
    });
    draggedBookmark = null;
  });

  link.addEventListener('dragover', (e) => {
    if (!draggedBookmark || draggedBookmark === link) return;
    if (draggedBookmark.dataset.folderId !== link.dataset.folderId) return;

    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    const rect = link.getBoundingClientRect();
    const isAfter = e.clientY > (rect.top + rect.height / 2);

    link.classList.toggle('drag-over-top', !isAfter);
    link.classList.toggle('drag-over-bottom', isAfter);
  });

  link.addEventListener('dragleave', () => {
    link.classList.remove('drag-over-top', 'drag-over-bottom');
  });

  link.addEventListener('drop', async (e) => {
    if (!draggedBookmark || draggedBookmark === link) return;
    if (draggedBookmark.dataset.folderId !== link.dataset.folderId) return;

    e.preventDefault();
    e.stopPropagation();
    link.classList.remove('drag-over-top', 'drag-over-bottom');

    const rect = link.getBoundingClientRect();
    const isAfter = e.clientY > (rect.top + rect.height / 2);

    if (isAfter) {
      cardBody.insertBefore(draggedBookmark, link.nextSibling);
    } else {
      cardBody.insertBefore(draggedBookmark, link);
    }

    const allLinks = Array.from(cardBody.querySelectorAll('.bookmark-link'));
    const newIndex = allLinks.indexOf(draggedBookmark);
    const folderId = draggedBookmark.dataset.folderId;

    const cardObj = cachedFolderCards.find(c => c.id === folderId);
    if (cardObj && cardObj.bookmarks) {
      const bkmIndex = cardObj.bookmarks.findIndex(b => b.id === draggedBookmark.dataset.id);
      if (bkmIndex !== -1 && newIndex !== -1) {
        const [moved] = cardObj.bookmarks.splice(bkmIndex, 1);
        cardObj.bookmarks.splice(newIndex, 0, moved);
      }
    }

    await moveBookmark(draggedBookmark.dataset.id, folderId, newIndex);
  });
}

// Drag & Drop Card Reordering
let draggedCard = null;
let floatingDragCard = null;
let cardDragOffsetX = 0;
let cardDragOffsetY = 0;
let draggedCardHeight = 46;
let draggedCardIsCollapsed = false;

const emptyDragImg = new Image();
emptyDragImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

function onWindowCardDragOver(e) {
  if (!floatingDragCard) return;
  if (e.clientX === 0 && e.clientY === 0) return;
  const x = e.clientX - cardDragOffsetX;
  const y = e.clientY - cardDragOffsetY;
  floatingDragCard.style.transform = `translate3d(${x}px, ${y}px, 0)`;
}

function cleanupDragState() {
  if (floatingDragCard) {
    floatingDragCard.remove();
    floatingDragCard = null;
  }
  window.removeEventListener('dragover', onWindowCardDragOver, { capture: true });
  document.body.classList.remove('is-dragging-card');
  document.body.style.removeProperty('--dragged-card-height');
  document.querySelectorAll('.bookmark-card').forEach(c => {
    c.classList.remove('drag-over', 'dragging');
  });
  document.querySelectorAll('.grid-ghost-slot').forEach(g => g.remove());
  document.querySelectorAll('.row-drop-divider').forEach(d => d.classList.remove('drag-over'));
  draggedCard = null;
}

// Calculate the 1-based target column slot from pointer X within track
function getDropColumn(e, trackEl, draggedSpan) {
  const rect = trackEl.getBoundingClientRect();
  const relX = e.clientX - rect.left;
  const trackWidth = rect.width;
  if (trackWidth <= 0) return 1;

  const cs = window.getComputedStyle(trackEl);
  const gap = parseFloat(cs.columnGap || cs.gap) || 16;
  const colWidth = (trackWidth - 3 * gap) / 4;
  const colSlotWidth = colWidth + gap;

  let rawCol = Math.floor(relX / colSlotWidth) + 1;
  rawCol = Math.max(1, Math.min(4, rawCol));

  const maxStartCol = Math.max(1, 4 - draggedSpan + 1);
  return Math.min(rawCol, maxStartCol);
}

function setupCardDragDrop(cardEl) {
  cardEl.addEventListener('dragstart', (e) => {
    // If dragging a bookmark inside the card or interactive buttons, do NOT drag the card
    if (draggedBookmark || e.target.closest('.bookmark-link') || e.target.closest('.bookmark-drag-handle') || e.target.closest('button')) {
      return;
    }
    draggedCard = cardEl;
    document.body.classList.add('is-dragging-card');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', cardEl.dataset.folderId);

    // Suppress Chromium's native drag ghost which applies a radial vignette on large elements
    try {
      e.dataTransfer.setDragImage(emptyDragImg, 0, 0);
    } catch (_) {}

    // Create a GPU-accelerated floating preview showing the entire card at uniform 50% opacity
    const rect = cardEl.getBoundingClientRect();
    cardDragOffsetX = e.clientX - rect.left;
    cardDragOffsetY = e.clientY - rect.top;
    draggedCardHeight = rect.height > 0 ? rect.height : (cardEl.offsetHeight || 46);
    draggedCardIsCollapsed = cardEl.classList.contains('collapsed');

    // Set CSS variable so empty snap slots across the entire grid match the dragged card's height
    document.body.style.setProperty('--dragged-card-height', `${draggedCardHeight}px`);

    if (floatingDragCard) {
      floatingDragCard.remove();
    }

    floatingDragCard = cardEl.cloneNode(true);
    floatingDragCard.classList.remove('dragging', 'drag-over');
    floatingDragCard.classList.add('floating-card-drag-preview');
    floatingDragCard.style.position = 'fixed';
    floatingDragCard.style.top = '0px';
    floatingDragCard.style.left = '0px';
    floatingDragCard.style.width = `${rect.width}px`;
    floatingDragCard.style.height = `${rect.height}px`;
    floatingDragCard.style.margin = '0';
    floatingDragCard.style.opacity = '0.5';
    floatingDragCard.style.zIndex = '999999';
    floatingDragCard.style.pointerEvents = 'none';
    floatingDragCard.style.willChange = 'transform';
    floatingDragCard.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
    floatingDragCard.style.transition = 'none';

    document.body.appendChild(floatingDragCard);

    // Use capture: true so window always receives dragover even if child stops propagation
    window.addEventListener('dragover', onWindowCardDragOver, { capture: true, passive: true });

    // Remove source card from grid layout flow so its original space becomes an available snap area
    setTimeout(() => {
      if (draggedCard === cardEl) {
        cardEl.classList.add('dragging');
      }
    }, 0);
  });

  cardEl.addEventListener('dragend', () => {
    cleanupDragState();
  });

  cardEl.addEventListener('dragover', (e) => {
    if (draggedBookmark || !draggedCard || draggedCard === cardEl) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    cardEl.classList.add('drag-over');

    // Remove any ghost placeholder from the track so card highlight is clear
    const ghost = cardEl.parentElement?.querySelector('.grid-ghost-slot');
    if (ghost) ghost.remove();
  });

  cardEl.addEventListener('dragleave', (e) => {
    if (!cardEl.contains(e.relatedTarget)) {
      cardEl.classList.remove('drag-over');
    }
  });

  cardEl.addEventListener('drop', (e) => {
    if (draggedBookmark || !draggedCard || draggedCard === cardEl) return;
    e.preventDefault();
    cardEl.classList.remove('drag-over');

    const draggedFolderId = draggedCard.dataset.folderId;
    const targetFolderId = cardEl.dataset.folderId;
    const draggedSpan = getFolderSpan(draggedFolderId);

    const rows = getSavedFolderRows(cachedFolderCards);
    const targetRowIdx = rows.findIndex(r => r.some(item => item.id === targetFolderId));
    if (targetRowIdx === -1) return;

    const targetItem = rows[targetRowIdx].find(item => item.id === targetFolderId);
    const targetCol = targetItem ? targetItem.col : 1;

    // Remove dragged card from its old row
    const oldRowIdx = rows.findIndex(r => r.some(item => item.id === draggedFolderId));
    if (oldRowIdx !== -1) {
      rows[oldRowIdx] = rows[oldRowIdx].filter(item => item.id !== draggedFolderId);
    }

    // Insert dragged card at target card's column, and shift target card right
    if (targetItem) {
      targetItem.col = targetCol + draggedSpan;
    }
    rows[targetRowIdx].push({ id: draggedFolderId, col: targetCol });

    rebalanceRows(rows, targetRowIdx);
    saveFolderRows(rows);
    cleanupDragState();
    refreshCardsGrid();
  });
}

// Track Drag & Drop for empty column slots anywhere in an existing row
function setupRowTrackDragDrop(trackEl, rowIdx) {
  trackEl.addEventListener('dragover', (e) => {
    if (draggedBookmark || !draggedCard) return;

    // If mouse is directly over another card inside this track, let card dragover handle it
    const overCard = e.target.closest('.bookmark-card');
    if (overCard && overCard !== draggedCard) {
      const ghost = trackEl.querySelector('.grid-ghost-slot');
      if (ghost) ghost.remove();
      return;
    }

    const draggedFolderId = draggedCard.dataset.folderId;
    const draggedSpan = getFolderSpan(draggedFolderId);
    const targetCol = getDropColumn(e, trackEl, draggedSpan);

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // Remove card highlights inside track
    trackEl.querySelectorAll('.bookmark-card.drag-over').forEach(c => c.classList.remove('drag-over'));

    // Show dashed ghost placeholder snapped to targetCol
    let ghost = trackEl.querySelector('.grid-ghost-slot');
    if (!ghost) {
      ghost = document.createElement('div');
      ghost.className = `grid-ghost-slot folder-span-${draggedSpan === 4 ? 'full' : draggedSpan}`;
      if (draggedCardIsCollapsed) {
        ghost.classList.add('collapsed');
      }
      ghost.style.gridRow = '1';
      trackEl.appendChild(ghost);
    }
    ghost.style.height = `${draggedCardHeight}px`;
    ghost.style.gridColumn = `${targetCol} / span ${draggedSpan}`;
    ghost.dataset.targetCol = String(targetCol);
  });

  trackEl.addEventListener('dragleave', (e) => {
    if (!trackEl.contains(e.relatedTarget)) {
      const ghost = trackEl.querySelector('.grid-ghost-slot');
      if (ghost) ghost.remove();
    }
  });

  trackEl.addEventListener('drop', (e) => {
    if (draggedBookmark || !draggedCard) return;
    if (e.target.closest('.bookmark-card')) return;

    const draggedFolderId = draggedCard.dataset.folderId;
    const draggedSpan = getFolderSpan(draggedFolderId);

    const ghost = trackEl.querySelector('.grid-ghost-slot');
    const targetCol = ghost && ghost.dataset.targetCol ? parseInt(ghost.dataset.targetCol, 10) : getDropColumn(e, trackEl, draggedSpan);

    e.preventDefault();

    const rows = getSavedFolderRows(cachedFolderCards);
    const oldRowIdx = rows.findIndex(r => r.some(item => item.id === draggedFolderId));
    if (oldRowIdx !== -1) {
      rows[oldRowIdx] = rows[oldRowIdx].filter(item => item.id !== draggedFolderId);
    }

    if (!rows[rowIdx]) rows[rowIdx] = [];
    rows[rowIdx].push({ id: draggedFolderId, col: targetCol });

    rebalanceRows(rows, rowIdx);
    saveFolderRows(rows);
    cleanupDragState();
    refreshCardsGrid();
  });
}

// Divider Drag & Drop for inserting a brand new row ("Start a new row")
function setupRowDividerDragDrop(divider) {
  divider.addEventListener('dragover', (e) => {
    if (draggedBookmark || !draggedCard) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    divider.classList.add('drag-over');

    // Remove any ghost placeholder from tracks
    document.querySelectorAll('.grid-ghost-slot').forEach(g => g.remove());
  });

  divider.addEventListener('dragleave', (e) => {
    if (!divider.contains(e.relatedTarget)) {
      divider.classList.remove('drag-over');
    }
  });

  divider.addEventListener('drop', (e) => {
    if (draggedBookmark || !draggedCard) return;
    e.preventDefault();
    divider.classList.remove('drag-over');

    const draggedFolderId = draggedCard.dataset.folderId;
    let targetIdx = parseInt(divider.dataset.rowIdx, 10);
    const rows = getSavedFolderRows(cachedFolderCards);

    const oldRowIdx = rows.findIndex(r => r.some(item => item.id === draggedFolderId));
    if (oldRowIdx !== -1) {
      rows[oldRowIdx] = rows[oldRowIdx].filter(item => item.id !== draggedFolderId);
      if (rows[oldRowIdx].length === 0) {
        rows.splice(oldRowIdx, 1);
        if (oldRowIdx < targetIdx) {
          targetIdx--;
        }
      }
    }

    rows.splice(Math.max(0, Math.min(rows.length, targetIdx)), 0, [{ id: draggedFolderId, col: 1 }]);
    saveFolderRows(rows);
    cleanupDragState();
    refreshCardsGrid();
  });
}
