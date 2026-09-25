// TabMax - Bookmarks Module & Chrome Bookmarks CRUD

let allBookmarksCache = [];
let rootBookmarkBarId = '1';
let rootOtherBookmarksId = '2';

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

  // Flatten all bookmarks for live fuzzy search (/bkm)
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

    containerEl.appendChild(a);
  }
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

    // Emoji button
    const emojiBtn = document.createElement('button');
    emojiBtn.className = 'card-emoji-btn';
    emojiBtn.title = 'Click to customize folder emoji';
    emojiBtn.textContent = getSavedEmoji(card.id);
    emojiBtn.onclick = (e) => {
      e.stopPropagation();
      if (onEmojiClick) onEmojiClick(card.id, card.title);
    };

    const title = document.createElement('h3');
    title.className = 'card-title';
    title.textContent = card.title;
    title.title = card.title;

    titleGroup.appendChild(emojiBtn);
    titleGroup.appendChild(title);

    // Meta (Count + Drag icon)
    const meta = document.createElement('div');
    meta.className = 'card-meta';

    const count = document.createElement('span');
    count.className = 'card-count';
    count.textContent = card.bookmarks.length;

    const dragHandle = document.createElement('div');
    dragHandle.className = 'drag-handle';
    dragHandle.innerHTML = `
      <svg class="icon" viewBox="0 0 24 24" width="14" height="14">
        <circle cx="9" cy="6" r="1.5" fill="currentColor"/>
        <circle cx="15" cy="6" r="1.5" fill="currentColor"/>
        <circle cx="9" cy="12" r="1.5" fill="currentColor"/>
        <circle cx="15" cy="12" r="1.5" fill="currentColor"/>
        <circle cx="9" cy="18" r="1.5" fill="currentColor"/>
        <circle cx="15" cy="18" r="1.5" fill="currentColor"/>
      </svg>`;

    meta.appendChild(count);
    meta.appendChild(dragHandle);

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
        span.textContent = bkm.title || bkm.url;

        link.appendChild(icon);
        link.appendChild(span);
        body.appendChild(link);
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

// Drag & Drop Card Reordering
let draggedCard = null;

function setupCardDragDrop(cardEl, gridEl) {
  cardEl.addEventListener('dragstart', (e) => {
    draggedCard = cardEl;
    cardEl.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  cardEl.addEventListener('dragend', () => {
    if (draggedCard) {
      draggedCard.classList.remove('dragging');
      draggedCard = null;
    }
    document.querySelectorAll('.bookmark-card').forEach(c => c.classList.remove('drag-over'));
    
    // Save current cards order in DOM
    const cardIds = Array.from(gridEl.querySelectorAll('.bookmark-card')).map(c => c.dataset.folderId);
    saveCardsOrder(cardIds);
  });

  cardEl.addEventListener('dragover', (e) => {
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
