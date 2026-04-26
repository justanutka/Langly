const NOTES_BASE_URL = "http://127.0.0.1:8000";

let notes = [];
let editingNoteId = null;
let selectedColor = "indigo";
let noteToDeleteId = null;
let savedSelection = null;
let viewingNoteId = null;
let notesFilterValue = "all";

document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem("token");

    if (!token) {
        window.location.href = "login.html";
        return;
    }

    if (typeof loadSidebar === "function") {
        await loadSidebar();
    }

    const logo = document.getElementById("logo");
    if (logo) {
        logo.addEventListener("click", () => {
            window.location.href = "dashboard.html";
        });
    }

    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.removeItem("token");
            window.location.href = "index.html";
        });
    }

    initNotesPage();
    await loadNotes();
});

function initNotesPage() {
    const openModalBtn = document.getElementById("open-note-modal");
    const closeModalBtn = document.getElementById("close-note-modal");
    const cancelNoteBtn = document.getElementById("cancel-note-btn");
    const saveNoteBtn = document.getElementById("save-note-btn");

    const cancelDeleteBtn = document.getElementById("cancel-delete-note");
    const confirmDeleteBtn = document.getElementById("confirm-delete-note");

    const closeViewNoteBtn = document.getElementById("close-view-note");
    const closeViewNoteBottomBtn = document.getElementById("close-view-note-bottom");
    const editViewNoteBtn = document.getElementById("edit-view-note");
    const viewNoteModal = document.getElementById("view-note-modal");

    const searchInput = document.getElementById("notes-search");
    const filterDropdown = document.getElementById("notes-filter-dropdown");
    const editor = document.getElementById("note-content-input");

    openModalBtn.addEventListener("click", () => {
        openNoteModal();
    });

    closeModalBtn.addEventListener("click", () => {
        closeNoteModal();
    });

    cancelNoteBtn.addEventListener("click", () => {
        closeNoteModal();
    });

    saveNoteBtn.addEventListener("click", async () => {
        await saveNote();
    });

    cancelDeleteBtn.addEventListener("click", () => {
        closeDeleteModal();
    });

    confirmDeleteBtn.addEventListener("click", async () => {
        await deleteNote();
    });

    closeViewNoteBtn.addEventListener("click", () => {
        closeViewNoteModal();
    });

    closeViewNoteBottomBtn.addEventListener("click", () => {
        closeViewNoteModal();
    });

    editViewNoteBtn.addEventListener("click", () => {
        const note = notes.find(item => item.id === viewingNoteId);

        if (!note) return;

        closeViewNoteModal();
        openNoteModal(note);
    });

    viewNoteModal.addEventListener("click", (event) => {
        if (event.target === viewNoteModal) {
            closeViewNoteModal();
        }
    });

    searchInput.addEventListener("input", () => {
        renderNotes();
    });

    initNotesFilterDropdown(filterDropdown);

    document.querySelectorAll(".color-dot").forEach(button => {
        button.addEventListener("click", () => {
            selectedColor = button.dataset.color;

            document.querySelectorAll(".color-dot").forEach(dot => {
                dot.classList.remove("active");
            });

            button.classList.add("active");
        });
    });

    editor.addEventListener("mouseup", saveSelection);
    editor.addEventListener("keyup", saveSelection);
    editor.addEventListener("focus", saveSelection);

    document.querySelectorAll(".highlight-btn").forEach(button => {
        button.addEventListener("mousedown", (event) => {
            event.preventDefault();
        });

        button.addEventListener("click", () => {
            applyTextHighlight(button.dataset.highlight);
        });
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeNoteModal();
            closeDeleteModal();
            closeViewNoteModal();
        }
    });
}

async function loadNotes() {
    const token = localStorage.getItem("token");

    try {
        const res = await fetch(`${NOTES_BASE_URL}/notes/`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (!res.ok) {
            showToast("Could not load notes");
            return;
        }

        notes = await res.json();
        renderNotes();
    } catch (error) {
        console.error(error);
        showToast("Server connection error");
    }
}

function renderNotes() {
    const grid = document.getElementById("notes-grid");
    const empty = document.getElementById("notes-empty");
    const searchInput = document.getElementById("notes-search");
    
    const search = searchInput.value.trim().toLowerCase();
    const filter = notesFilterValue;

    let filteredNotes = notes.filter(note => {
        const plainContent = getPlainText(note.content || "");

        const matchesSearch =
            note.title.toLowerCase().includes(search) ||
            plainContent.toLowerCase().includes(search);

        const matchesFilter =
            filter === "all" ||
            (filter === "important" && note.is_important) ||
            note.color === filter;

        return matchesSearch && matchesFilter;
    });

    filteredNotes.sort((a, b) => {
        if (a.is_important !== b.is_important) {
            return b.is_important - a.is_important;
        }

        return new Date(b.updated_at) - new Date(a.updated_at);
    });

    grid.innerHTML = "";

    if (filteredNotes.length === 0) {
        empty.style.display = "block";
        return;
    }

    empty.style.display = "none";

    filteredNotes.forEach(note => {
        const card = document.createElement("div");
        card.className = `note-card ${note.color || "indigo"}`;

        card.innerHTML = `
            <div class="note-top">
                <h3 class="note-title">${escapeHtml(note.title)}</h3>
                ${note.is_important ? `<div class="important-badge">★</div>` : ""}
            </div>

            <div class="note-content">${sanitizeNoteHtml(note.content)}</div>

            <div class="note-meta">
                Updated ${formatDate(note.updated_at)}
            </div>

            <div class="note-actions">
                <button class="note-action-btn edit-note-btn" type="button">Edit</button>
                <button class="note-action-btn delete-note-btn" type="button">Delete</button>
            </div>
        `;

        card.addEventListener("click", () => {
            openViewNoteModal(note);
        });

        card.querySelector(".edit-note-btn").addEventListener("click", (event) => {
            event.stopPropagation();
            openNoteModal(note);
        });

        card.querySelector(".delete-note-btn").addEventListener("click", (event) => {
            event.stopPropagation();
            openDeleteModal(note.id);
        });

        grid.appendChild(card);
    });
}

function openNoteModal(note = null) {
    const modal = document.getElementById("note-modal");
    const modalTitle = document.getElementById("note-modal-title");
    const titleInput = document.getElementById("note-title-input");
    const editor = document.getElementById("note-content-input");
    const importantInput = document.getElementById("note-important-input");

    hideNoteMessage();

    if (note) {
        editingNoteId = note.id;
        selectedColor = note.color || "indigo";

        modalTitle.textContent = "Edit note";
        titleInput.value = note.title;
        editor.innerHTML = sanitizeNoteHtml(note.content || "");
        importantInput.checked = note.is_important;
    } else {
        editingNoteId = null;
        selectedColor = "indigo";

        modalTitle.textContent = "New note";
        titleInput.value = "";
        editor.innerHTML = "";
        importantInput.checked = false;
    }

    document.querySelectorAll(".color-dot").forEach(dot => {
        dot.classList.toggle("active", dot.dataset.color === selectedColor);
    });

    savedSelection = null;
    modal.style.display = "flex";
    titleInput.focus();
}

function closeNoteModal() {
    const modal = document.getElementById("note-modal");

    modal.style.display = "none";
    editingNoteId = null;
    selectedColor = "indigo";
    savedSelection = null;
    hideNoteMessage();
}

async function saveNote() {
    const token = localStorage.getItem("token");

    const titleInput = document.getElementById("note-title-input");
    const editor = document.getElementById("note-content-input");
    const importantInput = document.getElementById("note-important-input");

    const title = titleInput.value.trim();
    const content = cleanEditorHtml(editor.innerHTML);
    const plainContent = getPlainText(content).trim();

    if (!title || !plainContent) {
        showNoteMessage("Please fill in title and content.");
        return;
    }

    const payload = {
        title,
        content,
        color: selectedColor,
        is_important: importantInput.checked
    };

    const url = editingNoteId
        ? `${NOTES_BASE_URL}/notes/${editingNoteId}`
        : `${NOTES_BASE_URL}/notes/`;

    const method = editingNoteId ? "PUT" : "POST";

    try {
        const res = await fetch(url, {
            method,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json().catch(() => null);

        if (!res.ok) {
            showNoteMessage(data?.detail || "Could not save note.");
            return;
        }

        const wasEditing = Boolean(editingNoteId);

        closeNoteModal();
        await loadNotes();

        showToast(wasEditing ? "Note updated" : "Note created");
    } catch (error) {
        console.error(error);
        showNoteMessage("Server connection error.");
    }
}

function openDeleteModal(noteId) {
    noteToDeleteId = noteId;
    document.getElementById("delete-note-modal").style.display = "flex";
}

function closeDeleteModal() {
    noteToDeleteId = null;
    document.getElementById("delete-note-modal").style.display = "none";
}

async function deleteNote() {
    if (!noteToDeleteId) return;

    const token = localStorage.getItem("token");

    try {
        const res = await fetch(`${NOTES_BASE_URL}/notes/${noteToDeleteId}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (!res.ok) {
            showToast("Could not delete note");
            return;
        }

        closeDeleteModal();
        await loadNotes();
        showToast("Note deleted");
    } catch (error) {
        console.error(error);
        showToast("Server connection error");
    }
}

function saveSelection() {
    const editor = document.getElementById("note-content-input");
    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);

    if (!editor.contains(range.commonAncestorContainer)) return;

    savedSelection = range.cloneRange();
}

function restoreSelection() {
    if (!savedSelection) return false;

    const selection = window.getSelection();

    selection.removeAllRanges();
    selection.addRange(savedSelection);

    return true;
}

function applyTextHighlight(type) {
    const editor = document.getElementById("note-content-input");

    editor.focus();

    if (!restoreSelection()) return;

    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        showNoteMessage("Select text first, then choose a highlight color.");
        return;
    }

    const range = selection.getRangeAt(0);

    if (type === "clear") {
        clearHighlightFromSelection(range);
        selection.removeAllRanges();
        savedSelection = null;
        return;
    }

    const span = document.createElement("span");
    span.className = `text-highlight-${type}`;

    try {
        range.surroundContents(span);
    } catch (error) {
        const selectedContent = range.extractContents();
        span.appendChild(selectedContent);
        range.insertNode(span);
    }

    selection.removeAllRanges();
    savedSelection = null;
    hideNoteMessage();
}

function clearHighlightFromSelection(range) {
    const editor = document.getElementById("note-content-input");
    const selectedText = range.toString();

    if (!selectedText) return;

    const wrapper = document.createElement("div");
    wrapper.appendChild(range.cloneContents());

    wrapper.querySelectorAll("span[class^='text-highlight-']").forEach(span => {
        span.replaceWith(document.createTextNode(span.textContent));
    });

    range.deleteContents();

    const fragment = document.createDocumentFragment();

    while (wrapper.firstChild) {
        fragment.appendChild(wrapper.firstChild);
    }

    range.insertNode(fragment);

    editor.normalize();
}

function showNoteMessage(text) {
    const message = document.getElementById("note-message");

    message.textContent = text;
    message.classList.remove("hidden");
    message.classList.add("error");
}

function hideNoteMessage() {
    const message = document.getElementById("note-message");

    message.textContent = "";
    message.classList.add("hidden");
    message.classList.remove("error");
}

function showToast(text) {
    const toast = document.getElementById("toast");
    const toastText = document.getElementById("toast-text");

    if (!toast || !toastText) return;

    toastText.textContent = text;

    toast.classList.remove("hidden");

    setTimeout(() => {
        toast.classList.add("show");
    }, 10);

    setTimeout(() => {
        toast.classList.remove("show");

        setTimeout(() => {
            toast.classList.add("hidden");
        }, 300);
    }, 2400);
}

function formatDate(value) {
    if (!value) return "";

    const date = new Date(value);

    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function cleanEditorHtml(html) {
    const temp = document.createElement("div");
    temp.innerHTML = html;

    temp.querySelectorAll("script, style").forEach(el => el.remove());

    temp.querySelectorAll("*").forEach(el => {
        [...el.attributes].forEach(attr => {
            if (attr.name !== "class") {
                el.removeAttribute(attr.name);
            }
        });

        const allowedClasses = [
            "text-highlight-yellow",
            "text-highlight-pink",
            "text-highlight-turquoise"
        ];

        if (el.className) {
            const classes = String(el.className)
                .split(" ")
                .filter(cls => allowedClasses.includes(cls));

            if (classes.length) {
                el.className = classes.join(" ");
            } else {
                el.removeAttribute("class");
            }
        }
    });

    return temp.innerHTML.trim();
}

function sanitizeNoteHtml(html) {
    const temp = document.createElement("div");
    temp.innerHTML = html || "";

    temp.querySelectorAll("script, style").forEach(el => el.remove());

    temp.querySelectorAll("*").forEach(el => {
        const tagName = el.tagName.toLowerCase();
        const allowedTags = ["div", "p", "br", "span", "b", "strong", "i", "em"];

        if (!allowedTags.includes(tagName)) {
            el.replaceWith(document.createTextNode(el.textContent));
            return;
        }

        [...el.attributes].forEach(attr => {
            if (attr.name !== "class") {
                el.removeAttribute(attr.name);
            }
        });

        const allowedClasses = [
            "text-highlight-yellow",
            "text-highlight-pink",
            "text-highlight-turquoise"
        ];

        if (el.className) {
            const classes = String(el.className)
                .split(" ")
                .filter(cls => allowedClasses.includes(cls));

            if (classes.length) {
                el.className = classes.join(" ");
            } else {
                el.removeAttribute("class");
            }
        }
    });

    return temp.innerHTML;
}

function getPlainText(html) {
    const temp = document.createElement("div");
    temp.innerHTML = html || "";
    return temp.textContent || "";
}

function escapeHtml(text) {
    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function initNotesFilterDropdown(dropdown) {
    if (!dropdown) return;

    const selected = dropdown.querySelector(".notes-select-selected");
    const items = dropdown.querySelector(".notes-select-items");

    selected.addEventListener("click", (event) => {
        event.stopPropagation();

        items.classList.toggle("notes-select-hide");
        selected.classList.toggle("active");
    });

    items.querySelectorAll("div").forEach(item => {
        item.addEventListener("click", (event) => {
            event.stopPropagation();

            selected.textContent = item.textContent;
            notesFilterValue = item.dataset.value;

            items.querySelectorAll("div").forEach(option => {
                option.classList.remove("selected");
            });

            item.classList.add("selected");

            items.classList.add("notes-select-hide");
            selected.classList.remove("active");

            renderNotes();
        });
    });

    document.addEventListener("click", () => {
        items.classList.add("notes-select-hide");
        selected.classList.remove("active");
    });
}

function openViewNoteModal(note) {
    const modal = document.getElementById("view-note-modal");
    const title = document.getElementById("view-note-title");
    const content = document.getElementById("view-note-content");
    const date = document.getElementById("view-note-date");
    const important = document.getElementById("view-note-important");

    viewingNoteId = note.id;

    title.textContent = note.title;
    content.innerHTML = sanitizeNoteHtml(note.content || "");
    date.textContent = `Updated ${formatDate(note.updated_at)}`;

    if (note.is_important) {
        important.classList.remove("hidden");
    } else {
        important.classList.add("hidden");
    }

    modal.style.display = "flex";
}

function closeViewNoteModal() {
    const modal = document.getElementById("view-note-modal");

    if (!modal) return;

    modal.style.display = "none";
    viewingNoteId = null;
}