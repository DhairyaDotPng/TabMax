# 📁 TabMax

<p align="center">
  <img src="icons/icon-128.png" width="100" height="100" alt="TabMax Logo" />
</p>

<p align="center">
  <strong>A modern, minimalist, and ultra-fast Chrome new tab extension.</strong><br>
  Built with Shadcn monochrome aesthetics, keyboard-driven navigation, full Chrome bookmark management, live weather, and built-in Markdown notes.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Manifest-V3-black?style=flat-square" alt="Manifest V3">
  <img src="https://img.shields.io/badge/UI-Shadcn%20%2B%20M3E%20%2B%20Neobrutalism-black?style=flat-square" alt="Shadcn, Material 3 Expressive & Neobrutalism UI">
  <img src="https://img.shields.io/badge/Typography-Inter%20%7C%20Google%20Sans%20%7C%20Space%20Grotesk-blue?style=flat-square" alt="Inter, Google Sans and Space Grotesk">
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License">
</p>

---

## ✨ Features

- 🎨 **Multi-Theme Design System**:
  - **Default (Shadcn Zinc)**: Monochrome, minimalist aesthetic with crisp borders, clean rectangular radii, and neutral dark/light modes.
  - **Material 3 Expressive (M3E)**: Expressive Google Material Design with fluid pill shapes, tonal elevation surfaces, and dynamic accent palettes.
  - **Neobrutalism (Neo)**: High-contrast, bold retro aesthetic featuring thick black outlines, tactile drop shadows, square toggle knobs, and authentic Neubrutalist pop palettes.
  - **Color Mode Selector**: Segmented toggle for Light, Dark, and Auto (System OS) modes across all themes.
  - **Dynamic Theme-Specific Accent Palettes**:
    - *M3E Palettes*: Indigo, Ocean (Teal), Emerald (Sage), Rose (Coral), Amber, and Violet.
    - *Neo Palettes*: Bold Yellow, Sky Blue, Soft Green, Coral Pink, Orange, and Lavender.
    - Live visual color dots, synced dropdown triggers, and reactive palette chips in settings and the top-bar menu.
  - **Universal Custom Typography & Dual Font Selectors**: Enter any Google Font (e.g. Poppins, Outfit, Lexend, Roboto) or local font with instant application across all elements. Includes one-click theme default resets (Inter for Shadcn, Google Sans for M3E, Space Grotesk for Neo) accessible directly from **both** the Settings menu and the Top-Bar Theme popover.
- ⚙️ **Re-imagined & Categorized Settings Menu**:
  - Neatly organized into 4 dedicated sections: **Appearance**, **Weather Settings**, **Search Engine & Shortcut Settings**, and **General Settings**.
  - **Hardware-Accelerated Smooth Scrolling**: Isolated compositor layers and GPU hardware acceleration delivering silky-smooth 60 FPS scrolling.
  - Top-bar quick appearance popover menu for rapid theme, mode, accent, and font switching on the fly.
- ⚡ **Minimalist Header**: Live 12-hour clock, formatted date, instant theme switcher popover, and live weather widget powered by Open-Meteo API.
- 📌 **Auto-Wrapping Quick Bar with Long-Press Reordering**:
  - Displays your favorite bookmarks from Chrome's *Bookmarks Bar* as pill buttons directly beneath the search bar, automatically wrapping across multiple rows.
  - **Long-Press & Drag**: Press and hold any favourite pill for ~200ms to lift it into drag mode and rearrange your favourites directly on the fly. The new order instantly syncs with Chrome's native bookmark hierarchy.
- 📂 **Organized & Collapsible Folder Cards**:
  - Subfolders from Chrome's *Other Bookmarks* are organized into responsive 2 to 4 column cards with scrollable lists.
  - **Collapse & Expand**: Folders can be collapsed into compact headers via an interactive chevron button or right-click menu, with state saved across sessions.
  - **Card Drag-and-Drop**: Easily reorder folder cards across your grid using the titlebar as a drag handle.
  - **Custom Emojis**: Set custom single-emoji folder icons using the quick picker with strict 1-emoji Unicode validation (`Intl.Segmenter`).
- ↕️ **In-Folder Drag-and-Drop Bookmark Reordering**:
  - Reorder bookmarks directly within each folder card using a dedicated 6-dot drag handle on the right corner of each bookmark link.
  - Features real-time drop position indicators and instantly syncs the new order with Chrome's native bookmark hierarchy via `chrome.bookmarks.move`.
- 🖱️ **Full Browser Bookmark Management (Context Menu)**:
  - Right-click anywhere on the background to create a new folder.
  - Right-click a folder card to rename it, collapse/expand it, change its emoji, or add a bookmark inside.
  - Right-click any bookmark or quick-bar pill to edit its name or URL, copy URL, or delete it.
  - All changes sync bidirectionally in real-time with Chrome's native bookmark database.
- 🔍 **Instant Bookmark Search, Interactive Suggestions & Custom Shortcuts**:
  - **Default Search**: Typing in the search bar immediately live-filters all your bookmarks with arrow-key navigation and instant Enter to open.
  - **Interactive Shortcut Suggestions**: Tap or click the search bar to reveal a clean dropdown of all available search shortcuts (`/web`, `/git`, `/yt`, `/r`, `/notes`, and custom engines).
  - **Instant Engine Pills**: Typing any shortcut (e.g. `/web`, `/git`, `/yt`) instantly turns into an engine pill badge, automatically clears the shortcut prefix text, and updates the placeholder to `Search <Engine>...`. Press <kbd>Backspace</kbd> or click <kbd>&times;</kbd> to easily exit engine mode.
  - `Ctrl + K` to immediately focus the search bar.
  - Manage and delete custom engines in Settings with beautiful prefix chips matching the search dropdown.
- 📝 **Google Keep Style Markdown Notes with Full Parity**:
  - Full-screen notes dashboard (`notes.html`) adapting dynamically to Shadcn and Material 3 Expressive themes.
  - Interactive markdown task lists (`- [ ]` / `- [x]`) with clickable checkboxes directly from the note cards.
  - Split-screen note editor with Live Markdown Preview and 25+ topic **Markdown Cheat-Sheet** available when creating new notes as well as editing existing ones.
  - Local directory sync support via the File System Access API.
- 🔒 **100% Private & Local**: Zero analytics, zero trackers, zero external servers. Everything runs entirely within your browser and local machine.

---

## 🚀 Installation (Load Unpacked via Developer Mode)

You don't need to install TabMax from the Chrome Web Store. You can install and run it directly as an unpacked extension in under a minute for free:

### Step 1: Download or Clone the Repository
- **Option A (ZIP download)**:
  1. Click the green **Code** button at the top of this GitHub repository.
  2. Select **Download ZIP**.
  3. Extract the downloaded ZIP file to a folder on your computer (e.g. `C:\TabMax` or `Documents/TabMax`).
- **Option B (Git clone)**:
  ```bash
  git clone https://github.com/YOUR_USERNAME/TabMax.git
  ```

### Step 2: Open Extensions in Chrome
1. Open Google Chrome.
2. In the URL bar, type:
   ```text
   chrome://extensions
   ```
   and press <kbd>Enter</kbd>.

### Step 3: Enable Developer Mode
- In the top-right corner of the Extensions page, toggle the **Developer mode** switch to **ON**.

### Step 4: Load TabMax
1. Click the **Load unpacked** button in the top-left corner.
2. Select the `TabMax` folder (the folder containing `manifest.json`).
3. Click **Select Folder**.

### Step 5: Start Using TabMax
1. Open a new tab (<kbd>Ctrl</kbd> + <kbd>T</kbd> or <kbd>Cmd</kbd> + <kbd>T</kbd>).
2. Chrome may ask: *"Is this the new tab page you were expecting?"* — click **Keep changes**.
3. Enjoy your clean, fast, and organized new tab dashboard!

---

## 🔄 How to Update

When new features or fixes are pushed:
1. Replace or `git pull` the latest files into your existing `TabMax` folder.
2. Open `chrome://extensions`.
3. Locate the **TabMax** extension card and click the **Reload (circular arrow)** button.
4. Open a new tab to see the updates immediately!

---

## ⚙️ Configuration & Shortcuts

| Action | Shortcut / Prefix | Description |
| :--- | :--- | :--- |
| **Focus Search** | <kbd>Ctrl</kbd> + <kbd>K</kbd> / <kbd>Cmd</kbd> + <kbd>K</kbd> | Instantly highlights the search bar |
| **Search Bookmarks** | `<query>` (Default) | Live fuzzy search across all bookmarks with arrow keys |
| **Search the Web** | `/web <query>` | Performs a web search via default search engine |
| **Open Notes** | `/notes` | Navigates directly to the Markdown notes workspace |
| **Search GitHub** | `/git <query>` | Searches repositories on GitHub |
| **Search YouTube** | `/yt <query>` | Searches videos on YouTube |
| **Search Reddit** | `/r <query>` | Searches discussions on Reddit |
| **Open Settings** | `⚙️` icon | Weather location, °C/°F, new tab toggle, and custom search engines |

---

## 📂 Project Structure

```text
TabMax/
├── manifest.json            # Manifest V3 extension configuration
├── newtab.html              # Main dashboard HTML
├── notes.html               # Markdown notes workspace HTML
├── icons/                   # Transparent PNG extension & favicon icons (16, 32, 48, 128)
├── styles/
│   ├── theme.css            # Shadcn monochrome color tokens & Inter font
│   ├── newtab.css           # Dashboard layout, cards, context menu & modal styles
│   └── notes.css            # Notes grid, split editor & cheatsheet styles
├── scripts/
│   ├── newtab.js            # Main entry controller
│   ├── bookmarks.js         # Chrome bookmarks loader & CRUD operations
│   ├── contextmenu.js       # Custom right-click menu & dialog handlers
│   ├── search.js            # Live fuzzy search & custom search engines
│   ├── weather.js           # Open-Meteo live weather client
│   ├── settings.js          # Settings modal, theme switcher & emoji picker
│   ├── notes.js             # Notes CRUD, pinning & local folder sync
│   └── markdown.js          # Lightweight client-side Markdown parser
└── README.md                # Project documentation
```

---

## 📜 Credits & Acknowledgements

- Inspired by and created as a modern fork/evolution of the minimalist [Humble New Tab Page](https://github.com/ibillingsley/HumbleNewTabPage).
- Designed following [shadcn/ui](https://ui.shadcn.com/) monochrome design aesthetics.
- Weather data provided freely by [Open-Meteo](https://open-meteo.com/).
- Typography powered by [Inter](https://rsms.me/inter/).

---

## 📄 License

MIT License. Feel free to fork, customize, and build your own ideal new tab workspace!
