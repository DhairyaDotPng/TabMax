// TabMax - Settings & Theme & Emoji Picker Module
import { saveEmoji, getSavedEmoji } from './bookmarks.js';
import { getCustomEngines, saveCustomEngines } from './search.js';
import { fetchWeather } from './weather.js';

// Theme Management
export function initTheme() {
  const saved = localStorage.getItem('tabmax_theme');
  if (saved) {
    setTheme(saved);
  } else {
    // Detect system preference
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(prefersDark ? 'dark' : 'light');
  }

  // Listen for OS theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('tabmax_theme')) {
      setTheme(e.matches ? 'dark' : 'light');
    }
  });
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
  localStorage.setItem('tabmax_theme', next);
  return next;
}

export function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) {
    themeBtn.innerHTML = theme === 'dark' ? `
      <svg class="icon" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="4"/>
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
      </svg>` : `
      <svg class="icon" viewBox="0 0 24 24">
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
      </svg>`;
    themeBtn.title = theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
  }
}

// Emoji Picker Setup
export function openEmojiPicker(folderId, folderTitle, onSaveCallback) {
  const modal = document.getElementById('emoji-modal');
  const titleEl = document.getElementById('emoji-modal-title');
  const inputEl = document.getElementById('custom-emoji-input');
  const saveBtn = document.getElementById('save-emoji-btn');
  const defaultBtn = document.getElementById('reset-emoji-btn');
  const choices = document.querySelectorAll('.emoji-choice-btn');

  titleEl.textContent = `Icon for "${folderTitle}"`;
  inputEl.value = getSavedEmoji(folderId);

  choices.forEach(btn => {
    btn.onclick = () => {
      inputEl.value = btn.textContent;
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
}

// Settings Modal Setup
export function setupSettingsModal(onSettingsSaved) {
  const settingsBtn = document.getElementById('settings-btn');
  const settingsModal = document.getElementById('settings-modal');
  const weatherInput = document.getElementById('setting-weather-city');
  const unitSelect = document.getElementById('setting-weather-unit');
  const openNewTabToggle = document.getElementById('setting-open-newtab');
  const enginesListEl = document.getElementById('custom-engines-list');
  const addEngineBtn = document.getElementById('add-engine-btn');
  const enginePrefixInput = document.getElementById('new-engine-prefix');
  const engineNameInput = document.getElementById('new-engine-name');
  const engineUrlInput = document.getElementById('new-engine-url');
  const saveSettingsBtn = document.getElementById('save-settings-btn');

  const updateWeatherBtn = document.getElementById('update-weather-btn');
  const weatherStatusMsg = document.getElementById('weather-status-msg');

  // Populate current values
  settingsBtn.onclick = () => {
    weatherInput.value = localStorage.getItem('tabmax_weather_city') || 'New York';
    unitSelect.value = localStorage.getItem('tabmax_weather_unit') || 'celsius';
    openNewTabToggle.checked = localStorage.getItem('tabmax_open_new_tab') === 'true';
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
      const unit = unitSelect.value || 'celsius';

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
    const unit = unitSelect.value || 'celsius';
    const savedCity = localStorage.getItem('tabmax_weather_city') || 'New York';
    const savedUnit = localStorage.getItem('tabmax_weather_unit') || 'celsius';

    // Only validate weather if user actually changed city or unit
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

function renderEnginesList(container) {
  const engines = getCustomEngines();
  container.innerHTML = '';

  Object.entries(engines).forEach(([prefix, data]) => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.justifyContent = 'space-between';
    row.style.padding = '0.4rem 0.6rem';
    row.style.backgroundColor = 'hsl(var(--muted))';
    row.style.borderRadius = 'var(--radius-sm)';
    row.style.fontSize = '0.82rem';

    row.innerHTML = `
      <div>
        <strong>${prefix}</strong> — <span>${data.name}</span>
        <div style="font-size: 0.72rem; color: hsl(var(--muted-foreground)); max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${data.url}</div>
      </div>
      <button class="btn btn-secondary" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;" data-prefix="${prefix}">Delete</button>
    `;

    row.querySelector('button').onclick = () => {
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
