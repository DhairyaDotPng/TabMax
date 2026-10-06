// TabMax - Search & Commands Module
import { getAllSearchableBookmarks, getFaviconUrl, shouldOpenInNewTab } from './bookmarks.js';

const DEFAULT_ENGINES = {
  '/git': { name: 'GitHub', url: 'https://github.com/search?q=%s' },
  '/yt':  { name: 'YouTube', url: 'https://www.youtube.com/results?search_query=%s' },
  '/r':   { name: 'Reddit',  url: 'https://www.reddit.com/search/?q=%s' }
};

export function getCustomEngines() {
  try {
    const raw = localStorage.getItem('tabmax_custom_engines');
    if (!raw) return { ...DEFAULT_ENGINES };
    const engines = JSON.parse(raw);

    // Migration: migrate /gh -> /git if found in saved engines
    if (engines['/gh'] && !engines['/git']) {
      engines['/git'] = {
        name: engines['/gh'].name || 'GitHub',
        url: engines['/gh'].url || 'https://github.com/search?q=%s'
      };
      delete engines['/gh'];
      saveCustomEngines(engines);
    }

    return engines;
  } catch (e) {
    return { ...DEFAULT_ENGINES };
  }
}

export function saveCustomEngines(engines) {
  localStorage.setItem('tabmax_custom_engines', JSON.stringify(engines));
}

// Return unified list of all available shortcuts (built-ins + default/custom engines)
export function getAllShortcuts() {
  const custom = getCustomEngines();
  const list = [
    { prefix: '/web', name: 'Web', desc: 'Search the web' },
    { prefix: '/git', name: 'GitHub', desc: 'Search GitHub repositories', url: custom['/git']?.url || 'https://github.com/search?q=%s' },
    { prefix: '/yt', name: 'YouTube', desc: 'Search YouTube videos', url: custom['/yt']?.url || 'https://www.youtube.com/results?search_query=%s' },
    { prefix: '/r', name: 'Reddit', desc: 'Search Reddit discussions', url: custom['/r']?.url || 'https://www.reddit.com/search/?q=%s' },
    { prefix: '/notes', name: 'Notes', desc: 'Open quick notes notepad', isNav: true, url: 'notes.html' }
  ];

  const builtInPrefixes = new Set(list.map(item => item.prefix));
  builtInPrefixes.add('/gh'); // treat /gh as alias to /git

  Object.entries(custom).forEach(([prefix, data]) => {
    if (!builtInPrefixes.has(prefix)) {
      list.push({
        prefix,
        name: data.name,
        desc: `Search on ${data.name}`,
        url: data.url
      });
    }
  });

  return list;
}

let activeEngine = null; // null or { prefix, name, url?, isNav? }
let selectedDropdownIndex = -1;
let currentResults = [];
let isShortcutsMode = false;

export function setupSearch(searchInput, dropdownEl, engineBadgeEl) {
  const DEFAULT_PLACEHOLDER = 'Search bookmarks, or type /web, /notes, /git, /yt...';

  function setEngineMode(engine, queryRemainder = '') {
    activeEngine = engine;
    if (engine) {
      engineBadgeEl.innerHTML = `<span>${escapeHtml(engine.name)}</span><button class="engine-badge-close" type="button" title="Remove">&times;</button>`;
      engineBadgeEl.classList.add('active');
      searchInput.placeholder = engine.isNav 
        ? 'Press Enter to open Notes...' 
        : (engine.prefix === '/web' ? 'Search the web...' : `Search ${engine.name}...`);
      searchInput.value = queryRemainder;

      const closeBtn = engineBadgeEl.querySelector('.engine-badge-close');
      if (closeBtn) {
        closeBtn.onclick = (e) => {
          e.stopPropagation();
          clearEngineMode();
        };
      }
      hideDropdown(dropdownEl);
    } else {
      clearEngineMode();
    }
  }

  function clearEngineMode() {
    activeEngine = null;
    engineBadgeEl.innerHTML = '';
    engineBadgeEl.classList.remove('active');
    searchInput.placeholder = DEFAULT_PLACEHOLDER;
    searchInput.focus();
    if (!searchInput.value.trim()) {
      showShortcutSuggestions('', dropdownEl, searchInput, setEngineMode);
    }
  }

  function selectShortcut(shortcut) {
    if (shortcut.isNav) {
      hideDropdown(dropdownEl);
      if (shortcut.url) {
        window.location.href = shortcut.url;
      }
      return;
    }
    setEngineMode(shortcut, '');
    searchInput.focus();
  }

  let isPageInitializing = true;
  setTimeout(() => {
    isPageInitializing = false;
  }, 250);

  // Ensure search input is blurred initially on page load
  if (document.activeElement === searchInput) {
    searchInput.blur();
  }

  function handleActivation() {
    if (isPageInitializing || activeEngine) return;
    const val = searchInput.value.trim();
    if (!val) {
      showShortcutSuggestions('', dropdownEl, searchInput, setEngineMode);
    } else if (val.startsWith('/')) {
      showShortcutSuggestions(val, dropdownEl, searchInput, setEngineMode);
    } else {
      performBookmarkSearch(val.toLowerCase(), dropdownEl);
    }
  }

  // Input event: instant shortcut recognition & live fuzzy bookmark search
  searchInput.addEventListener('input', () => {
    const val = searchInput.value;
    const trimmed = val.trim();

    // If an engine mode is already active, user is typing the search query
    if (activeEngine) {
      hideDropdown(dropdownEl);
      return;
    }

    // If search bar is empty, show all shortcut suggestions
    if (!trimmed) {
      showShortcutSuggestions('', dropdownEl, searchInput, setEngineMode);
      return;
    }

    const allShortcuts = getAllShortcuts();

    // Check for instant shortcut match (e.g. /web, /git, /yt, /r, /notes, or custom)
    for (const sc of allShortcuts) {
      const p = sc.prefix.toLowerCase();
      if (trimmed.toLowerCase() === p) {
        setEngineMode(sc, '');
        return;
      }
      if (val.toLowerCase().startsWith(p + ' ')) {
        const remainder = val.slice(p.length + 1);
        setEngineMode(sc, remainder);
        return;
      }
    }

    // Also support alias /gh -> /git
    if (trimmed.toLowerCase() === '/gh') {
      const gitEngine = allShortcuts.find(s => s.prefix === '/git') || { prefix: '/git', name: 'GitHub', url: 'https://github.com/search?q=%s' };
      setEngineMode(gitEngine, '');
      return;
    }
    if (val.toLowerCase().startsWith('/gh ')) {
      const gitEngine = allShortcuts.find(s => s.prefix === '/git') || { prefix: '/git', name: 'GitHub', url: 'https://github.com/search?q=%s' };
      const remainder = val.slice(4);
      setEngineMode(gitEngine, remainder);
      return;
    }

    // If query starts with '/', show filtered shortcut suggestions
    if (trimmed.startsWith('/')) {
      showShortcutSuggestions(trimmed, dropdownEl, searchInput, setEngineMode);
      return;
    }

    // Default: Live Bookmark Search!
    isShortcutsMode = false;
    dropdownEl.classList.remove('shortcuts-mode');
    performBookmarkSearch(trimmed.toLowerCase(), dropdownEl);
  });

  // Focus & Click events: display shortcut suggestions or resume current search
  searchInput.addEventListener('focus', handleActivation);
  searchInput.addEventListener('click', () => {
    isPageInitializing = false;
    if (!dropdownEl.classList.contains('active')) {
      handleActivation();
    }
  });

  // Keydown event: Arrow keys, Enter, Tab, Backspace, Escape
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
      if (e.key === 'Tab' || e.key === 'Enter') {
        if (isShortcutsMode) {
          e.preventDefault();
          const target = currentResults[selectedDropdownIndex] || currentResults[0];
          if (target) {
            selectShortcut(target);
          }
          return;
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (selectedDropdownIndex >= 0 && currentResults[selectedDropdownIndex]) {
            openUrl(currentResults[selectedDropdownIndex].url);
          } else if (currentResults.length > 0) {
            openUrl(currentResults[0].url);
          }
          return;
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        hideDropdown(dropdownEl);
        return;
      }
    }

    // Exit active engine mode on Backspace when query is empty
    if (e.key === 'Backspace' && searchInput.value === '') {
      if (activeEngine) {
        e.preventDefault();
        clearEngineMode();
        return;
      }
    }

    // Cancel active engine mode on Escape
    if (e.key === 'Escape' && activeEngine) {
      e.preventDefault();
      clearEngineMode();
      return;
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
      isPageInitializing = false;
      searchInput.focus();
      searchInput.select();
      handleActivation();
    } else if (e.key === '/' && document.activeElement !== searchInput && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      isPageInitializing = false;
      searchInput.focus();
      searchInput.select();
      handleActivation();
    }
  });

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !dropdownEl.contains(e.target) && !engineBadgeEl.contains(e.target)) {
      hideDropdown(dropdownEl);
    }
  });
}

function showShortcutSuggestions(filterText, dropdownEl, searchInput, onSelectShortcut) {
  const allShortcuts = getAllShortcuts();
  let matches = allShortcuts;

  const cleanFilter = filterText ? filterText.trim().toLowerCase() : '';
  if (cleanFilter) {
    matches = allShortcuts.filter(s => {
      const p = s.prefix.toLowerCase();
      const n = s.name.toLowerCase();
      return p.startsWith(cleanFilter) ||
             p.replace('/', '').startsWith(cleanFilter.replace('/', '')) ||
             n.includes(cleanFilter.replace('/', ''));
    });
  }

  if (matches.length === 0) {
    hideDropdown(dropdownEl);
    return;
  }

  isShortcutsMode = true;
  currentResults = matches;
  selectedDropdownIndex = 0;

  dropdownEl.classList.add('shortcuts-mode');
  dropdownEl.innerHTML = '';

  matches.forEach((shortcut, idx) => {
    const item = document.createElement('div');
    item.className = 'search-item' + (idx === 0 ? ' selected' : '');
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '-1');

    const left = document.createElement('div');
    left.className = 'search-item-left';

    const tag = document.createElement('span');
    tag.className = 'shortcut-tag';
    tag.textContent = shortcut.prefix;

    const titleWrap = document.createElement('div');
    titleWrap.style.minWidth = '0';

    const title = document.createElement('div');
    title.className = 'search-item-title';
    title.textContent = shortcut.name;

    const desc = document.createElement('div');
    desc.className = 'search-item-url';
    desc.textContent = shortcut.desc || `Search with ${shortcut.name}`;

    titleWrap.appendChild(title);
    titleWrap.appendChild(desc);

    left.appendChild(tag);
    left.appendChild(titleWrap);

    const hint = document.createElement('span');
    hint.className = 'search-item-hint';
    hint.textContent = shortcut.isNav ? 'Open ↵' : 'Select ↵';

    item.appendChild(left);
    item.appendChild(hint);

    item.addEventListener('mouseenter', () => {
      selectedDropdownIndex = idx;
      updateDropdownSelection(dropdownEl);
    });

    item.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (shortcut.isNav) {
        hideDropdown(dropdownEl);
        if (shortcut.url) window.location.href = shortcut.url;
        return;
      }
      onSelectShortcut(shortcut, '');
      searchInput.focus();
    });

    dropdownEl.appendChild(item);
  });

  dropdownEl.classList.add('active');
}

function performBookmarkSearch(query, dropdownEl) {
  const allBookmarks = getAllSearchableBookmarks();
  if (!query) {
    currentResults = allBookmarks.slice(0, 8);
  } else {
    currentResults = allBookmarks.filter(b => {
      return (b.title && b.title.toLowerCase().includes(query)) ||
             (b.url && b.url.toLowerCase().includes(query)) ||
             (b.folder && b.folder.toLowerCase().includes(query));
    }).slice(0, 10);
  }

  isShortcutsMode = false;
  dropdownEl.classList.remove('shortcuts-mode');

  if (currentResults.length === 0) {
    dropdownEl.innerHTML = `
      <div class="search-item search-fallback-item selected">
        <div class="search-item-left">
          <svg class="icon" viewBox="0 0 24 24" width="16" height="16" style="opacity: 0.7; flex-shrink: 0;">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.3-4.3"/>
          </svg>
          <div style="min-width: 0;">
            <div class="search-item-title">Search web for "${escapeHtml(query)}"</div>
            <div class="search-item-url">No bookmarks match — press Enter or /web to search</div>
          </div>
        </div>
        <span class="search-item-hint">/web ↵</span>
      </div>`;
    dropdownEl.classList.add('active');
    selectedDropdownIndex = -1;

    const fallbackItem = dropdownEl.querySelector('.search-fallback-item');
    if (fallbackItem) {
      fallbackItem.addEventListener('click', (e) => {
        e.preventDefault();
        runWebSearch(query);
      });
    }
    return;
  }

  dropdownEl.innerHTML = '';
  selectedDropdownIndex = 0;

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
    title.textContent = bkm.title || bkm.url;

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
  dropdownEl.classList.remove('shortcuts-mode');
  dropdownEl.innerHTML = '';
  selectedDropdownIndex = -1;
  currentResults = [];
  isShortcutsMode = false;
}

export function executeSearch(rawQuery) {
  // 1. If an active engine mode is selected:
  if (activeEngine) {
    const val = rawQuery.trim();
    if (activeEngine.isNav) {
      if (activeEngine.url) window.location.href = activeEngine.url;
      return;
    }
    if (activeEngine.prefix === '/web') {
      if (val) runWebSearch(val);
      return;
    }
    if (activeEngine.url) {
      if (val) {
        const targetUrl = activeEngine.url.replace('%s', encodeURIComponent(val));
        openUrl(targetUrl);
      } else {
        // Empty query opens main site
        try {
          const parsed = new URL(activeEngine.url);
          openUrl(parsed.origin);
        } catch (e) {
          // fallback
        }
      }
      return;
    }
  }

  if (!rawQuery) return;
  const val = rawQuery.trim();

  // 2. Direct navigation for /notes
  if (val.toLowerCase() === '/notes' || val.toLowerCase().startsWith('/notes ')) {
    window.location.href = 'notes.html';
    return;
  }

  // 3. Web search shortcut (/web <query>)
  if (val.toLowerCase().startsWith('/web')) {
    const webQuery = val.slice(4).trim();
    if (webQuery) {
      runWebSearch(webQuery);
    }
    return;
  }

  // 4. Custom search engines (e.g. /git, /yt, /r)
  const engines = getCustomEngines();
  const parts = val.split(' ');
  const prefix = parts[0].toLowerCase();

  // Resolve prefix (including alias /gh -> /git)
  let engine = engines[prefix];
  if (!engine && prefix === '/gh' && engines['/git']) {
    engine = engines['/git'];
  }

  if (engine) {
    const searchTerms = parts.slice(1).join(' ').trim();
    if (searchTerms) {
      const targetUrl = engine.url.replace('%s', encodeURIComponent(searchTerms));
      openUrl(targetUrl);
      return;
    }
  }

  // 5. Default: Open selected or top bookmark match
  if (currentResults.length > 0 && !isShortcutsMode) {
    const idx = selectedDropdownIndex >= 0 ? selectedDropdownIndex : 0;
    if (currentResults[idx] && currentResults[idx].url) {
      openUrl(currentResults[idx].url);
      return;
    }
  }

  // 6. Fallback: If no bookmarks matched and user hit Enter, search the web
  runWebSearch(val);
}

function runWebSearch(query) {
  const openNewTab = shouldOpenInNewTab();
  if (chrome.search && chrome.search.query) {
    chrome.search.query({
      text: query,
      disposition: openNewTab ? 'NEW_TAB' : 'CURRENT_TAB'
    });
  } else {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    if (openNewTab) {
      window.open(searchUrl, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = searchUrl;
    }
  }
}

function openUrl(url) {
  if (shouldOpenInNewTab()) {
    window.open(url, '_blank', 'noopener,noreferrer');
  } else {
    window.location.href = url;
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
