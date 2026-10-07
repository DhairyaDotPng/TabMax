// TabMax - Settings & Multi-Theme & Emoji Picker Module
import { saveEmoji, getSavedEmoji } from './bookmarks.js';
import { getCustomEngines, saveCustomEngines } from './search.js';
import { fetchWeather } from './weather.js';

// Available palettes metadata for visual indicators
export const PALETTE_COLORS = {
  indigo: '#4050b5',
  ocean: '#006877',
  emerald: '#1e6b41',
  rose: '#9b394f',
  amber: '#7a5400',
  violet: '#684ca0'
};

export const PALETTE_NAMES = {
  indigo: 'Indigo (Default M3)',
  ocean: 'Ocean (Teal / Cyan)',
  emerald: 'Emerald (Botanical Sage)',
  rose: 'Rose (Warm Coral)',
  amber: 'Golden Amber (Honey)',
  violet: 'Violet (Lavender / Magenta)'
};

let themeStyleController = null;
let popoverThemeStyleController = null;
let paletteController = null;
let unitController = null;

// ==========================================================================
// 1. Theme, Accent & Font Management
// ==========================================================================
export function initTheme() {
  const savedStyle = localStorage.getItem('tabmax_theme_style') || 'default';
  const savedMode = localStorage.getItem('tabmax_theme_mode') || 'dark';
  const savedPalette = localStorage.getItem('tabmax_theme_palette') || 'indigo';
  const customFont = localStorage.getItem('tabmax_custom_font') || '';

  applyThemeStyle(savedStyle);
  applyThemeMode(savedMode);
  applyThemePalette(savedPalette);

  if (customFont) {
    applyFont(customFont, false);
  } else {
    resetFontToThemeDefault(savedStyle);
  }

  // Listen for OS theme changes if user opted for system
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if ((localStorage.getItem('tabmax_theme_mode') || 'system') === 'system') {
      applyThemeMode('system');
    }
  });

  setupModeButtons();
  setupThemeMenu();
}

export function applyThemeStyle(style) {
  const validStyle = style === 'm3e' ? 'm3e' : 'default';
  document.documentElement.setAttribute('data-theme-style', validStyle);
  localStorage.setItem('tabmax_theme_style', validStyle);

  // Sync settings dropdown if open
  if (themeStyleController) {
    themeStyleController.setValue(validStyle);
  }

  // Sync popover theme selector dropdown
  if (popoverThemeStyleController) {
    popoverThemeStyleController.setValue(validStyle);
  }

  // Show/Hide accent palette selector in settings based on theme
  const accentGroup = document.getElementById('settings-accent-group');
  if (accentGroup) {
    accentGroup.style.display = validStyle === 'm3e' ? 'flex' : 'none';
  }

  // Show/Hide accent section in header popover
  const popoverAccentSection = document.getElementById('popover-accent-section');
  if (popoverAccentSection) {
    popoverAccentSection.style.display = validStyle === 'm3e' ? 'block' : 'none';
  }

  // If user hasn't set an explicit custom font, switch to theme's native default font
  const savedCustomFont = localStorage.getItem('tabmax_custom_font');
  if (!savedCustomFont) {
    resetFontToThemeDefault(validStyle);
  }
}

export function applyThemeMode(mode) {
  let resolvedTheme = mode;
  if (mode === 'system') {
    resolvedTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', resolvedTheme);
  localStorage.setItem('tabmax_theme_mode', mode);

  // Update mode buttons across both settings & popover
  document.querySelectorAll('.theme-mode-btn').forEach(btn => {
    const btnMode = btn.dataset.selectMode || btn.dataset.mode;
    btn.classList.toggle('active', btnMode === mode);
  });
}

export function setupModeButtons() {
  document.querySelectorAll('.theme-mode-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const m = btn.dataset.selectMode || btn.dataset.mode;
      if (m) applyThemeMode(m);
    };
  });
}

export function applyThemePalette(palette) {
  const validPalette = PALETTE_COLORS[palette] ? palette : 'indigo';
  document.documentElement.setAttribute('data-palette', validPalette);
  localStorage.setItem('tabmax_theme_palette', validPalette);

  // Update chips in popover
  document.querySelectorAll('.palette-chip').forEach(chip => {
    const chipPalette = chip.dataset.selectPalette || chip.dataset.palette;
    chip.classList.toggle('active', chipPalette === validPalette);
  });

  // Update settings dropdown visual dot & value
  const dot = document.getElementById('custom-select-palette-dot');
  if (dot && PALETTE_COLORS[validPalette]) {
    dot.style.backgroundColor = PALETTE_COLORS[validPalette];
  }
  if (paletteController) {
    paletteController.setValue(validPalette);
  }
}

// Dynamic Google Fonts Loader & Applicator
export function applyFont(fontName, persist = true) {
  const trimmed = (fontName || '').trim();
  const currentStyle = localStorage.getItem('tabmax_theme_style') || 'default';
  if (!trimmed) {
    resetFontToThemeDefault(currentStyle);
    return;
  }

  // Dynamically load Google Font stylesheet link if not already added
  loadGoogleFont(trimmed);

  // Apply to CSS variables and document with theme fallback
  const fallback = currentStyle === 'm3e' ? 'var(--font-default-m3e)' : 'var(--font-default-shadcn)';
  const fontStack = `"${trimmed}", ${fallback}`;
  document.documentElement.style.setProperty('--font-sans', fontStack);
  document.body.style.fontFamily = fontStack;

  if (persist) {
    localStorage.setItem('tabmax_custom_font', trimmed);
  }
}

export function resetFontToThemeDefault(themeStyle) {
  localStorage.removeItem('tabmax_custom_font');
  const targetFont = themeStyle === 'm3e' ? 'var(--font-default-m3e)' : 'var(--font-default-shadcn)';
  document.documentElement.style.setProperty('--font-sans', targetFont);
  document.body.style.fontFamily = targetFont;

  const input = document.getElementById('setting-custom-font');
  if (input) {
    input.value = '';
  }

  const msg = document.getElementById('font-status-msg');
  if (msg) {
    const defaultName = themeStyle === 'm3e' ? 'Google Sans' : 'Inter';
    msg.textContent = `Using default font: ${defaultName}.`;
    msg.style.color = 'hsl(var(--muted-foreground))';
  }
}

function loadGoogleFont(fontName) {
  const sanitized = fontName.replace(/['"]/g, '').trim();
  const id = `gfont-${sanitized.toLowerCase().replace(/\s+/g, '-')}`;
  if (document.getElementById(id)) return;

  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  const encoded = encodeURIComponent(sanitized);
  link.href = `https://fonts.googleapis.com/css2?family=${encoded}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);
}

export function setupThemeMenu() {
  const menuBtn = document.getElementById('theme-menu-btn');
  const popover = document.getElementById('theme-menu-popover');
  if (!menuBtn || !popover) return;

  const currentStyle = localStorage.getItem('tabmax_theme_style') || 'default';
  popoverThemeStyleController = initCustomSelect('popover-select-theme-style', currentStyle, (val) => {
    applyThemeStyle(val);
  });

  menuBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    popover.classList.toggle('active');
  };

  popover.onclick = (e) => {
    e.stopPropagation();
  };

  // Palette chips inside popover
  popover.querySelectorAll('.palette-chip').forEach(chip => {
    chip.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const p = chip.dataset.selectPalette || chip.dataset.palette;
      if (p) applyThemePalette(p);
    };
  });

  // Close popover on click outside
  document.addEventListener('click', (e) => {
    if (!popover.contains(e.target) && !menuBtn.contains(e.target)) {
      popover.classList.remove('active');
    }
  });
}

// ==========================================================================
// 2. Custom Select Dropdown Component
// ==========================================================================
export function initCustomSelect(containerId, initialValue, onChange) {
  const container = document.getElementById(containerId);
  if (!container) return { getValue: () => initialValue, setValue: () => {} };

  const trigger = container.querySelector('.custom-select-trigger');
  const label = container.querySelector('.custom-select-label');
  const menu = container.querySelector('.custom-select-menu');
  const options = container.querySelectorAll('.custom-select-option');

  let currentValue = initialValue;

  function updateDisplay(val) {
    currentValue = val;
    options.forEach(opt => {
      const isSelected = opt.dataset.value === val;
      opt.classList.toggle('selected', isSelected);
      if (isSelected && label) {
        // Extract plain text label (ignoring dot element text)
        const textNode = Array.from(opt.childNodes).find(n => n.nodeType === Node.TEXT_NODE || n.tagName === 'SPAN');
        label.textContent = textNode ? textNode.textContent.trim() : opt.textContent.trim();
      }
    });
  }

  updateDisplay(initialValue);

  if (trigger && menu) {
    trigger.onclick = (e) => {
      e.stopPropagation();
      const isOpen = menu.classList.contains('active');
      document.querySelectorAll('.custom-select-menu.active').forEach(m => m.classList.remove('active'));
      document.querySelectorAll('.custom-select-wrapper.open').forEach(w => w.classList.remove('open'));

      if (!isOpen) {
        menu.classList.add('active');
        container.classList.add('open');
      }
    };
  }

  options.forEach(opt => {
    opt.onclick = (e) => {
      e.stopPropagation();
      const val = opt.dataset.value;
      updateDisplay(val);
      if (menu) menu.classList.remove('active');
      container.classList.remove('open');
      if (onChange) onChange(val);
    };
  });

  return {
    getValue: () => currentValue,
    setValue: (val) => updateDisplay(val)
  };
}

// Global click handler to close custom select dropdowns
document.addEventListener('click', (e) => {
  if (!e.target.closest('.custom-select-wrapper')) {
    document.querySelectorAll('.custom-select-menu.active').forEach(m => m.classList.remove('active'));
    document.querySelectorAll('.custom-select-wrapper.open').forEach(w => w.classList.remove('open'));
  }
});

// ==========================================================================
// 3. Emoji Picker Setup
// ==========================================================================
export function openEmojiPicker(folderId, folderTitle, onSaveCallback) {
  const modal = document.getElementById('emoji-modal');
  const titleEl = document.getElementById('emoji-modal-title');
  const inputEl = document.getElementById('custom-emoji-input');
  const saveBtn = document.getElementById('save-emoji-btn');
  const defaultBtn = document.getElementById('reset-emoji-btn');
  const choices = document.querySelectorAll('.emoji-choice-btn');

  titleEl.textContent = `Icon for "${folderTitle}"`;
  inputEl.value = getSavedEmoji(folderId);

  // Enforce strictly 1 emoji at all times
  inputEl.oninput = () => {
    const val = inputEl.value.trim();
    if (!val) {
      inputEl.value = '';
      return;
    }
    try {
      const segmenter = new Intl.Segmenter();
      const segments = Array.from(segmenter.segment(val));
      if (segments.length > 0) {
        inputEl.value = segments[segments.length - 1].segment;
      }
    } catch (_) {
      const chars = Array.from(val);
      inputEl.value = chars.slice(-1).join('');
    }
  };

  choices.forEach(btn => {
    btn.onclick = () => {
      inputEl.value = btn.textContent.trim();
      inputEl.focus();
    };
  });

  saveBtn.onclick = () => {
    const val = inputEl.value.trim() || '📁';
    saveEmoji(folderId, val);
    closeModal(modal);
    if (onSaveCallback) onSaveCallback(folderId, val);
  };

  defaultBtn.onclick = () => {
    saveEmoji(folderId, '📁');
    closeModal(modal);
    if (onSaveCallback) onSaveCallback(folderId, '📁');
  };

  openModal(modal);
  setTimeout(() => {
    inputEl.focus();
    inputEl.select();
  }, 50);
}

// ==========================================================================
// 4. Categorized Settings Modal Setup
// ==========================================================================
export function setupSettingsModal(onSettingsSaved) {
  const settingsBtn = document.getElementById('settings-btn');
  const settingsModal = document.getElementById('settings-modal');
  const weatherInput = document.getElementById('setting-weather-city');
  const openNewTabToggle = document.getElementById('setting-open-newtab');
  const enginesListEl = document.getElementById('custom-engines-list');
  const addEngineBtn = document.getElementById('add-engine-btn');
  const enginePrefixInput = document.getElementById('new-engine-prefix');
  const engineNameInput = document.getElementById('new-engine-name');
  const engineUrlInput = document.getElementById('new-engine-url');
  const saveSettingsBtn = document.getElementById('save-settings-btn');

  const updateWeatherBtn = document.getElementById('update-weather-btn');
  const weatherStatusMsg = document.getElementById('weather-status-msg');

  const fontInput = document.getElementById('setting-custom-font');
  const fontApplyBtn = document.getElementById('setting-font-apply-btn');
  const fontResetBtn = document.getElementById('setting-font-reset-btn');
  const fontStatusMsg = document.getElementById('font-status-msg');

  // Initialize Custom Select Controllers
  const currentStyle = localStorage.getItem('tabmax_theme_style') || 'default';
  const currentMode = localStorage.getItem('tabmax_theme_mode') || 'dark';
  const currentPalette = localStorage.getItem('tabmax_theme_palette') || 'indigo';
  const currentUnit = localStorage.getItem('tabmax_weather_unit') || 'celsius';

  themeStyleController = initCustomSelect('custom-select-theme-style', currentStyle, (val) => {
    applyThemeStyle(val);
  });

  paletteController = initCustomSelect('custom-select-palette', currentPalette, (val) => {
    applyThemePalette(val);
  });

  unitController = initCustomSelect('custom-select-unit', currentUnit, (val) => {
    localStorage.setItem('tabmax_weather_unit', val);
  });

  setupModeButtons();

  // Font customization handlers
  if (fontApplyBtn && fontInput) {
    fontApplyBtn.onclick = () => {
      const font = fontInput.value.trim();
      if (!font) {
        resetFontToThemeDefault(localStorage.getItem('tabmax_theme_style') || 'default');
        return;
      }
      applyFont(font, true);
      if (fontStatusMsg) {
        fontStatusMsg.textContent = `Applied font: "${font}"`;
        fontStatusMsg.style.color = 'hsl(var(--primary))';
        setTimeout(() => {
          if (fontStatusMsg) {
            fontStatusMsg.textContent = 'Fetches any font from Google Fonts or uses local system fonts.';
            fontStatusMsg.style.color = 'hsl(var(--muted-foreground))';
          }
        }, 3500);
      }
    };
  }

  if (fontResetBtn) {
    fontResetBtn.onclick = () => {
      const currentThemeStyle = localStorage.getItem('tabmax_theme_style') || 'default';
      resetFontToThemeDefault(currentThemeStyle);
    };
  }

  // Populate current values upon opening settings
  settingsBtn.onclick = () => {
    weatherInput.value = localStorage.getItem('tabmax_weather_city') || 'New York';
    openNewTabToggle.checked = localStorage.getItem('tabmax_open_new_tab') === 'true';

    const savedFont = localStorage.getItem('tabmax_custom_font') || '';
    if (fontInput) fontInput.value = savedFont;

    const style = localStorage.getItem('tabmax_theme_style') || 'default';
    const mode = localStorage.getItem('tabmax_theme_mode') || 'dark';
    const pal = localStorage.getItem('tabmax_theme_palette') || 'indigo';
    const unit = localStorage.getItem('tabmax_weather_unit') || 'celsius';

    if (themeStyleController) themeStyleController.setValue(style);
    applyThemeMode(mode);
    if (paletteController) paletteController.setValue(pal);
    if (unitController) unitController.setValue(unit);

    const accentGroup = document.getElementById('settings-accent-group');
    if (accentGroup) {
      accentGroup.style.display = style === 'm3e' ? 'flex' : 'none';
    }

    if (weatherStatusMsg) weatherStatusMsg.textContent = '';
    renderEnginesList(enginesListEl);
    openModal(settingsModal);
  };

  // Instant toggle for "Open bookmarks in new tab"
  openNewTabToggle.onchange = () => {
    const isChecked = openNewTabToggle.checked;
    localStorage.setItem('tabmax_open_new_tab', isChecked ? 'true' : 'false');
    if (onSettingsSaved) onSettingsSaved({ openNewTabOnly: true, openNewTab: isChecked });
  };

  // Dedicated weather update button
  if (updateWeatherBtn) {
    updateWeatherBtn.onclick = async () => {
      const city = weatherInput.value.trim() || 'New York';
      const unit = unitController ? unitController.getValue() : 'celsius';

      updateWeatherBtn.disabled = true;
      if (weatherStatusMsg) {
        weatherStatusMsg.textContent = 'Checking location...';
        weatherStatusMsg.style.color = 'hsl(var(--muted-foreground))';
      }

      const res = await fetchWeather(city, unit, true);
      updateWeatherBtn.disabled = false;

      if (res && res.error) {
        if (weatherStatusMsg) {
          weatherStatusMsg.textContent = 'City not found';
          weatherStatusMsg.style.color = 'hsl(var(--destructive))';
        }
        alert(`Could not find weather for "${city}". Please check the spelling (e.g. "London", "Tokyo", "Paris").`);
        return;
      }

      localStorage.setItem('tabmax_weather_city', city);
      localStorage.setItem('tabmax_weather_unit', unit);
      if (weatherStatusMsg) {
        weatherStatusMsg.textContent = 'Updated!';
        weatherStatusMsg.style.color = 'hsl(var(--primary))';
        setTimeout(() => {
          if (weatherStatusMsg) weatherStatusMsg.textContent = '';
        }, 3000);
      }

      if (onSettingsSaved) onSettingsSaved({ weatherUpdated: true, city, unit });
    };
  }

  // Add shortcut engine
  addEngineBtn.onclick = () => {
    let prefix = enginePrefixInput.value.trim().toLowerCase();
    const name = engineNameInput.value.trim();
    const url = engineUrlInput.value.trim();

    if (!prefix || !name || !url) {
      alert('Please fill in prefix, name, and search URL.');
      return;
    }
    if (!prefix.startsWith('/')) {
      prefix = '/' + prefix;
    }
    if (!url.includes('%s')) {
      alert('Search URL must contain %s where the search query goes (e.g. https://duckduckgo.com/?q=%s)');
      return;
    }

    const engines = getCustomEngines();
    engines[prefix] = { name, url };
    saveCustomEngines(engines);

    enginePrefixInput.value = '';
    engineNameInput.value = '';
    engineUrlInput.value = '';
    renderEnginesList(enginesListEl);
  };

  saveSettingsBtn.onclick = async () => {
    const city = weatherInput.value.trim() || 'New York';
    const unit = unitController ? unitController.getValue() : 'celsius';
    const savedCity = localStorage.getItem('tabmax_weather_city') || 'New York';
    const savedUnit = localStorage.getItem('tabmax_weather_unit') || 'celsius';

    if (city.toLowerCase() !== savedCity.toLowerCase() || unit !== savedUnit) {
      saveSettingsBtn.textContent = 'Checking location...';
      saveSettingsBtn.disabled = true;

      const res = await fetchWeather(city, unit, true);
      saveSettingsBtn.textContent = 'Done';
      saveSettingsBtn.disabled = false;

      if (res && res.error) {
        alert(`Could not find weather for "${city}". Please check the spelling.`);
        return;
      }

      localStorage.setItem('tabmax_weather_city', city);
      localStorage.setItem('tabmax_weather_unit', unit);
      if (onSettingsSaved) onSettingsSaved({ weatherUpdated: true, city, unit });
    }

    closeModal(settingsModal);
  };

  // Close modals on overlay or close button click
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.closest('.modal-close-btn')) {
        closeModal(modal);
      }
    });
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(closeModal);
    }
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderEnginesList(container) {
  const engines = getCustomEngines();
  container.innerHTML = '';

  const entries = Object.entries(engines);
  if (entries.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'settings-empty-hint';
    empty.textContent = 'No custom search shortcuts configured.';
    container.appendChild(empty);
    return;
  }

  entries.forEach(([prefix, data]) => {
    const row = document.createElement('div');
    row.className = 'settings-shortcut-item';

    row.innerHTML = `
      <div class="search-item-left">
        <span class="shortcut-tag">${escapeHtml(prefix)}</span>
        <div class="settings-shortcut-info">
          <div class="search-item-title">${escapeHtml(data.name)}</div>
          <div class="search-item-url" title="${escapeHtml(data.url)}">${escapeHtml(data.url)}</div>
        </div>
      </div>
      <button type="button" class="btn btn-secondary settings-shortcut-delete-btn" data-prefix="${escapeHtml(prefix)}">Delete</button>
    `;

    row.querySelector('.settings-shortcut-delete-btn').onclick = () => {
      delete engines[prefix];
      saveCustomEngines(engines);
      renderEnginesList(container);
    };

    container.appendChild(row);
  });
}

export function openModal(el) {
  el.classList.add('active');
}

export function closeModal(el) {
  el.classList.remove('active');
}
