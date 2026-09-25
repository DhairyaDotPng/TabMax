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
  <img src="https://img.shields.io/badge/UI-Shadcn%20Monochrome-black?style=flat-square" alt="Shadcn UI">
  <img src="https://img.shields.io/badge/Font-Inter-blue?style=flat-square" alt="Inter Font">
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License">
</p>

---

## ✨ Features

- 🎨 **Shadcn Monochrome Design**: Clean zinc/neutral dark and light themes with pure CSS variables, crisp borders, and subtle elevation.
- ⚡ **Minimalist Header**: Live 12-hour clock, formatted date, instant theme toggle, and live weather widget powered by Open-Meteo API.
- 📌 **Auto-Wrapping Quick Bar**: Displays your favorite bookmarks from Chrome's *Bookmarks Bar* as pill buttons directly beneath the search bar. Automatically wraps across multiple rows.
- 📂 **Organized Folder Cards**: Subfolders from Chrome's *Other Bookmarks* are organized into responsive 2 to 4 column cards with scrollable lists, custom emoji pickers, and drag-and-drop reordering.
- 🖱️ **Full Browser Bookmark Management**:
  - Right-click anywhere on the background to create a new folder.
  - Right-click a folder card to rename it or add a bookmark inside.
  - Right-click any bookmark or quick-bar pill to edit its name or URL, or delete it.
  - Changes instantly sync bidirectionally with Chrome's native bookmark database.
- 🔍 **Instant Search & Shortcuts**:
  - `Ctrl + K` to immediately focus the search bar.
  - `/bkm <query>`: Live fuzzy bookmark search with arrow-key navigation and instant Enter to open.
  - `/notes`: Instantly open your notes workspace.
  - `/gh`, `/yt`, `/r`, etc.: Customizable search prefixes for GitHub, YouTube, Reddit, and your own custom search engines.
- 📝 **Google Keep Style Markdown Notes**:
  - Full-screen notes dashboard (`notes.html`) with card grid and pinned notes.
  - Split-screen note editor (Write mode & Live Markdown Preview).
  - 35% side panel containing a scrollable 25+ topic **Markdown Cheat-Sheet** (headings, bold/italic, task lists, code blocks, tables, callouts) — click any snippet to insert at cursor!
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
| **Search Bookmarks** | `/bkm <query>` | Live fuzzy search across all bookmarks with arrow keys |
| **Open Notes** | `/notes` | Navigates directly to the Markdown notes workspace |
| **Search GitHub** | `/gh <query>` | Searches repositories on GitHub |
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
