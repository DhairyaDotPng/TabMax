// TabMax - Search & Commands Module
import { getAllSearchableBookmarks, getFaviconUrl } from './bookmarks.js';

const DEFAULT_ENGINES = {
  '/gh': { name: 'GitHub', url: 'https://github.com/search?q=%s' },
  '/yt': { name: 'YouTube', url: 'https://www.youtube.com/results?search_query=%s' },
  '/r':  { name: 'Reddit',  url: 'https://www.reddit.com/search/?q=%s' }
};

export function getCustomEngines() {
  try {
    const raw = localStorage.getItem('tabmax_custom_engines');
    return raw ? JSON.parse(raw) : DEFAULT_ENGINES;
  } catch (e) {
    return DEFAULT_ENGINES;
  }
}

export function saveCustomEngines(engines) {
  localStorage.setItem('tabmax_custom_engines', JSON.stringify(engines));
}

let selectedDropdownIndex = -1;
let currentResults = [];

export function setupSearch(searchInput, dropdownEl, engineBadgeEl) {
  // Input event: detect prefix & live fuzzy search
  searchInput.addEventListener('input', () => {
    const val = searchInput.value.trim();

    // Check for search engine prefix (e.g. /gh, /yt, /r)
    const engines = getCustomEngines();
    const parts = val.split(' ');
    const prefix = parts[0].toLowerCase();

    if (engines[prefix] && parts.length > 1) {
      engineBadgeEl.textContent = engines[prefix].name;
      engineBadgeEl.classList.add('active');
    } else {
      engineBadgeEl.classList.remove('active');
    }

    // /bkm live search
    if (val.toLowerCase().startsWith('/bkm')) {
      const query = val.slice(4).trim().toLowerCase();
      performBookmarkSearch(query, dropdownEl, searchInput);
    } else {
      hideDropdown(dropdownEl);
    }
  });

  // Keydown event: Arrow keys, Enter, Escape
  searchInput.addEventListener('keydown', (e) => {
    if (dropdownEl.classList.contains('active')) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigateDropdown(1, dropdownEl);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        navigateDropdown(-1, dropdownEl);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedDropdownIndex >= 0 && currentResults[selectedDropdownIndex]) {
          openUrl(currentResults[selectedDropdownIndex].url);
        } else if (currentResults.length > 0) {
          openUrl(currentResults[0].url);
        }
        return;
      }
      if (e.key === 'Escape') {
        hideDropdown(dropdownEl);
        return;
      }
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      executeSearch(searchInput.value.trim());
    }
  });

  // Global Shortcut: Cmd+K or Ctrl+K or '/' focuses search
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    } else if (e.key === '/' && document.activeElement !== searchInput && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !dropdownEl.contains(e.target)) {
      hideDropdown(dropdownEl);
    }
  });
}

function performBookmarkSearch(query, dropdownEl, searchInput) {
  const allBookmarks = getAllSearchableBookmarks();
  if (!query) {
    // Show top 8 recent/common bookmarks
    currentResults = allBookmarks.slice(0, 8);
  } else {
    currentResults = allBookmarks.filter(b => {
      return b.title.toLowerCase().includes(query) || b.url.toLowerCase().includes(query) || (b.folder && b.folder.toLowerCase().includes(query));
    }).slice(0, 10);
  }

  if (currentResults.length === 0) {
    dropdownEl.innerHTML = `<div style="padding: 0.75rem; text-align: center; color: hsl(var(--muted-foreground)); font-size: 0.85rem;">No bookmarks found for "${query}"</div>`;
    dropdownEl.classList.add('active');
    selectedDropdownIndex = -1;
    return;
  }

  dropdownEl.innerHTML = '';
  selectedDropdownIndex = 0; // select top item by default

  currentResults.forEach((bkm, idx) => {
    const item = document.createElement('a');
    item.className = 'search-item' + (idx === 0 ? ' selected' : '');
    item.href = bkm.url;

    const left = document.createElement('div');
    left.className = 'search-item-left';

    const img = document.createElement('img');
    img.className = 'favicon-img';
    img.src = getFaviconUrl(bkm.url);
    img.onerror = () => { img.style.display = 'none'; };

    const titleWrap = document.createElement('div');
    titleWrap.style.minWidth = '0';

    const title = document.createElement('div');
    title.className = 'search-item-title';
    title.textContent = bkm.title;

    const folderHint = document.createElement('div');
    folderHint.className = 'search-item-url';
    folderHint.textContent = bkm.folder ? `📁 ${bkm.folder}` : bkm.url;

    titleWrap.appendChild(title);
    titleWrap.appendChild(folderHint);

    left.appendChild(img);
    left.appendChild(titleWrap);

    const hint = document.createElement('span');
    hint.className = 'search-item-hint';
    hint.textContent = 'Jump ↵';

    item.appendChild(left);
    item.appendChild(hint);

    item.addEventListener('mouseenter', () => {
      selectedDropdownIndex = idx;
      updateDropdownSelection(dropdownEl);
    });

    item.addEventListener('click', (e) => {
      e.preventDefault();
      openUrl(bkm.url);
    });

    dropdownEl.appendChild(item);
  });

  dropdownEl.classList.add('active');
}

function navigateDropdown(direction, dropdownEl) {
  const items = dropdownEl.querySelectorAll('.search-item');
  if (items.length === 0) return;

  selectedDropdownIndex += direction;
  if (selectedDropdownIndex < 0) selectedDropdownIndex = items.length - 1;
  if (selectedDropdownIndex >= items.length) selectedDropdownIndex = 0;

  updateDropdownSelection(dropdownEl);
}

function updateDropdownSelection(dropdownEl) {
  const items = dropdownEl.querySelectorAll('.search-item');
  items.forEach((item, idx) => {
    if (idx === selectedDropdownIndex) {
      item.classList.add('selected');
      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.classList.remove('selected');
    }
  });
}

function hideDropdown(dropdownEl) {
  dropdownEl.classList.remove('active');
  dropdownEl.innerHTML = '';
  selectedDropdownIndex = -1;
  currentResults = [];
}

export function executeSearch(rawQuery) {
  if (!rawQuery) return;

  // 1. Direct navigation for /notes
  if (rawQuery.toLowerCase() === '/notes' || rawQuery.toLowerCase().startsWith('/notes ')) {
    window.location.href = 'notes.html';
    return;
  }

  // 2. Direct bookmark jump (/bkm query)
  if (rawQuery.toLowerCase().startsWith('/bkm')) {
    if (currentResults.length > 0) {
      const idx = selectedDropdownIndex >= 0 ? selectedDropdownIndex : 0;
      openUrl(currentResults[idx].url);
      return;
    }
  }

  // 3. Custom search engines (e.g. /gh, /yt, /r)
  const engines = getCustomEngines();
  const parts = rawQuery.split(' ');
  const prefix = parts[0].toLowerCase();

  if (engines[prefix]) {
    const searchTerms = parts.slice(1).join(' ').trim();
    if (searchTerms) {
      const targetUrl = engines[prefix].url.replace('%s', encodeURIComponent(searchTerms));
      openUrl(targetUrl);
      return;
    }
  }

  // 4. Default browser search engine via Manifest V3 chrome.search API
  if (chrome.search && chrome.search.query) {
    chrome.search.query({
      text: rawQuery,
      disposition: 'CURRENT_TAB'
    });
  } else {
    // Fallback if not inside extension context
    window.location.href = `https://www.google.com/search?q=${encodeURIComponent(rawQuery)}`;
  }
}

function openUrl(url) {
  window.location.href = url;
}
