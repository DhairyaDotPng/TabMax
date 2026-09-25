// TabMax - New Tab Main Controller
import { initTheme, toggleTheme, setupSettingsModal, openEmojiPicker } from './settings.js';
import { fetchWeather } from './weather.js';
import { loadBookmarks, renderQuickBar, renderCardsGrid } from './bookmarks.js';
import { setupSearch } from './search.js';
import { setupContextMenu } from './contextmenu.js';

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Initialize Theme
  initTheme();
  document.getElementById('theme-toggle-btn').addEventListener('click', toggleTheme);

  // 2. Start Live Clock & Date
  initClock();

  // 3. Initialize Weather Widget
  loadWeatherData();
  document.getElementById('weather-widget').addEventListener('click', () => {
    // Open settings on click
    document.getElementById('settings-btn').click();
  });

  // 4. Initialize Bookmarks (Quick Bar & Cards Grid)
  await refreshBookmarks();

  // 5. Initialize Context Menu & Chrome Bookmark Sync
  setupContextMenu(refreshBookmarks);

  // Listen to browser-level Chrome bookmark events for live sync
  if (chrome.bookmarks) {
    chrome.bookmarks.onCreated.addListener(refreshBookmarks);
    chrome.bookmarks.onRemoved.addListener(refreshBookmarks);
    chrome.bookmarks.onChanged.addListener(refreshBookmarks);
    chrome.bookmarks.onMoved.addListener(refreshBookmarks);
  }

  // 6. Initialize Search & Commands
  const searchInput = document.getElementById('search-input');
  const searchDropdown = document.getElementById('search-dropdown');
  const engineBadge = document.getElementById('engine-badge');
  setupSearch(searchInput, searchDropdown, engineBadge);

  // 7. Direct Notes Button
  const notesBtn = document.getElementById('notes-shortcut-btn');
  if (notesBtn) {
    notesBtn.addEventListener('click', () => {
      window.location.href = 'notes.html';
    });
  }

  // 8. Initialize Settings Modal
  setupSettingsModal(async (result) => {
    if (result && result.openNewTabOnly) {
      await refreshBookmarks();
    } else if (result && result.weatherUpdated) {
      await loadWeatherData();
    } else {
      await loadWeatherData();
      await refreshBookmarks();
    }
  });
});

// Live Clock & Date Function
function initClock() {
  const timeEl = document.getElementById('time-display');
  const dateEl = document.getElementById('date-display');

  function update() {
    const now = new Date();
    // 12-hour format with AM/PM
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 becomes 12

    timeEl.textContent = `${hours}:${minutes} ${ampm}`;

    // Options for date: e.g. Friday, October 24, 2026
    const dateOptions = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
    dateEl.textContent = now.toLocaleDateString(undefined, dateOptions);
  }

  update();
  setInterval(update, 1000);
}

// Weather Loader
async function loadWeatherData() {
  const city = localStorage.getItem('tabmax_weather_city') || 'New York';
  const unit = localStorage.getItem('tabmax_weather_unit') || 'celsius';

  const weatherEl = document.getElementById('weather-widget');
  const iconEl = weatherEl.querySelector('.weather-icon');
  const tempEl = weatherEl.querySelector('.weather-temp');
  const locEl = weatherEl.querySelector('.weather-location');

  const data = await fetchWeather(city, unit);
  if (data && !data.error) {
    iconEl.textContent = data.icon;
    tempEl.textContent = `${data.temp}${data.unit}`;
    locEl.textContent = `${data.condition}, ${data.city}`;
    weatherEl.title = `Weather in ${data.city} (${data.condition}). Click to change in Settings.`;
  } else {
    iconEl.textContent = '🌤️';
    tempEl.textContent = '--°';
    locEl.textContent = city;
    weatherEl.title = 'Click to configure weather location in Settings.';
  }
}

// Bookmarks Loader
async function refreshBookmarks() {
  const { quickBookmarks, folderCards } = await loadBookmarks();

  const quickBarEl = document.getElementById('quickbar-container');
  renderQuickBar(quickBookmarks, quickBarEl);

  const gridEl = document.getElementById('cards-grid');
  renderCardsGrid(folderCards, gridEl, (folderId, folderTitle) => {
    // Open Emoji Picker for this card
    openEmojiPicker(folderId, folderTitle, (id, newEmoji) => {
      // Update emoji button in place immediately
      const card = document.querySelector(`.bookmark-card[data-folder-id="${id}"]`);
      if (card) {
        const btn = card.querySelector('.card-emoji-btn');
        if (btn) btn.textContent = newEmoji;
      }
    });
  });
}
