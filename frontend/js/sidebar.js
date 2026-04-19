async function loadSidebar() {
    const container = document.getElementById("sidebar-container");
    if (!container) return;

    const res = await fetch("components/sidebar.html");
    const html = await res.text();

    container.innerHTML = html;

    initSidebar();
    initNewFolderButton();
    initSidebarToggle();
    initStudyPicker();
}

/* SIDEBAR TOGGLE */
function initSidebar() {
    const toggle = document.getElementById("sidebar-toggle");
    const sidebar = document.querySelector(".sidebar");

    if (!toggle || !sidebar) return;

    toggle.addEventListener("click", () => {
        sidebar.classList.toggle("collapsed");
    });
}

/* NEW FOLDER BUTTON */
function initNewFolderButton() {
    const newFolderBtn = document.getElementById("add-folder-btn");

    if (!newFolderBtn) return;

    newFolderBtn.addEventListener("click", (e) => {
        e.preventDefault();

        if (window.location.pathname.includes("my-words.html")) {
            const modal = document.getElementById("folder-modal");
            if (modal) {
                modal.style.display = "flex";
            }
        } else {
            window.location.href = "my-words.html?create=true";
        }
    });
}

function initStudyPicker() {
    const cardsBtn = document.getElementById("sidebar-cards-btn");
    const quizBtn = document.getElementById("sidebar-quiz-btn");
    const modal = document.getElementById("study-picker-modal");
    const closeBtn = document.getElementById("study-picker-close");
    const title = document.getElementById("study-picker-title");
    const content = document.getElementById("study-picker-content");
    const searchInput = document.getElementById("study-picker-search");

    if (!cardsBtn || !quizBtn || !modal || !closeBtn || !title || !content || !searchInput) return;

    let currentMode = null;
    let currentData = [];

    cardsBtn.addEventListener("click", async () => {
        await openStudyPicker("cards");
    });

    quizBtn.addEventListener("click", async () => {
        await openStudyPicker("quiz");
    });

    closeBtn.addEventListener("click", () => {
        modal.style.display = "none";
        content.innerHTML = "";
        searchInput.value = "";
        currentData = [];
    });

    modal.addEventListener("click", (e) => {
        if (e.target === modal) {
            modal.style.display = "none";
            content.innerHTML = "";
            searchInput.value = "";
            currentData = [];
        }
    });

    searchInput.addEventListener("input", () => {
        renderStudyPickerContent(currentData, currentMode, content, searchInput.value.trim().toLowerCase());
    });

    async function openStudyPicker(mode) {
        currentMode = mode;
        currentData = [];

        title.textContent = mode === "cards" ? "Choose module for cards" : "Choose module for quiz";
        searchInput.value = "";
        content.innerHTML = `<div class="study-picker-loading">Loading...</div>`;
        modal.style.display = "flex";

        try {
            const token = localStorage.getItem("token");
            if (!token) {
                window.location.href = "login.html";
                return;
            }

            const foldersRes = await fetch(`${BASE_URL}/folders/`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (!foldersRes.ok) {
                content.innerHTML = `<div class="study-picker-empty">Could not load folders.</div>`;
                return;
            }

            const folders = await foldersRes.json();

            if (!folders.length) {
                content.innerHTML = `<div class="study-picker-empty">No folders yet.</div>`;
                return;
            }

            const modulesByFolder = await Promise.all(
                folders.map(async (folder) => {
                    const modulesRes = await fetch(`${BASE_URL}/modules/${folder.id}`, {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    });

                    const modules = modulesRes.ok ? await modulesRes.json() : [];
                    return { folder, modules };
                })
            );

            currentData = modulesByFolder.filter(item => item.modules.length > 0);

            if (!currentData.length) {
                content.innerHTML = `<div class="study-picker-empty">No modules available yet.</div>`;
                return;
            }

            renderStudyPickerContent(currentData, currentMode, content, "");
        } catch (error) {
            console.error(error);
            content.innerHTML = `<div class="study-picker-empty">Something went wrong.</div>`;
        }
    }
}

function renderStudyPickerContent(data, mode, content, searchTerm = "") {
    content.innerHTML = "";

    const filteredFolders = data
        .map(({ folder, modules }) => {
            const filteredModules = modules.filter(module =>
                module.name.toLowerCase().includes(searchTerm)
            );

            return {
                folder,
                modules: filteredModules
            };
        })
        .filter(item => item.modules.length > 0);

    if (!filteredFolders.length) {
        content.innerHTML = `<div class="study-picker-empty">No matching modules found.</div>`;
        return;
    }

    filteredFolders.forEach(({ folder, modules }) => {
        const section = document.createElement("div");
        section.className = "study-picker-folder";

        const folderHeader = document.createElement("div");
        folderHeader.className = "study-picker-folder-title";
        folderHeader.textContent = `${folder.emoji || "📁"} ${folder.name}`;

        const moduleList = document.createElement("div");
        moduleList.className = "study-picker-module-list";

        modules.forEach(module => {
            const moduleBtn = document.createElement("button");
            moduleBtn.type = "button";
            moduleBtn.className = "study-picker-module-btn";
            moduleBtn.textContent = module.name;

            moduleBtn.addEventListener("click", async () => {
                const token = localStorage.getItem("token");
                const hasWords = await checkModuleHasWords(module.id, token);

                if (!hasWords) {
                    moduleBtn.blur();
                    return;
                }

                sessionStorage.setItem("langlyCurrentFolderId", folder.id ?? "");
                sessionStorage.setItem("langlyCurrentModuleId", module.id ?? "");
                sessionStorage.setItem("langlyCurrentFolderTitle", folder.name || "");
                sessionStorage.setItem("langlyCurrentModuleTitle", module.name || "");

                if (mode === "cards") {
                    window.location.href = `flashcards.html?module=${module.id}&name=${encodeURIComponent(module.name)}`;
                } else {
                    window.location.href = `quiz.html?module=${module.id}&name=${encodeURIComponent(module.name)}`;
                }
            });

            moduleList.appendChild(moduleBtn);
        });

        section.appendChild(folderHeader);
        section.appendChild(moduleList);
        content.appendChild(section);
    });
}

async function checkModuleHasWords(moduleId, token) {
    try {
        const res = await fetch(`${BASE_URL}/words/module/${moduleId}`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (!res.ok) return false;

        const words = await res.json();
        return Array.isArray(words) && words.length > 0;
    } catch (error) {
        console.error(error);
        return false;
    }
}