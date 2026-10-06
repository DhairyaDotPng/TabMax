// TabMax - Bookmarks Module & Chrome Bookmarks CRUD

let allBookmarksCache = [];
let rootBookmarkBarId = '1';
let rootOtherBookmarksId = '2';
let draggedBookmark = null;
let isInternalMove = false;

export function isInternalBookmarkMoving() {
  return isInternalMove;
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

// Long-press & Drag Reordering for Favourites in Quick Bar
function setupQuickPillReorder(pill, containerEl) {
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
        await moveBookmark(pill.dataset.id, rootBookmarkBarId, newIndex);
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

// Render Folder Cards Grid
export function renderCardsGrid(cards, gridEl, onEmojiClick) {
  gridEl.innerHTML = '';
  if (!cards || cards.length === 0) {
    gridEl.innerHTML = `
      <div class="empty-card-state" style="grid-column: 1 / -1;">
        <p>No bookmark folders found inside "Other bookmarks".</p>
        <p style="margin-top: 0.5rem; font-size: 0.75rem;">Right-click anywhere on the background to create a new folder!</p>
      </div>`;
    return;
  }

  for (const card of cards) {
    const cardEl = document.createElement('div');
    cardEl.className = 'bookmark-card';
    cardEl.dataset.folderId = card.id;
    cardEl.dataset.folderTitle = card.title;
    cardEl.draggable = true;

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

    // 2. Bookmarks List Body
    const body = document.createElement('div');
    body.className = 'card-body';

    if (card.bookmarks.length === 0) {
      body.innerHTML = `<div class="empty-card-state">Folder is empty. Right-click to add a bookmark.</div>`;
    } else {
      const inNewTab = shouldOpenInNewTab();
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

    cardEl.appendChild(body);

    // Enable Card Drag & Drop
    setupCardDragDrop(cardEl, gridEl);

    gridEl.appendChild(cardEl);
  }
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

    await moveBookmark(draggedBookmark.dataset.id, draggedBookmark.dataset.folderId, newIndex);
  });
}

// Drag & Drop Card Reordering
let draggedCard = null;

function setupCardDragDrop(cardEl, gridEl) {
  cardEl.addEventListener('dragstart', (e) => {
    // If dragging a bookmark inside the card, do NOT drag the card
    if (draggedBookmark || e.target.closest('.bookmark-link') || e.target.closest('.bookmark-drag-handle')) {
      return;
    }
    draggedCard = cardEl;
    cardEl.classList.add('dragging');
    document.body.classList.add('is-dragging-card');
    e.dataTransfer.effectAllowed = 'move';
  });

  cardEl.addEventListener('dragend', () => {
    if (draggedCard) {
      draggedCard.classList.remove('dragging');
      draggedCard = null;
    }
    document.body.classList.remove('is-dragging-card');
    document.querySelectorAll('.bookmark-card').forEach(c => c.classList.remove('drag-over'));
    
    // Save current cards order in DOM
    const cardIds = Array.from(gridEl.querySelectorAll('.bookmark-card')).map(c => c.dataset.folderId);
    saveCardsOrder(cardIds);
  });

  cardEl.addEventListener('dragover', (e) => {
    if (draggedBookmark) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedCard && draggedCard !== cardEl) {
      cardEl.classList.add('drag-over');
    }
  });

  cardEl.addEventListener('dragleave', () => {
    cardEl.classList.remove('drag-over');
  });

  cardEl.addEventListener('drop', (e) => {
    if (draggedBookmark) return;
    e.preventDefault();
    cardEl.classList.remove('drag-over');
    if (draggedCard && draggedCard !== cardEl) {
      const allCards = Array.from(gridEl.children);
      const draggedIndex = allCards.indexOf(draggedCard);
      const targetIndex = allCards.indexOf(cardEl);

      if (draggedIndex < targetIndex) {
        gridEl.insertBefore(draggedCard, cardEl.nextSibling);
      } else {
        gridEl.insertBefore(draggedCard, cardEl);
      }
      
      const cardIds = Array.from(gridEl.querySelectorAll('.bookmark-card')).map(c => c.dataset.folderId);
      saveCardsOrder(cardIds);
    }
  });
}
