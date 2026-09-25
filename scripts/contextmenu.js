// TabMax - Shadcn Custom Context Menu & Bookmark Actions Module
import {
  createFolder,
  renameFolder,
  deleteFolder,
  createBookmark,
  updateBookmark,
  deleteBookmark,
  getRootIds
} from './bookmarks.js';
import { openEmojiPicker } from './settings.js';

let activeMenu = null;

export function setupContextMenu(onRefreshNeeded) {
  // Listen for right clicks across the page
  window.addEventListener('contextmenu', (e) => {
    // If clicking inside inputs or textareas, allow native text context menu
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      closeContextMenu();
      return;
    }

    e.preventDefault();
    closeContextMenu();

    const menuItems = buildContextMenuItems(e.target);
    if (menuItems.length > 0) {
      renderFloatingMenu(menuItems, e.pageX, e.pageY);
    }
  });

  // Global dismiss listeners
  window.addEventListener('click', (e) => {
    if (activeMenu && !activeMenu.contains(e.target)) {
      closeContextMenu();
    }
  });

  window.addEventListener('scroll', closeContextMenu, { passive: true });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeContextMenu();
  });

  // Setup the universal bookmark dialog modal
  setupBookmarkDialog(onRefreshNeeded);
}

function buildContextMenuItems(target) {
  const items = [];

  // 1. Right click on a bookmark link inside a card
  const bookmarkLink = target.closest('.bookmark-link');
  if (bookmarkLink) {
    const id = bookmarkLink.dataset.id;
    const title = bookmarkLink.dataset.title;
    const url = bookmarkLink.dataset.url;
    const folderId = bookmarkLink.dataset.folderId;

    items.push({
      label: 'Edit Bookmark',
      icon: `<svg class="icon" viewBox="0 0 24 24"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`,
      action: () => openEditBookmarkDialog(id, title, url)
    });
    items.push({
      label: 'Copy URL',
      icon: `<svg class="icon" viewBox="0 0 24 24"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
      action: () => navigator.clipboard.writeText(url)
    });
    items.push({
      label: 'New Bookmark in Folder',
      icon: `<svg class="icon" viewBox="0 0 24 24"><path d="M5 12h14M12 5v14"/></svg>`,
      action: () => openNewBookmarkDialog(folderId)
    });
    items.push({ separator: true });
    items.push({
      label: 'Delete Bookmark',
      icon: `<svg class="icon" viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
      destructive: true,
      action: async () => {
        if (confirm(`Delete bookmark "${title}"?`)) {
          await deleteBookmark(id);
        }
      }
    });
    return items;
  }

  // 2. Right click on a favourite pill in the Quick Bar
  const quickPill = target.closest('.quick-pill');
  if (quickPill) {
    const id = quickPill.dataset.id;
    const title = quickPill.dataset.title;
    const url = quickPill.dataset.url;
    const { bookmarkBarId } = getRootIds();

    items.push({
      label: 'Edit Favourite',
      icon: `<svg class="icon" viewBox="0 0 24 24"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`,
      action: () => openEditBookmarkDialog(id, title, url, true)
    });
    items.push({
      label: 'Copy URL',
      icon: `<svg class="icon" viewBox="0 0 24 24"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
      action: () => navigator.clipboard.writeText(url)
    });
    items.push({
      label: 'New Favourite',
      icon: `<svg class="icon" viewBox="0 0 24 24"><path d="M5 12h14M12 5v14"/></svg>`,
      action: () => openNewBookmarkDialog(bookmarkBarId, true)
    });
    items.push({ separator: true });
    items.push({
      label: 'Delete Favourite',
      icon: `<svg class="icon" viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
      destructive: true,
      action: async () => {
        if (confirm(`Remove favourite "${title}"?`)) {
          await deleteBookmark(id);
        }
      }
    });
    return items;
  }

  // 3. Right click on Quick Bar container background
  const quickBar = target.closest('#quickbar-container');
  if (quickBar) {
    const { bookmarkBarId } = getRootIds();
    items.push({
      label: 'New Favourite',
      icon: `<svg class="icon" viewBox="0 0 24 24"><path d="M5 12h14M12 5v14"/></svg>`,
      action: () => openNewBookmarkDialog(bookmarkBarId, true)
    });
    return items;
  }

  // 4. Right click on a Folder Card (header or card body)
  const card = target.closest('.bookmark-card');
  if (card) {
    const folderId = card.dataset.folderId;
    const folderTitle = card.dataset.folderTitle;

    items.push({
      label: 'New Bookmark in Folder',
      icon: `<svg class="icon" viewBox="0 0 24 24"><path d="M5 12h14M12 5v14"/></svg>`,
      action: () => openNewBookmarkDialog(folderId)
    });
    items.push({
      label: 'Rename Folder',
      icon: `<svg class="icon" viewBox="0 0 24 24"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`,
      action: () => openRenameFolderDialog(folderId, folderTitle)
    });
    items.push({
      label: 'Change Folder Emoji',
      icon: `<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></svg>`,
      action: () => {
        const emojiBtn = card.querySelector('.card-emoji-btn');
        if (emojiBtn) emojiBtn.click();
      }
    });
    items.push({ separator: true });
    items.push({
      label: 'Delete Folder',
      icon: `<svg class="icon" viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
      destructive: true,
      action: async () => {
        if (confirm(`Delete folder "${folderTitle}" and all bookmarks inside it?`)) {
          await deleteFolder(folderId);
        }
      }
    });
    return items;
  }

  // 5. Right click on main background
  const { otherBookmarksId, bookmarkBarId } = getRootIds();
  items.push({
    label: 'New Folder',
    icon: `<svg class="icon" viewBox="0 0 24 24"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/><path d="M12 11v6M9 14h6"/></svg>`,
    action: () => openNewFolderDialog(otherBookmarksId)
  });
  items.push({
    label: 'New Favourite',
    icon: `<svg class="icon" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    action: () => openNewBookmarkDialog(bookmarkBarId, true)
  });

  return items;
}

function renderFloatingMenu(items, x, y) {
  const menu = document.createElement('div');
  menu.className = 'context-menu';

  for (const item of items) {
    if (item.separator) {
      const sep = document.createElement('div');
      sep.className = 'context-separator';
      menu.appendChild(sep);
      continue;
    }

    const row = document.createElement('div');
    row.className = 'context-menu-item' + (item.destructive ? ' destructive' : '');

    const iconSpan = document.createElement('span');
    iconSpan.className = 'context-item-icon';
    iconSpan.innerHTML = item.icon || '';

    const labelSpan = document.createElement('span');
    labelSpan.className = 'context-item-label';
    labelSpan.textContent = item.label;

    row.appendChild(iconSpan);
    row.appendChild(labelSpan);

    row.addEventListener('click', (e) => {
      e.stopPropagation();
      closeContextMenu();
      item.action();
    });

    menu.appendChild(row);
  }

  document.body.appendChild(menu);
  activeMenu = menu;

  // Viewport bounds clamping
  const menuW = menu.offsetWidth || 180;
  const menuH = menu.offsetHeight || 150;
  const maxX = window.innerWidth + window.scrollX - menuW - 10;
  const maxY = window.innerHeight + window.scrollY - menuH - 10;

  menu.style.left = `${Math.min(x, maxX)}px`;
  menu.style.top = `${Math.min(y, maxY)}px`;
}

function closeContextMenu() {
  if (activeMenu) {
    activeMenu.remove();
    activeMenu = null;
  }
}

// Universal Bookmark / Folder Modal Dialog Controller
let currentDialogAction = null;

function setupBookmarkDialog(onRefreshNeeded) {
  const modal = document.getElementById('bookmark-dialog-modal');
  const closeBtn = modal.querySelector('.modal-close-btn');
  const cancelBtn = document.getElementById('dialog-cancel-btn');
  const form = document.getElementById('bookmark-dialog-form');

  closeBtn.onclick = () => modal.classList.remove('active');
  cancelBtn.onclick = () => modal.classList.remove('active');

  form.onsubmit = async (e) => {
    e.preventDefault();
    const titleVal = document.getElementById('dialog-item-title').value.trim();
    const urlVal = document.getElementById('dialog-item-url').value.trim();

    if (currentDialogAction) {
      await currentDialogAction(titleVal, urlVal);
    }
    modal.classList.remove('active');
    if (onRefreshNeeded) onRefreshNeeded();
  };
}

function openDialog({ title, titleValue = '', urlValue = '', showUrl = true, onSave }) {
  const modal = document.getElementById('bookmark-dialog-modal');
  const modalTitle = document.getElementById('bookmark-dialog-title');
  const titleInput = document.getElementById('dialog-item-title');
  const urlGroup = document.getElementById('dialog-url-group');
  const urlInput = document.getElementById('dialog-item-url');
  const submitBtn = document.getElementById('dialog-submit-btn');

  modalTitle.textContent = title;
  titleInput.value = titleValue;
  urlInput.value = urlValue;

  if (showUrl) {
    urlGroup.style.display = 'flex';
    urlInput.required = true;
  } else {
    urlGroup.style.display = 'none';
    urlInput.required = false;
  }

  submitBtn.textContent = 'Save';
  currentDialogAction = onSave;

  modal.classList.add('active');
  titleInput.focus();
  titleInput.select();
}

function openNewFolderDialog(parentId) {
  openDialog({
    title: 'New Folder',
    showUrl: false,
    onSave: async (name) => {
      await createFolder(name, parentId);
    }
  });
}

function openRenameFolderDialog(folderId, currentTitle) {
  openDialog({
    title: 'Rename Folder',
    titleValue: currentTitle,
    showUrl: false,
    onSave: async (newName) => {
      await renameFolder(folderId, newName);
    }
  });
}

function openNewBookmarkDialog(parentId, isFavourite = false) {
  openDialog({
    title: isFavourite ? 'New Favourite' : 'New Bookmark',
    showUrl: true,
    onSave: async (name, url) => {
      await createBookmark(parentId, name, url);
    }
  });
}

function openEditBookmarkDialog(bookmarkId, currentTitle, currentUrl, isFavourite = false) {
  openDialog({
    title: isFavourite ? 'Edit Favourite' : 'Edit Bookmark',
    titleValue: currentTitle,
    urlValue: currentUrl,
    showUrl: true,
    onSave: async (name, url) => {
      await updateBookmark(bookmarkId, name, url);
    }
  });
}
