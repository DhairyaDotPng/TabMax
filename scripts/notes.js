// TabMax - Notes Module (Google Keep style + Markdown + Guide)
import { renderMarkdown } from './markdown.js';
import { initTheme, toggleTheme } from './settings.js';

let notes = [];
let activeNoteId = null;
let dirHandle = null;

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  document.getElementById('theme-toggle-btn').addEventListener('click', toggleTheme);

  loadNotes();
  setupCreator();
  setupEditor();
  setupSearch();
  setupDirectorySync();

  // Esc hotkey
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const editorOverlay = document.getElementById('editor-overlay');
      if (editorOverlay.classList.contains('active')) {
        closeEditor();
      } else {
        window.location.href = 'newtab.html';
      }
    }
  });
});

function loadNotes() {
  try {
    const raw = localStorage.getItem('tabmax_notes');
    notes = raw ? JSON.parse(raw) : getStarterNotes();
  } catch (e) {
    notes = getStarterNotes();
  }
  renderNotesGrid();
}

function saveNotes() {
  localStorage.setItem('tabmax_notes', JSON.stringify(notes));
  renderNotesGrid();
  syncAllToDirectory();
}

function getStarterNotes() {
  return [
    {
      id: 'welcome-note',
      title: 'Welcome to TabMax Notes ✨',
      body: 'TabMax notes support **full markdown**!\n\n- [x] Fast and local\n- [ ] Try creating your own note\n\nClick any note to open the **split-screen editor** with the markdown cheat-sheet on the right!',
      pinned: true,
      updatedAt: Date.now()
    }
  ];
}

function renderNotesGrid(filterQuery = '') {
  const pinnedGrid = document.getElementById('pinned-notes-grid');
  const pinnedSection = document.getElementById('pinned-section');
  const otherGrid = document.getElementById('other-notes-grid');

  let list = notes;
  if (filterQuery) {
    const q = filterQuery.toLowerCase();
    list = list.filter(n => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q));
  }

  const pinnedNotes = list.filter(n => n.pinned);
  const otherNotes = list.filter(n => !n.pinned);

  // Pinned Section
  if (pinnedNotes.length > 0) {
    pinnedSection.style.display = 'block';
    pinnedGrid.innerHTML = '';
    pinnedNotes.forEach(note => pinnedGrid.appendChild(createNoteCard(note)));
  } else {
    pinnedSection.style.display = 'none';
  }

  // Other Notes Section
  otherGrid.innerHTML = '';
  if (otherNotes.length === 0 && pinnedNotes.length === 0) {
    otherGrid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: hsl(var(--muted-foreground)); padding: 3rem;">No notes yet. Click "Take a note..." above to write one!</div>`;
  } else {
    otherNotes.forEach(note => otherGrid.appendChild(createNoteCard(note)));
  }
}

function createNoteCard(note) {
  const card = document.createElement('div');
  card.className = 'note-card';

  if (note.pinned) {
    const pin = document.createElement('div');
    pin.className = 'pin-badge';
    pin.title = 'Pinned';
    pin.innerHTML = `
      <svg class="icon" viewBox="0 0 24 24" width="14" height="14">
        <line x1="12" y1="17" x2="12" y2="22"/>
        <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>
      </svg>`;
    card.appendChild(pin);
  }

  const content = document.createElement('div');
  if (note.title) {
    const title = document.createElement('h4');
    title.className = 'note-card-title';
    title.textContent = note.title;
    content.appendChild(title);
  }

  const body = document.createElement('div');
  body.className = 'note-card-body';
  body.innerHTML = renderMarkdown(note.body);
  content.appendChild(body);

  const footer = document.createElement('div');
  footer.className = 'note-card-footer';

  const dateSpan = document.createElement('span');
  dateSpan.textContent = new Date(note.updatedAt || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  const actions = document.createElement('div');
  actions.className = 'note-card-actions';

  // Pin Toggle Button
  const pinBtn = document.createElement('button');
  pinBtn.className = 'card-icon-btn';
  pinBtn.title = note.pinned ? 'Unpin' : 'Pin to top';
  pinBtn.innerHTML = `
    <svg class="icon" viewBox="0 0 24 24" width="14" height="14">
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
    </svg>`;
  pinBtn.onclick = (e) => {
    e.stopPropagation();
    note.pinned = !note.pinned;
    saveNotes();
  };

  // Delete Button
  const delBtn = document.createElement('button');
  delBtn.className = 'card-icon-btn';
  delBtn.title = 'Delete note';
  delBtn.innerHTML = `
    <svg class="icon" viewBox="0 0 24 24" width="14" height="14">
      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>`;
  delBtn.onclick = (e) => {
    e.stopPropagation();
    if (confirm('Delete this note?')) {
      notes = notes.filter(n => n.id !== note.id);
      saveNotes();
    }
  };

  actions.appendChild(pinBtn);
  actions.appendChild(delBtn);

  footer.appendChild(dateSpan);
  footer.appendChild(actions);

  card.appendChild(content);
  card.appendChild(footer);

  // Click card to open full Editor
  card.onclick = () => openEditor(note.id);

  return card;
}

// Quick Note Creator (Google Keep Style)
function setupCreator() {
  const creator = document.getElementById('note-creator');
  const titleInput = document.getElementById('creator-title');
  const bodyInput = document.getElementById('creator-body');
  const saveBtn = document.getElementById('creator-save-btn');
  const closeBtn = document.getElementById('creator-close-btn');

  bodyInput.addEventListener('focus', () => {
    creator.classList.add('expanded');
  });

  closeBtn.addEventListener('click', () => {
    collapseCreator();
  });

  saveBtn.addEventListener('click', () => {
    const title = titleInput.value.trim();
    const body = bodyInput.value.trim();

    if (title || body) {
      const newNote = {
        id: 'note_' + Date.now(),
        title: title || 'Untitled Note',
        body: body,
        pinned: false,
        updatedAt: Date.now()
      };
      notes.unshift(newNote);
      saveNotes();
    }
    collapseCreator();
  });

  function collapseCreator() {
    titleInput.value = '';
    bodyInput.value = '';
    creator.classList.remove('expanded');
  }
}

// Split Screen Editor View (65% Editor, 35% Markdown Guide)
function setupEditor() {
  const overlay = document.getElementById('editor-overlay');
  const titleInput = document.getElementById('editor-title');
  const textarea = document.getElementById('editor-textarea');
  const preview = document.getElementById('editor-preview');
  const editTabBtn = document.getElementById('editor-tab-edit');
  const prevTabBtn = document.getElementById('editor-tab-prev');
  const doneBtn = document.getElementById('editor-done-btn');
  const deleteBtn = document.getElementById('editor-delete-btn');
  const pinBtn = document.getElementById('editor-pin-btn');

  // Markdown Guide syntax insertion
  document.querySelectorAll('.guide-card').forEach(card => {
    card.addEventListener('click', () => {
      const snippet = card.dataset.snippet;
      if (snippet && textarea) {
        insertTextAtCursor(textarea, snippet.replace(/\\n/g, '\n'));
        textarea.focus();
      }
    });
  });

  // Tab switching: Edit vs Preview
  editTabBtn.addEventListener('click', () => {
    editTabBtn.classList.add('active');
    prevTabBtn.classList.remove('active');
    textarea.style.display = 'block';
    preview.classList.remove('active');
  });

  prevTabBtn.addEventListener('click', () => {
    prevTabBtn.classList.add('active');
    editTabBtn.classList.remove('active');
    textarea.style.display = 'none';
    preview.innerHTML = renderMarkdown(textarea.value);
    preview.classList.add('active');
  });

  // Back button to close editor
  const backBtn = document.getElementById('editor-back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      persistActiveNote();
      closeEditor();
    });
  }

  // Done button
  doneBtn.addEventListener('click', () => {
    persistActiveNote();
    closeEditor();
  });

  // Pin toggle in editor
  pinBtn.addEventListener('click', () => {
    const note = notes.find(n => n.id === activeNoteId);
    if (note) {
      note.pinned = !note.pinned;
      pinBtn.classList.toggle('active', note.pinned);
    }
  });

  // Delete in editor
  deleteBtn.addEventListener('click', () => {
    if (confirm('Delete this note?')) {
      notes = notes.filter(n => n.id !== activeNoteId);
      saveNotes();
      closeEditor();
    }
  });

  // Close editor on overlay click outside dialog
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      persistActiveNote();
      closeEditor();
    }
  });
}

function openEditor(noteId) {
  activeNoteId = noteId;
  const note = notes.find(n => n.id === noteId);
  if (!note) return;

  const overlay = document.getElementById('editor-overlay');
  const titleInput = document.getElementById('editor-title');
  const textarea = document.getElementById('editor-textarea');
  const preview = document.getElementById('editor-preview');
  const editTabBtn = document.getElementById('editor-tab-edit');
  const prevTabBtn = document.getElementById('editor-tab-prev');
  const pinBtn = document.getElementById('editor-pin-btn');

  titleInput.value = note.title || '';
  textarea.value = note.body || '';

  // Reset to Edit tab
  editTabBtn.classList.add('active');
  prevTabBtn.classList.remove('active');
  textarea.style.display = 'block';
  preview.classList.remove('active');

  pinBtn.classList.toggle('active', Boolean(note.pinned));

  overlay.classList.add('active');
  textarea.focus();
}

function closeEditor() {
  const overlay = document.getElementById('editor-overlay');
  overlay.classList.remove('active');
  activeNoteId = null;
  renderNotesGrid();
}

function persistActiveNote() {
  if (!activeNoteId) return;
  const note = notes.find(n => n.id === activeNoteId);
  if (note) {
    note.title = document.getElementById('editor-title').value.trim() || 'Untitled Note';
    note.body = document.getElementById('editor-textarea').value;
    note.updatedAt = Date.now();
    saveNotes();
  }
}

function insertTextAtCursor(textarea, textToInsert) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const val = textarea.value;

  textarea.value = val.substring(0, start) + textToInsert + val.substring(end);
  textarea.selectionStart = textarea.selectionEnd = start + textToInsert.length;
}

function setupSearch() {
  const input = document.getElementById('notes-search-input');
  input.addEventListener('input', () => {
    renderNotesGrid(input.value.trim());
  });
}

// Local Directory Sync using Web File System Access API
function setupDirectorySync() {
  const syncBtn = document.getElementById('sync-dir-btn');
  const syncStatus = document.getElementById('sync-status');

  const savedDirName = localStorage.getItem('tabmax_notes_dirname');
  if (savedDirName) {
    syncStatus.textContent = `📁 Syncing to: ${savedDirName}`;
  }

  syncBtn.addEventListener('click', async () => {
    if (!('showDirectoryPicker' in window)) {
      alert('File System Access API is not supported in this browser environment.');
      return;
    }
    try {
      dirHandle = await window.showDirectoryPicker();
      localStorage.setItem('tabmax_notes_dirname', dirHandle.name);
      syncStatus.textContent = `📁 Syncing to: ${dirHandle.name}`;
      await syncAllToDirectory();
      alert(`Successfully linked directory "${dirHandle.name}". Notes will auto-save here as .md files!`);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('Directory selection canceled or failed:', err);
      }
    }
  });
}

async function syncAllToDirectory() {
  if (!dirHandle) return;
  try {
    for (const note of notes) {
      const safeTitle = (note.title || 'untitled').replace(/[^a-z0-9_-]/gi, '_');
      const filename = `${safeTitle}.md`;
      const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      const content = `# ${note.title}\n\n${note.body}`;
      await writable.write(content);
      await writable.close();
    }
  } catch (err) {
    console.warn('Auto-sync to directory failed:', err);
  }
}
