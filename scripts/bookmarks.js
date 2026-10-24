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

// Rebalance rows so that overlapping cards shift right and overflowing cards form a brand new row
export function rebalanceRows(rows, startIdx = 0) {
  for (let i = startIdx; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

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
    const overflowingCards = [];
    while (row.length > 1) {
      const last = row[row.length - 1];
      const lastSpan = getFolderSpan(last.id);
      if (last.col + lastSpan - 1 > 4) {
        row.pop();
        overflowingCards.unshift(last);
      } else {
        break;
      }
    }

    // Insert overflowing cards as a brand new row right below this row, rather than polluting existing rows
    if (overflowingCards.length > 0) {
      let currentCol = 1;
      overflowingCards.forEach(item => {
        item.col = currentCol;
        currentCol += getFolderSpan(item.id);
      });
      rows.splice(i + 1, 0, overflowingCards);
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
let refreshGridTimer = null;

export function refreshCardsGrid() {
  if (refreshGridTimer) {
    clearTimeout(refreshGridTimer);
    refreshGridTimer = null;
  }
  if (cachedGridEl && cachedFolderCards) {
    renderCardsGrid(cachedFolderCards, cachedGridEl, cachedOnEmojiClick);
  }
}

export function scheduleRefreshCardsGrid(delay = 260) {
  if (refreshGridTimer) {
    clearTimeout(refreshGridTimer);
  }
  refreshGridTimer = setTimeout(() => {
    refreshGridTimer = null;
    if (cachedGridEl && cachedFolderCards) {
      renderCardsGrid(cachedFolderCards, cachedGridEl, cachedOnEmojiClick);
    }
  }, delay);
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

// 16 Official Material 3 Expressive Polar Harmonic Wave Shapes (derived from Chris Sinco / m3e.c5inco.dev)
export const M3E_POLAR_SHAPES = [
  'M1.17 0L1.154 0.06L1.108 0.116L1.04 0.165L0.961 0.204L0.884 0.237L0.82 0.267L0.778 0.299L0.762 0.339L0.768 0.392L0.792 0.457L0.824 0.535L0.852 0.619L0.866 0.701L0.859 0.773L0.827 0.827L0.773 0.859L0.701 0.866L0.619 0.852L0.535 0.824L0.458 0.792L0.392 0.768L0.339 0.762L0.299 0.778L0.267 0.82L0.237 0.884L0.204 0.961L0.165 1.04L0.116 1.108L0.06 1.154L0 1.17L-0.06 1.154L-0.116 1.108L-0.165 1.04L-0.204 0.961L-0.237 0.884L-0.267 0.82L-0.299 0.778L-0.339 0.762L-0.392 0.768L-0.457 0.792L-0.535 0.824L-0.619 0.852L-0.701 0.866L-0.773 0.859L-0.827 0.827L-0.859 0.773L-0.866 0.701L-0.852 0.619L-0.824 0.535L-0.792 0.457L-0.768 0.392L-0.762 0.339L-0.778 0.299L-0.82 0.267L-0.884 0.237L-0.961 0.204L-1.04 0.165L-1.108 0.116L-1.154 0.06L-1.17 0L-1.154 -0.06L-1.108 -0.116L-1.04 -0.165L-0.961 -0.204L-0.884 -0.237L-0.82 -0.267L-0.778 -0.299L-0.762 -0.339L-0.768 -0.392L-0.792 -0.458L-0.824 -0.535L-0.852 -0.619L-0.866 -0.701L-0.859 -0.773L-0.827 -0.827L-0.773 -0.859L-0.701 -0.866L-0.619 -0.852L-0.535 -0.824L-0.458 -0.792L-0.392 -0.768L-0.339 -0.762L-0.299 -0.778L-0.267 -0.82L-0.237 -0.884L-0.204 -0.961L-0.165 -1.04L-0.116 -1.108L-0.06 -1.154L0 -1.17L0.06 -1.154L0.116 -1.108L0.165 -1.04L0.204 -0.961L0.237 -0.884L0.267 -0.82L0.299 -0.778L0.339 -0.762L0.392 -0.768L0.458 -0.792L0.535 -0.824L0.619 -0.852L0.701 -0.866L0.773 -0.859L0.827 -0.827L0.859 -0.773L0.866 -0.701L0.852 -0.619L0.824 -0.535L0.792 -0.458L0.768 -0.392L0.762 -0.339L0.778 -0.299L0.82 -0.267L0.884 -0.237L0.961 -0.204L1.04 -0.165L1.108 -0.116L1.154 -0.06Z', // 1. flower8
  'M1.075 0L1.065 0.056L1.038 0.109L0.999 0.158L0.955 0.203L0.915 0.245L0.883 0.287L0.864 0.332L0.858 0.382L0.861 0.439L0.866 0.5L0.867 0.563L0.858 0.623L0.835 0.676L0.796 0.717L0.745 0.745L0.685 0.76L0.622 0.768L0.562 0.773L0.508 0.783L0.463 0.801L0.424 0.831L0.389 0.873L0.354 0.923L0.316 0.973L0.273 1.017L0.223 1.048L0.168 1.061L0.111 1.055L0.054 1.033L0 1L-0.051 0.965L-0.098 0.934L-0.145 0.915L-0.193 0.908L-0.245 0.915L-0.302 0.929L-0.363 0.945L-0.425 0.954L-0.484 0.951L-0.537 0.931L-0.581 0.895L-0.614 0.845L-0.637 0.786L-0.654 0.726L-0.67 0.67L-0.69 0.621L-0.72 0.583L-0.76 0.552L-0.81 0.526L-0.866 0.5L-0.921 0.469L-0.969 0.431L-1.003 0.385L-1.019 0.331L-1.017 0.273L-1.001 0.213L-0.976 0.155L-0.951 0.1L-0.932 0.049L-0.925 0L-0.932 -0.049L-0.951 -0.1L-0.976 -0.155L-1.001 -0.213L-1.017 -0.273L-1.019 -0.331L-1.003 -0.385L-0.969 -0.431L-0.921 -0.469L-0.866 -0.5L-0.81 -0.526L-0.76 -0.552L-0.72 -0.583L-0.69 -0.621L-0.67 -0.67L-0.654 -0.726L-0.637 -0.786L-0.614 -0.845L-0.581 -0.895L-0.538 -0.931L-0.484 -0.951L-0.425 -0.954L-0.363 -0.945L-0.302 -0.929L-0.245 -0.915L-0.193 -0.908L-0.145 -0.915L-0.098 -0.934L-0.051 -0.965L0 -1L0.054 -1.033L0.111 -1.055L0.168 -1.061L0.223 -1.048L0.273 -1.017L0.316 -0.973L0.354 -0.923L0.389 -0.873L0.424 -0.831L0.463 -0.801L0.508 -0.783L0.562 -0.773L0.622 -0.768L0.685 -0.76L0.745 -0.745L0.796 -0.717L0.835 -0.676L0.858 -0.623L0.867 -0.563L0.866 -0.5L0.861 -0.439L0.858 -0.382L0.864 -0.332L0.883 -0.287L0.915 -0.245L0.955 -0.203L0.999 -0.158L1.038 -0.109L1.065 -0.056Z', // 2. cookie9
  'M1.12 0L1.117 0.059L1.106 0.116L1.089 0.173L1.067 0.227L1.038 0.278L1.005 0.327L0.968 0.372L0.928 0.413L0.886 0.451L0.842 0.486L0.799 0.519L0.755 0.549L0.713 0.578L0.673 0.606L0.636 0.636L0.606 0.673L0.578 0.713L0.549 0.755L0.519 0.799L0.486 0.842L0.451 0.886L0.413 0.928L0.372 0.968L0.327 1.005L0.278 1.038L0.227 1.067L0.173 1.089L0.116 1.106L0.059 1.117L0 1.12L-0.059 1.117L-0.116 1.106L-0.173 1.089L-0.227 1.067L-0.278 1.038L-0.327 1.005L-0.372 0.968L-0.413 0.928L-0.451 0.886L-0.486 0.842L-0.519 0.799L-0.549 0.755L-0.578 0.713L-0.606 0.673L-0.636 0.636L-0.673 0.606L-0.713 0.578L-0.755 0.549L-0.799 0.519L-0.842 0.486L-0.886 0.451L-0.928 0.413L-0.968 0.372L-1.005 0.327L-1.038 0.278L-1.067 0.227L-1.089 0.173L-1.106 0.116L-1.117 0.059L-1.12 0L-1.117 -0.059L-1.106 -0.116L-1.089 -0.173L-1.067 -0.227L-1.038 -0.278L-1.005 -0.327L-0.968 -0.372L-0.928 -0.413L-0.886 -0.451L-0.842 -0.486L-0.799 -0.519L-0.755 -0.549L-0.713 -0.578L-0.673 -0.606L-0.636 -0.636L-0.606 -0.673L-0.578 -0.713L-0.549 -0.755L-0.519 -0.799L-0.486 -0.842L-0.451 -0.886L-0.413 -0.928L-0.372 -0.968L-0.327 -1.005L-0.278 -1.038L-0.227 -1.067L-0.173 -1.089L-0.116 -1.106L-0.059 -1.117L0 -1.12L0.059 -1.117L0.116 -1.106L0.173 -1.089L0.227 -1.067L0.278 -1.038L0.327 -1.005L0.372 -0.968L0.413 -0.928L0.451 -0.886L0.486 -0.842L0.519 -0.799L0.549 -0.755L0.578 -0.713L0.606 -0.673L0.636 -0.636L0.673 -0.606L0.713 -0.578L0.755 -0.549L0.799 -0.519L0.842 -0.486L0.886 -0.451L0.928 -0.413L0.968 -0.372L1.005 -0.327L1.038 -0.278L1.067 -0.227L1.089 -0.173L1.106 -0.116L1.117 -0.059Z', // 3. clover4
  'M1.05 0L1.039 0.054L1.01 0.106L0.972 0.154L0.939 0.2L0.918 0.246L0.913 0.297L0.919 0.353L0.928 0.413L0.927 0.472L0.909 0.525L0.873 0.567L0.822 0.597L0.765 0.62L0.713 0.642L0.672 0.672L0.642 0.713L0.62 0.765L0.597 0.822L0.567 0.873L0.525 0.909L0.472 0.927L0.413 0.928L0.353 0.919L0.297 0.913L0.246 0.918L0.2 0.939L0.154 0.972L0.106 1.01L0.054 1.039L0 1.05L-0.054 1.039L-0.106 1.01L-0.154 0.972L-0.2 0.939L-0.246 0.918L-0.297 0.913L-0.353 0.919L-0.413 0.928L-0.472 0.927L-0.525 0.909L-0.567 0.873L-0.597 0.822L-0.62 0.765L-0.642 0.713L-0.672 0.672L-0.713 0.642L-0.765 0.62L-0.822 0.597L-0.873 0.567L-0.909 0.525L-0.927 0.472L-0.928 0.413L-0.919 0.353L-0.913 0.297L-0.918 0.246L-0.939 0.2L-0.972 0.154L-1.01 0.106L-1.039 0.054L-1.05 0L-1.039 -0.054L-1.01 -0.106L-0.972 -0.154L-0.939 -0.2L-0.918 -0.246L-0.913 -0.297L-0.919 -0.353L-0.928 -0.413L-0.927 -0.472L-0.909 -0.525L-0.873 -0.567L-0.822 -0.597L-0.765 -0.62L-0.713 -0.642L-0.672 -0.672L-0.642 -0.713L-0.62 -0.765L-0.597 -0.822L-0.567 -0.873L-0.525 -0.909L-0.472 -0.927L-0.413 -0.928L-0.353 -0.919L-0.297 -0.913L-0.246 -0.918L-0.2 -0.939L-0.154 -0.972L-0.106 -1.01L-0.054 -1.039L0 -1.05L0.054 -1.039L0.106 -1.01L0.154 -0.972L0.2 -0.939L0.246 -0.918L0.297 -0.913L0.353 -0.919L0.413 -0.928L0.472 -0.927L0.525 -0.909L0.567 -0.873L0.597 -0.822L0.62 -0.765L0.642 -0.713L0.672 -0.672L0.713 -0.642L0.765 -0.62L0.822 -0.597L0.873 -0.567L0.909 -0.525L0.927 -0.472L0.928 -0.413L0.919 -0.353L0.913 -0.297L0.918 -0.246L0.939 -0.2L0.972 -0.154L1.01 -0.106L1.039 -0.054Z', // 4. burst12
  'M1.16 0L1.153 0.06L1.132 0.119L1.099 0.174L1.056 0.225L1.006 0.27L0.951 0.309L0.895 0.344L0.84 0.374L0.79 0.403L0.746 0.431L0.709 0.46L0.68 0.494L0.657 0.532L0.64 0.576L0.627 0.627L0.616 0.684L0.603 0.745L0.588 0.809L0.567 0.873L0.54 0.935L0.505 0.992L0.463 1.04L0.414 1.078L0.358 1.103L0.299 1.115L0.237 1.114L0.174 1.099L0.113 1.074L0.055 1.04L0 1L-0.05 0.957L-0.096 0.915L-0.139 0.876L-0.179 0.843L-0.219 0.817L-0.26 0.799L-0.303 0.789L-0.35 0.787L-0.403 0.79L-0.46 0.797L-0.522 0.804L-0.588 0.809L-0.655 0.809L-0.723 0.803L-0.787 0.787L-0.846 0.762L-0.897 0.727L-0.938 0.682L-0.968 0.629L-0.986 0.569L-0.992 0.505L-0.987 0.439L-0.972 0.373L-0.951 0.309L-0.926 0.248L-0.9 0.191L-0.876 0.139L-0.857 0.09L-0.844 0.044L-0.84 0L-0.844 -0.044L-0.857 -0.09L-0.876 -0.139L-0.9 -0.191L-0.926 -0.248L-0.951 -0.309L-0.972 -0.373L-0.987 -0.439L-0.992 -0.505L-0.986 -0.569L-0.968 -0.629L-0.938 -0.682L-0.897 -0.727L-0.846 -0.762L-0.787 -0.787L-0.723 -0.803L-0.655 -0.809L-0.588 -0.809L-0.522 -0.804L-0.46 -0.797L-0.403 -0.79L-0.35 -0.787L-0.303 -0.789L-0.26 -0.799L-0.219 -0.817L-0.179 -0.843L-0.139 -0.876L-0.096 -0.915L-0.05 -0.957L0 -1L0.055 -1.04L0.113 -1.074L0.174 -1.099L0.237 -1.114L0.299 -1.115L0.358 -1.103L0.414 -1.078L0.463 -1.04L0.505 -0.992L0.54 -0.935L0.567 -0.873L0.588 -0.809L0.603 -0.745L0.616 -0.684L0.627 -0.627L0.64 -0.576L0.657 -0.532L0.68 -0.494L0.709 -0.46L0.746 -0.431L0.79 -0.403L0.84 -0.374L0.895 -0.344L0.951 -0.309L1.006 -0.27L1.056 -0.225L1.099 -0.174L1.132 -0.119L1.153 -0.06Z', // 5. flower5
  'M1.037 0L1.026 0.054L1.008 0.106L0.984 0.156L0.959 0.204L0.935 0.251L0.914 0.297L0.897 0.344L0.884 0.393L0.873 0.445L0.862 0.498L0.848 0.551L0.83 0.603L0.805 0.652L0.773 0.696L0.733 0.733L0.687 0.763L0.638 0.787L0.586 0.806L0.534 0.822L0.484 0.838L0.436 0.856L0.391 0.878L0.347 0.903L0.303 0.931L0.258 0.961L0.21 0.99L0.161 1.014L0.108 1.031L0.054 1.039L0 1.037L-0.054 1.026L-0.106 1.008L-0.156 0.984L-0.204 0.959L-0.251 0.935L-0.297 0.914L-0.344 0.897L-0.393 0.884L-0.445 0.873L-0.498 0.862L-0.551 0.848L-0.603 0.83L-0.652 0.805L-0.696 0.773L-0.733 0.733L-0.763 0.687L-0.787 0.638L-0.806 0.586L-0.822 0.534L-0.838 0.484L-0.856 0.436L-0.878 0.391L-0.903 0.347L-0.931 0.303L-0.961 0.258L-0.99 0.21L-1.014 0.161L-1.031 0.108L-1.039 0.054L-1.037 0L-1.026 -0.054L-1.008 -0.106L-0.984 -0.156L-0.959 -0.204L-0.935 -0.251L-0.914 -0.297L-0.897 -0.344L-0.884 -0.393L-0.873 -0.445L-0.862 -0.498L-0.848 -0.551L-0.83 -0.603L-0.805 -0.652L-0.773 -0.696L-0.733 -0.733L-0.687 -0.763L-0.638 -0.787L-0.586 -0.806L-0.534 -0.822L-0.484 -0.838L-0.436 -0.856L-0.391 -0.878L-0.347 -0.903L-0.303 -0.931L-0.258 -0.961L-0.21 -0.99L-0.161 -1.014L-0.108 -1.031L-0.054 -1.039L0 -1.037L0.054 -1.026L0.106 -1.008L0.156 -0.984L0.204 -0.959L0.251 -0.935L0.297 -0.914L0.344 -0.897L0.393 -0.884L0.445 -0.873L0.498 -0.862L0.551 -0.848L0.603 -0.83L0.652 -0.805L0.696 -0.773L0.733 -0.733L0.763 -0.687L0.787 -0.638L0.806 -0.586L0.822 -0.534L0.838 -0.484L0.856 -0.436L0.878 -0.391L0.903 -0.347L0.931 -0.303L0.961 -0.258L0.99 -0.21L1.014 -0.161L1.031 -0.108L1.039 -0.054Z', // 6. sunny8
  'M1.12 0L1.113 0.058L1.091 0.115L1.057 0.167L1.014 0.216L0.966 0.259L0.916 0.298L0.868 0.333L0.825 0.367L0.789 0.402L0.762 0.44L0.743 0.482L0.73 0.531L0.722 0.585L0.716 0.644L0.707 0.707L0.694 0.771L0.674 0.832L0.645 0.888L0.607 0.934L0.56 0.97L0.506 0.993L0.446 1.002L0.384 0.999L0.32 0.986L0.259 0.966L0.2 0.942L0.145 0.918L0.094 0.898L0.046 0.885L0 0.88L-0.046 0.885L-0.094 0.898L-0.145 0.918L-0.2 0.942L-0.259 0.966L-0.32 0.986L-0.384 0.999L-0.446 1.002L-0.506 0.993L-0.56 0.97L-0.607 0.934L-0.645 0.888L-0.674 0.832L-0.694 0.771L-0.707 0.707L-0.716 0.644L-0.722 0.585L-0.73 0.531L-0.743 0.482L-0.762 0.44L-0.789 0.402L-0.825 0.367L-0.868 0.333L-0.916 0.298L-0.966 0.259L-1.014 0.216L-1.057 0.167L-1.091 0.115L-1.113 0.058L-1.12 0L-1.113 -0.058L-1.091 -0.115L-1.057 -0.167L-1.014 -0.216L-0.966 -0.259L-0.916 -0.298L-0.868 -0.333L-0.825 -0.367L-0.789 -0.402L-0.762 -0.44L-0.743 -0.482L-0.73 -0.531L-0.722 -0.585L-0.716 -0.644L-0.707 -0.707L-0.694 -0.771L-0.674 -0.832L-0.645 -0.888L-0.607 -0.934L-0.56 -0.97L-0.506 -0.993L-0.446 -1.002L-0.384 -0.999L-0.32 -0.986L-0.259 -0.966L-0.2 -0.942L-0.145 -0.918L-0.094 -0.898L-0.046 -0.885L0 -0.88L0.046 -0.885L0.094 -0.898L0.145 -0.918L0.2 -0.942L0.259 -0.966L0.32 -0.986L0.384 -0.999L0.446 -1.002L0.506 -0.993L0.56 -0.97L0.607 -0.934L0.645 -0.888L0.674 -0.832L0.694 -0.771L0.707 -0.707L0.716 -0.644L0.722 -0.585L0.73 -0.531L0.743 -0.482L0.762 -0.44L0.789 -0.402L0.825 -0.367L0.868 -0.333L0.916 -0.298L0.966 -0.259L1.014 -0.216L1.057 -0.167L1.091 -0.115L1.113 -0.058Z', // 7. cookie6
  'M1.13 0L1.111 0.058L1.059 0.111L0.988 0.156L0.915 0.194L0.857 0.23L0.827 0.269L0.828 0.318L0.854 0.38L0.891 0.454L0.922 0.532L0.933 0.606L0.914 0.664L0.865 0.7L0.791 0.713L0.707 0.707L0.626 0.695L0.558 0.69L0.511 0.704L0.483 0.744L0.468 0.81L0.454 0.891L0.433 0.973L0.399 1.039L0.349 1.075L0.288 1.075L0.221 1.042L0.156 0.988L0.098 0.93L0.046 0.886L0 0.87L-0.046 0.886L-0.098 0.93L-0.156 0.988L-0.221 1.042L-0.288 1.075L-0.349 1.075L-0.399 1.039L-0.433 0.973L-0.454 0.891L-0.467 0.81L-0.483 0.744L-0.511 0.704L-0.558 0.69L-0.626 0.695L-0.707 0.707L-0.791 0.713L-0.865 0.7L-0.914 0.664L-0.933 0.606L-0.922 0.532L-0.891 0.454L-0.854 0.38L-0.828 0.318L-0.827 0.269L-0.857 0.23L-0.915 0.194L-0.988 0.156L-1.059 0.111L-1.111 0.058L-1.13 0L-1.111 -0.058L-1.059 -0.111L-0.988 -0.156L-0.915 -0.194L-0.857 -0.23L-0.827 -0.269L-0.828 -0.318L-0.854 -0.38L-0.891 -0.454L-0.922 -0.533L-0.933 -0.606L-0.914 -0.664L-0.865 -0.7L-0.791 -0.713L-0.707 -0.707L-0.626 -0.695L-0.558 -0.69L-0.511 -0.704L-0.483 -0.744L-0.468 -0.81L-0.454 -0.891L-0.433 -0.973L-0.399 -1.039L-0.349 -1.075L-0.288 -1.075L-0.221 -1.042L-0.156 -0.988L-0.098 -0.93L-0.046 -0.886L0 -0.87L0.046 -0.886L0.098 -0.93L0.156 -0.988L0.221 -1.042L0.288 -1.075L0.349 -1.075L0.399 -1.039L0.433 -0.973L0.454 -0.891L0.467 -0.81L0.483 -0.744L0.511 -0.704L0.558 -0.69L0.626 -0.695L0.707 -0.707L0.791 -0.713L0.865 -0.7L0.914 -0.664L0.933 -0.606L0.922 -0.533L0.891 -0.454L0.854 -0.38L0.828 -0.318L0.827 -0.269L0.857 -0.23L0.915 -0.194L0.988 -0.156L1.059 -0.111L1.111 -0.058Z', // 8. pastry10
  'M1.06 0L1.057 0.055L1.048 0.11L1.034 0.164L1.014 0.216L0.99 0.265L0.961 0.312L0.928 0.356L0.893 0.397L0.854 0.435L0.814 0.47L0.773 0.502L0.73 0.531L0.688 0.557L0.646 0.582L0.605 0.605L0.564 0.626L0.524 0.647L0.485 0.668L0.447 0.689L0.41 0.71L0.373 0.732L0.336 0.754L0.299 0.778L0.26 0.802L0.221 0.826L0.181 0.85L0.139 0.875L0.094 0.898L0.048 0.92L0 0.94L-0.05 0.957L-0.102 0.972L-0.156 0.982L-0.21 0.988L-0.265 0.99L-0.32 0.986L-0.375 0.977L-0.429 0.963L-0.481 0.943L-0.53 0.918L-0.577 0.888L-0.62 0.853L-0.659 0.814L-0.694 0.771L-0.725 0.725L-0.751 0.676L-0.773 0.626L-0.79 0.574L-0.804 0.522L-0.814 0.47L-0.821 0.418L-0.825 0.367L-0.827 0.317L-0.827 0.269L-0.826 0.221L-0.824 0.175L-0.823 0.13L-0.821 0.086L-0.82 0.043L-0.82 0L-0.82 -0.043L-0.821 -0.086L-0.823 -0.13L-0.824 -0.175L-0.826 -0.221L-0.827 -0.269L-0.827 -0.317L-0.825 -0.367L-0.821 -0.418L-0.814 -0.47L-0.804 -0.522L-0.79 -0.574L-0.773 -0.626L-0.751 -0.676L-0.725 -0.725L-0.694 -0.771L-0.659 -0.814L-0.62 -0.853L-0.577 -0.888L-0.53 -0.918L-0.481 -0.943L-0.429 -0.963L-0.375 -0.977L-0.32 -0.986L-0.265 -0.99L-0.21 -0.988L-0.156 -0.982L-0.102 -0.972L-0.05 -0.957L0 -0.94L0.048 -0.92L0.094 -0.898L0.139 -0.875L0.181 -0.85L0.221 -0.826L0.26 -0.802L0.299 -0.778L0.336 -0.754L0.373 -0.732L0.41 -0.71L0.447 -0.689L0.485 -0.668L0.524 -0.647L0.564 -0.626L0.605 -0.605L0.646 -0.582L0.688 -0.557L0.73 -0.531L0.773 -0.502L0.814 -0.47L0.854 -0.435L0.893 -0.397L0.928 -0.356L0.961 -0.312L0.99 -0.265L1.014 -0.216L1.034 -0.164L1.048 -0.11L1.057 -0.055Z', // 9. pebble3
  'M1.08 0L1.077 0.056L1.067 0.112L1.052 0.167L1.031 0.219L1.005 0.269L0.975 0.317L0.941 0.361L0.906 0.403L0.869 0.443L0.831 0.48L0.794 0.515L0.757 0.55L0.72 0.583L0.685 0.617L0.651 0.651L0.617 0.685L0.583 0.72L0.55 0.757L0.515 0.794L0.48 0.831L0.443 0.869L0.403 0.906L0.361 0.941L0.317 0.975L0.269 1.005L0.219 1.031L0.167 1.052L0.112 1.067L0.056 1.077L0 1.08L-0.056 1.077L-0.112 1.067L-0.167 1.052L-0.219 1.031L-0.269 1.005L-0.317 0.975L-0.361 0.941L-0.403 0.906L-0.443 0.869L-0.48 0.831L-0.515 0.794L-0.55 0.757L-0.583 0.72L-0.617 0.685L-0.651 0.651L-0.685 0.617L-0.72 0.583L-0.757 0.55L-0.794 0.515L-0.831 0.48L-0.869 0.443L-0.906 0.403L-0.941 0.361L-0.975 0.317L-1.005 0.269L-1.031 0.219L-1.052 0.167L-1.067 0.112L-1.077 0.056L-1.08 0L-1.077 -0.056L-1.067 -0.112L-1.052 -0.167L-1.031 -0.219L-1.005 -0.269L-0.975 -0.317L-0.941 -0.361L-0.906 -0.403L-0.869 -0.443L-0.831 -0.48L-0.794 -0.515L-0.757 -0.55L-0.72 -0.583L-0.685 -0.617L-0.651 -0.651L-0.617 -0.685L-0.583 -0.72L-0.55 -0.757L-0.515 -0.794L-0.48 -0.831L-0.443 -0.869L-0.403 -0.906L-0.361 -0.941L-0.317 -0.975L-0.269 -1.005L-0.219 -1.031L-0.167 -1.052L-0.112 -1.067L-0.056 -1.077L0 -1.08L0.056 -1.077L0.112 -1.067L0.167 -1.052L0.219 -1.031L0.269 -1.005L0.317 -0.975L0.361 -0.941L0.403 -0.906L0.443 -0.869L0.48 -0.831L0.515 -0.794L0.55 -0.757L0.583 -0.72L0.617 -0.685L0.651 -0.651L0.685 -0.617L0.72 -0.583L0.757 -0.55L0.794 -0.515L0.831 -0.48L0.869 -0.443L0.906 -0.403L0.941 -0.361L0.975 -0.317L1.005 -0.269L1.031 -0.219L1.052 -0.167L1.067 -0.112L1.077 -0.056Z', // 10. square4
  'M1.06 0L1.055 0.055L1.039 0.109L1.015 0.161L0.984 0.209L0.951 0.255L0.918 0.298L0.887 0.34L0.86 0.383L0.838 0.427L0.821 0.474L0.807 0.524L0.794 0.577L0.78 0.631L0.761 0.685L0.737 0.737L0.706 0.784L0.667 0.824L0.621 0.855L0.57 0.878L0.515 0.892L0.458 0.899L0.402 0.902L0.347 0.903L0.294 0.905L0.244 0.91L0.196 0.92L0.148 0.935L0.1 0.955L0.051 0.977L0 1L-0.053 1.02L-0.109 1.034L-0.165 1.04L-0.22 1.037L-0.274 1.022L-0.324 0.997L-0.37 0.964L-0.412 0.925L-0.45 0.883L-0.485 0.84L-0.519 0.8L-0.554 0.763L-0.592 0.731L-0.632 0.702L-0.677 0.677L-0.725 0.653L-0.775 0.627L-0.824 0.599L-0.87 0.565L-0.911 0.526L-0.944 0.481L-0.967 0.431L-0.981 0.376L-0.985 0.32L-0.981 0.263L-0.972 0.207L-0.961 0.152L-0.95 0.1L-0.943 0.049L-0.94 0L-0.943 -0.049L-0.95 -0.1L-0.961 -0.152L-0.972 -0.207L-0.981 -0.263L-0.985 -0.32L-0.981 -0.376L-0.967 -0.431L-0.944 -0.481L-0.911 -0.526L-0.87 -0.565L-0.824 -0.599L-0.775 -0.627L-0.725 -0.653L-0.677 -0.677L-0.632 -0.702L-0.592 -0.731L-0.554 -0.763L-0.519 -0.8L-0.485 -0.84L-0.45 -0.883L-0.412 -0.925L-0.37 -0.964L-0.324 -0.997L-0.274 -1.022L-0.22 -1.037L-0.165 -1.04L-0.109 -1.034L-0.053 -1.02L0 -1L0.051 -0.977L0.1 -0.955L0.148 -0.935L0.196 -0.92L0.244 -0.91L0.294 -0.905L0.347 -0.903L0.402 -0.902L0.458 -0.899L0.515 -0.892L0.57 -0.878L0.621 -0.855L0.667 -0.824L0.706 -0.784L0.737 -0.737L0.761 -0.685L0.78 -0.631L0.794 -0.577L0.807 -0.524L0.821 -0.474L0.838 -0.427L0.86 -0.383L0.887 -0.34L0.918 -0.298L0.951 -0.255L0.984 -0.209L1.015 -0.161L1.039 -0.109L1.055 -0.055Z', // 11. flower7
  'M1.04 0L1.025 0.054L0.99 0.104L0.956 0.151L0.94 0.2L0.947 0.254L0.963 0.313L0.968 0.371L0.947 0.422L0.902 0.46L0.849 0.49L0.806 0.523L0.783 0.569L0.774 0.627L0.763 0.687L0.735 0.735L0.687 0.763L0.627 0.774L0.569 0.783L0.523 0.806L0.49 0.849L0.46 0.902L0.422 0.947L0.371 0.968L0.313 0.963L0.254 0.947L0.2 0.94L0.151 0.956L0.104 0.99L0.054 1.025L0 1.04L-0.054 1.025L-0.104 0.99L-0.151 0.956L-0.2 0.94L-0.254 0.947L-0.313 0.963L-0.371 0.968L-0.422 0.947L-0.46 0.902L-0.49 0.849L-0.523 0.806L-0.569 0.783L-0.627 0.774L-0.687 0.763L-0.735 0.735L-0.763 0.687L-0.774 0.627L-0.783 0.569L-0.806 0.523L-0.849 0.49L-0.902 0.46L-0.947 0.422L-0.968 0.371L-0.963 0.313L-0.947 0.254L-0.94 0.2L-0.956 0.151L-0.99 0.104L-1.025 0.054L-1.04 0L-1.025 -0.054L-0.99 -0.104L-0.956 -0.151L-0.94 -0.2L-0.947 -0.254L-0.963 -0.313L-0.968 -0.371L-0.947 -0.422L-0.902 -0.46L-0.849 -0.49L-0.806 -0.523L-0.783 -0.569L-0.774 -0.627L-0.763 -0.687L-0.735 -0.735L-0.687 -0.763L-0.627 -0.774L-0.569 -0.783L-0.523 -0.806L-0.49 -0.849L-0.46 -0.902L-0.422 -0.947L-0.371 -0.968L-0.313 -0.963L-0.254 -0.947L-0.2 -0.94L-0.151 -0.956L-0.104 -0.99L-0.054 -1.025L0 -1.04L0.054 -1.025L0.104 -0.99L0.151 -0.956L0.2 -0.94L0.254 -0.947L0.313 -0.963L0.371 -0.968L0.422 -0.947L0.46 -0.902L0.49 -0.849L0.523 -0.806L0.569 -0.783L0.627 -0.774L0.687 -0.763L0.735 -0.735L0.763 -0.687L0.774 -0.627L0.783 -0.569L0.806 -0.523L0.849 -0.49L0.902 -0.46L0.947 -0.422L0.968 -0.371L0.963 -0.313L0.947 -0.254L0.94 -0.2L0.956 -0.151L0.99 -0.104L1.025 -0.054Z', // 12. burst16
  'M1.14 0L1.137 0.06L1.127 0.118L1.111 0.176L1.089 0.231L1.062 0.284L1.029 0.334L0.993 0.381L0.953 0.424L0.911 0.464L0.866 0.5L0.82 0.533L0.774 0.562L0.728 0.589L0.682 0.614L0.637 0.637L0.593 0.659L0.551 0.68L0.51 0.701L0.469 0.723L0.43 0.745L0.391 0.768L0.353 0.792L0.314 0.817L0.274 0.843L0.233 0.87L0.191 0.898L0.146 0.925L0.1 0.951L0.051 0.977L0 1L-0.053 1.021L-0.109 1.038L-0.166 1.05L-0.225 1.059L-0.284 1.062L-0.344 1.059L-0.403 1.05L-0.461 1.035L-0.517 1.014L-0.57 0.987L-0.62 0.955L-0.666 0.917L-0.708 0.874L-0.745 0.827L-0.777 0.777L-0.804 0.724L-0.827 0.669L-0.844 0.613L-0.857 0.557L-0.866 0.5L-0.871 0.444L-0.874 0.389L-0.874 0.336L-0.873 0.284L-0.87 0.233L-0.867 0.184L-0.864 0.137L-0.862 0.091L-0.861 0.045L-0.86 0L-0.861 -0.045L-0.862 -0.091L-0.864 -0.137L-0.867 -0.184L-0.87 -0.233L-0.873 -0.284L-0.874 -0.336L-0.874 -0.389L-0.871 -0.444L-0.866 -0.5L-0.857 -0.557L-0.844 -0.613L-0.827 -0.669L-0.804 -0.724L-0.777 -0.777L-0.745 -0.827L-0.708 -0.874L-0.666 -0.917L-0.62 -0.955L-0.57 -0.987L-0.517 -1.014L-0.461 -1.035L-0.403 -1.05L-0.344 -1.059L-0.284 -1.062L-0.225 -1.059L-0.166 -1.05L-0.109 -1.038L-0.053 -1.021L0 -1L0.051 -0.977L0.1 -0.951L0.146 -0.925L0.191 -0.898L0.233 -0.87L0.274 -0.843L0.314 -0.817L0.353 -0.792L0.391 -0.768L0.43 -0.745L0.469 -0.723L0.51 -0.701L0.551 -0.68L0.593 -0.659L0.637 -0.637L0.682 -0.614L0.728 -0.589L0.774 -0.562L0.82 -0.533L0.866 -0.5L0.911 -0.464L0.953 -0.424L0.993 -0.381L1.029 -0.334L1.062 -0.284L1.089 -0.231L1.111 -0.176L1.127 -0.118L1.137 -0.06Z', // 13. trefoil3
  'M1.15 0L1.141 0.06L1.115 0.117L1.075 0.17L1.023 0.218L0.966 0.259L0.907 0.295L0.851 0.327L0.803 0.357L0.764 0.389L0.736 0.425L0.719 0.467L0.711 0.516L0.709 0.574L0.709 0.638L0.707 0.707L0.7 0.778L0.685 0.846L0.659 0.907L0.622 0.958L0.575 0.996L0.519 1.018L0.456 1.024L0.39 1.016L0.323 0.995L0.259 0.966L0.198 0.933L0.143 0.901L0.092 0.874L0.045 0.856L0 0.85L-0.045 0.856L-0.092 0.874L-0.143 0.901L-0.198 0.933L-0.259 0.966L-0.323 0.995L-0.39 1.016L-0.456 1.024L-0.519 1.018L-0.575 0.996L-0.622 0.958L-0.659 0.907L-0.685 0.846L-0.7 0.778L-0.707 0.707L-0.709 0.638L-0.709 0.574L-0.711 0.516L-0.719 0.467L-0.736 0.425L-0.764 0.389L-0.803 0.357L-0.851 0.327L-0.907 0.295L-0.966 0.259L-1.023 0.218L-1.075 0.17L-1.115 0.117L-1.141 0.06L-1.15 0L-1.141 -0.06L-1.115 -0.117L-1.075 -0.17L-1.023 -0.218L-0.966 -0.259L-0.907 -0.295L-0.851 -0.327L-0.803 -0.357L-0.764 -0.389L-0.736 -0.425L-0.719 -0.467L-0.711 -0.516L-0.709 -0.574L-0.709 -0.638L-0.707 -0.707L-0.7 -0.778L-0.685 -0.846L-0.659 -0.907L-0.622 -0.958L-0.575 -0.996L-0.519 -1.018L-0.456 -1.024L-0.39 -1.016L-0.323 -0.995L-0.259 -0.966L-0.198 -0.933L-0.143 -0.901L-0.092 -0.874L-0.045 -0.856L0 -0.85L0.045 -0.856L0.092 -0.874L0.143 -0.901L0.198 -0.933L0.259 -0.966L0.323 -0.995L0.39 -1.016L0.456 -1.024L0.519 -1.018L0.575 -0.996L0.622 -0.958L0.659 -0.907L0.685 -0.846L0.7 -0.778L0.707 -0.707L0.709 -0.638L0.709 -0.574L0.711 -0.516L0.719 -0.467L0.736 -0.425L0.764 -0.389L0.803 -0.357L0.851 -0.327L0.907 -0.295L0.966 -0.259L1.023 -0.218L1.075 -0.17L1.115 -0.117L1.141 -0.06Z', // 14. flower6
  'M1 0L0.984 0.052L0.966 0.101L0.945 0.15L0.922 0.196L0.898 0.241L0.873 0.284L0.846 0.325L0.818 0.364L0.79 0.403L0.761 0.439L0.731 0.475L0.701 0.51L0.671 0.543L0.64 0.576L0.608 0.608L0.576 0.64L0.543 0.671L0.51 0.701L0.475 0.731L0.439 0.761L0.403 0.79L0.364 0.818L0.325 0.846L0.284 0.873L0.241 0.898L0.196 0.922L0.15 0.945L0.101 0.966L0.052 0.984L0 1L-0.053 1.013L-0.108 1.023L-0.163 1.03L-0.22 1.034L-0.277 1.034L-0.334 1.029L-0.392 1.021L-0.449 1.009L-0.505 0.992L-0.561 0.971L-0.614 0.946L-0.666 0.917L-0.715 0.884L-0.762 0.847L-0.806 0.806L-0.847 0.762L-0.884 0.715L-0.917 0.666L-0.946 0.614L-0.971 0.561L-0.992 0.505L-1.009 0.449L-1.021 0.392L-1.029 0.334L-1.034 0.277L-1.034 0.22L-1.03 0.163L-1.023 0.108L-1.013 0.053L-1 0L-0.984 -0.052L-0.966 -0.101L-0.945 -0.15L-0.922 -0.196L-0.898 -0.241L-0.873 -0.284L-0.846 -0.325L-0.818 -0.364L-0.79 -0.403L-0.761 -0.439L-0.731 -0.475L-0.701 -0.51L-0.671 -0.543L-0.64 -0.576L-0.608 -0.608L-0.576 -0.64L-0.543 -0.671L-0.51 -0.701L-0.475 -0.731L-0.439 -0.761L-0.403 -0.79L-0.364 -0.818L-0.325 -0.846L-0.284 -0.873L-0.241 -0.898L-0.196 -0.922L-0.15 -0.945L-0.101 -0.966L-0.052 -0.984L0 -1L0.053 -1.013L0.108 -1.023L0.163 -1.03L0.22 -1.034L0.277 -1.034L0.334 -1.029L0.392 -1.021L0.449 -1.009L0.505 -0.992L0.561 -0.971L0.614 -0.946L0.666 -0.917L0.715 -0.884L0.762 -0.847L0.806 -0.806L0.847 -0.762L0.884 -0.715L0.917 -0.666L0.946 -0.614L0.971 -0.561L0.992 -0.505L1.009 -0.449L1.021 -0.392L1.029 -0.334L1.034 -0.277L1.034 -0.22L1.03 -0.163L1.023 -0.108L1.013 -0.053Z', // 15. teardrop
  'M1.08 0L1.078 0.057L1.074 0.113L1.065 0.169L1.054 0.224L1.04 0.279L1.022 0.332L1.002 0.385L0.979 0.436L0.953 0.485L0.924 0.533L0.892 0.579L0.858 0.624L0.822 0.666L0.784 0.705L0.743 0.743L0.701 0.778L0.656 0.811L0.611 0.84L0.563 0.868L0.515 0.892L0.466 0.914L0.415 0.932L0.364 0.948L0.312 0.961L0.26 0.972L0.208 0.979L0.156 0.983L0.104 0.985L0.052 0.984L0 0.98L-0.051 0.973L-0.101 0.964L-0.151 0.952L-0.199 0.938L-0.247 0.922L-0.293 0.903L-0.338 0.881L-0.382 0.858L-0.424 0.833L-0.465 0.805L-0.504 0.776L-0.541 0.745L-0.577 0.713L-0.611 0.679L-0.643 0.643L-0.673 0.606L-0.701 0.568L-0.727 0.528L-0.752 0.488L-0.774 0.447L-0.794 0.404L-0.812 0.361L-0.828 0.318L-0.842 0.273L-0.853 0.229L-0.863 0.183L-0.87 0.138L-0.876 0.092L-0.879 0.046L-0.88 0L-0.879 -0.046L-0.876 -0.092L-0.87 -0.138L-0.863 -0.183L-0.853 -0.229L-0.842 -0.273L-0.828 -0.318L-0.812 -0.361L-0.794 -0.404L-0.774 -0.447L-0.752 -0.488L-0.727 -0.528L-0.701 -0.568L-0.673 -0.606L-0.643 -0.643L-0.611 -0.679L-0.577 -0.713L-0.541 -0.745L-0.504 -0.776L-0.465 -0.805L-0.424 -0.833L-0.382 -0.858L-0.338 -0.881L-0.293 -0.903L-0.247 -0.922L-0.199 -0.938L-0.151 -0.952L-0.101 -0.964L-0.051 -0.973L0 -0.98L0.052 -0.984L0.104 -0.985L0.156 -0.983L0.208 -0.979L0.26 -0.972L0.312 -0.961L0.364 -0.948L0.415 -0.932L0.466 -0.914L0.515 -0.892L0.563 -0.868L0.611 -0.84L0.656 -0.811L0.701 -0.778L0.743 -0.743L0.784 -0.705L0.822 -0.666L0.858 -0.624L0.892 -0.579L0.924 -0.533L0.953 -0.485L0.979 -0.436L1.002 -0.385L1.022 -0.332L1.04 -0.279L1.054 -0.224L1.065 -0.169L1.074 -0.113L1.078 -0.057Z'  // 16. arch
];

// Randomly assign and persist one of the 16 Material Expressive shapes per folder
export function getFolderShape(folderId) {
  const saved = localStorage.getItem(`tabmax_shape_${folderId}`);
  if (saved) return parseInt(saved, 10);

  // Pseudo-random distribution seeded by folder ID
  let h = 0x811c9dc5;
  const str = String(folderId || '');
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h = (h ^ (h >>> 15)) * 0x45d9f3b;
  h = (h ^ (h >>> 16));
  const variant = (Math.abs(h) % 16) + 1;
  localStorage.setItem(`tabmax_shape_${folderId}`, String(variant));
  return variant;
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

      // Emoji button with random Material Expressive shape variant (1..16)
      const emojiBtn = document.createElement('button');
      emojiBtn.className = 'card-emoji-btn';
      const shapeIdx = (getFolderShape(card.id) - 1) % M3E_POLAR_SHAPES.length;
      emojiBtn.dataset.shape = String(shapeIdx + 1);
      emojiBtn.title = 'Click to customize folder emoji';
      emojiBtn.innerHTML = `
        <svg class="folder-shape-bg" viewBox="-1.25 -1.25 2.5 2.5" aria-hidden="true">
          <path d="${M3E_POLAR_SHAPES[shapeIdx]}" />
        </svg>
        <span class="emoji-symbol">${getSavedEmoji(card.id)}</span>
      `;
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

let dragRafId = null;
let lastDragX = 0;
let lastDragY = 0;

function onWindowCardDragOver(e) {
  if (!floatingDragCard) return;
  if (e.clientX === 0 && e.clientY === 0) return;
  lastDragX = e.clientX - cardDragOffsetX;
  lastDragY = e.clientY - cardDragOffsetY;
  if (!dragRafId) {
    dragRafId = requestAnimationFrame(() => {
      dragRafId = null;
      if (floatingDragCard) {
        floatingDragCard.style.transform = `translate3d(${lastDragX}px, ${lastDragY}px, 0)`;
      }
    });
  }
}

function cleanupDragState() {
  if (dragRafId) {
    cancelAnimationFrame(dragRafId);
    dragRafId = null;
  }
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

  const gap = 16;
  const colWidth = (trackWidth - 3 * gap) / 4;
  const colSlotWidth = colWidth + gap;

  let rawCol = Math.floor(relX / colSlotWidth) + 1;
  rawCol = Math.max(1, Math.min(4, rawCol));

  const maxStartCol = Math.max(1, 4 - draggedSpan + 1);
  return Math.min(rawCol, maxStartCol);
}

// Smooth DOM placement helper during card drop before delayed canonical grid refresh
function applyRowsToDom(rows) {
  if (!cachedGridEl) return;

  const cardMap = new Map();
  cachedGridEl.querySelectorAll('.bookmark-card').forEach(c => {
    cardMap.set(c.dataset.folderId, c);
  });

  const rowEls = Array.from(cachedGridEl.querySelectorAll('.folder-row'));

  // Ensure enough row elements exist in DOM if rows expanded
  while (rowEls.length < rows.length) {
    const rIdx = rowEls.length;
    const newRowEl = document.createElement('div');
    newRowEl.className = 'folder-row';
    newRowEl.dataset.rowIdx = String(rIdx);

    const trackEl = document.createElement('div');
    trackEl.className = 'folder-row-track';
    trackEl.dataset.rowIdx = String(rIdx);

    for (let c = 1; c <= 4; c++) {
      const slotGuide = document.createElement('div');
      slotGuide.className = 'grid-snap-slot';
      slotGuide.dataset.col = String(c);
      slotGuide.style.gridColumn = String(c);
      slotGuide.style.gridRow = '1';
      trackEl.appendChild(slotGuide);
    }

    newRowEl.appendChild(trackEl);

    const bottomDivider = cachedGridEl.querySelector('.row-drop-divider:last-child');
    if (bottomDivider) {
      cachedGridEl.insertBefore(newRowEl, bottomDivider);
    } else {
      cachedGridEl.appendChild(newRowEl);
    }
    rowEls.push(newRowEl);
  }

  // Update card positions in tracks
  rows.forEach((row, rIdx) => {
    const rowEl = rowEls[rIdx];
    if (!rowEl) return;
    rowEl.style.display = '';
    const trackEl = rowEl.querySelector('.folder-row-track') || rowEl;
    row.forEach(item => {
      const cardEl = cardMap.get(item.id);
      if (!cardEl) return;
      cardEl.classList.remove('dragging', 'drag-over');
      cardEl.dataset.col = String(item.col);
      const span = getFolderSpan(item.id);
      cardEl.style.gridColumn = `${item.col} / span ${span}`;
      cardEl.style.gridRow = '1';
      if (cardEl.parentElement !== trackEl) {
        trackEl.appendChild(cardEl);
      }
    });
  });

  // Hide any extra rows that became empty
  for (let i = rows.length; i < rowEls.length; i++) {
    rowEls[i].style.display = 'none';
  }
}

function setupCardDragDrop(cardEl) {
  cardEl.addEventListener('dragstart', (e) => {
    // If dragging a bookmark inside the card or interactive buttons, do NOT drag the card
    if (draggedBookmark || e.target.closest('.bookmark-link') || e.target.closest('.bookmark-drag-handle') || e.target.closest('button')) {
      return;
    }
    if (refreshGridTimer) {
      clearTimeout(refreshGridTimer);
      refreshGridTimer = null;
      refreshCardsGrid();
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

    let targetRow = targetRowIdx;

    // Remove dragged card from its old row
    const oldRowIdx = rows.findIndex(r => r.some(item => item.id === draggedFolderId));
    if (oldRowIdx !== -1) {
      rows[oldRowIdx] = rows[oldRowIdx].filter(item => item.id !== draggedFolderId);
      if (rows[oldRowIdx].length === 0) {
        rows.splice(oldRowIdx, 1);
        if (oldRowIdx < targetRow) {
          targetRow--;
        }
      }
    }

    // Insert dragged card at target card's column, and shift target card right
    if (targetItem) {
      targetItem.col = targetCol + draggedSpan;
    }
    if (!rows[targetRow]) rows[targetRow] = [];
    rows[targetRow].push({ id: draggedFolderId, col: targetCol });

    rebalanceRows(rows, targetRow);
    saveFolderRows(rows);
    applyRowsToDom(rows);
    cleanupDragState();
    scheduleRefreshCardsGrid(260);
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

    // Show dashed ghost placeholder snapped to targetCol
    let ghost = trackEl.querySelector('.grid-ghost-slot');
    if (ghost && ghost.dataset.targetCol === String(targetCol)) {
      return;
    }

    // Remove card highlights inside track
    trackEl.querySelectorAll('.bookmark-card.drag-over').forEach(c => c.classList.remove('drag-over'));

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
    let targetRow = rowIdx;
    const oldRowIdx = rows.findIndex(r => r.some(item => item.id === draggedFolderId));
    if (oldRowIdx !== -1) {
      rows[oldRowIdx] = rows[oldRowIdx].filter(item => item.id !== draggedFolderId);
      if (rows[oldRowIdx].length === 0) {
        rows.splice(oldRowIdx, 1);
        if (oldRowIdx < targetRow) {
          targetRow--;
        }
      }
    }

    if (!rows[targetRow]) rows[targetRow] = [];
    rows[targetRow].push({ id: draggedFolderId, col: targetCol });

    rebalanceRows(rows, targetRow);
    saveFolderRows(rows);
    applyRowsToDom(rows);
    cleanupDragState();
    scheduleRefreshCardsGrid(260);
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
    applyRowsToDom(rows);
    cleanupDragState();
    scheduleRefreshCardsGrid(260);
  });
}
