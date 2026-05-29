const SIDEBAR_BASE_URL = "http://127.0.0.1:8000";

async function loadSidebar(options = {}) {
    const container = document.getElementById("sidebar-container");
    if (!container) return;

    const res = await fetch("components/sidebar.html");
    const html = await res.text();

    container.innerHTML = html;

    initSidebar();
    initNewFolderButton();
    initStudyPicker();
    window.langlyUiText?.apply(container);
    await loadSidebarUserData(options.user);
}

/* SIDEBAR TOGGLE */
function initSidebar() {
    const toggle = document.getElementById("sidebar-toggle");
    const sidebar = document.querySelector(".sidebar");
    const host = document.getElementById("sidebar-container");

    if (!toggle || !sidebar || !host) return;

    const isCollapsed = localStorage.getItem("langlySidebarCollapsed") === "1";
    if (isCollapsed) {
        sidebar.classList.add("collapsed");
        host.classList.add("is-collapsed");
    }

    toggle.addEventListener("click", () => {
        sidebar.classList.toggle("collapsed");
        host.classList.toggle("is-collapsed");
        localStorage.setItem(
            "langlySidebarCollapsed",
            sidebar.classList.contains("collapsed") ? "1" : "0"
        );
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

async function loadSidebarUserData(providedUser = null) {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
        let user = providedUser || window.langlyCurrentUser || null;
        if (!user && window.langlyUiText?.init) {
            await window.langlyUiText.init();
            user = window.langlyCurrentUser || null;
        }

        if (!user) {
            const userRes = await fetch(`${SIDEBAR_BASE_URL}/users/me`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (userRes.ok) {
                user = await userRes.json();
                window.langlyCurrentUser = user;
            }
        }

        const emailElement = document.getElementById("user-email");

        if (emailElement && user) {
            emailElement.textContent = user.email || "";
        }
    } catch (error) {
        console.error("Sidebar user load error:", error);
    }

    await loadSidebarFolders();
}

async function loadSidebarFolders() {
    const token = localStorage.getItem("token");
    const container = document.getElementById("folders-container");

    if (!token || !container) return;

    try {
        const folders = window.langlyApi?.getFolders
            ? await window.langlyApi.getFolders()
            : await fetch(`${SIDEBAR_BASE_URL}/folders/`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }).then((res) => res.ok ? res.json() : []);
        const recentFolders = folders.slice(-4).reverse();

        container.innerHTML = "";

        recentFolders.forEach(folder => {
            const item = document.createElement("div");
            item.className = "folder-item";

            item.innerHTML = `
                <span class="icon">${folder.emoji || "📁"}</span>
                <span class="folder-name">${folder.name}</span>
            `;

            item.addEventListener("click", () => {
                const isLibraryPage = window.location.pathname.includes("my-words.html") ||
                    Boolean(document.getElementById("folders-view"));

                if (isLibraryPage) {
                    if (typeof window.openFolderFromSidebar === "function") {
                        window.openFolderFromSidebar(folder);
                    } else {
                        window.langlyPendingSidebarFolder = folder;
                        window.history.pushState(null, "", `?folder=${folder.id}`);
                    }
                } else {
                    sessionStorage.setItem("langlyCurrentFolderId", folder.id ?? "");
                    sessionStorage.setItem("langlyCurrentFolderTitle", folder.name || "");
                    document.body?.classList.add("page-transitioning");
                    window.location.href = `my-words.html?folder=${folder.id}`;
                }
            });

            container.appendChild(item);
        });
    } catch (error) {
        console.error("Sidebar folders load error:", error);
    }
}

function initStudyPicker() {
    const lessonBtn = document.getElementById("sidebar-lesson-btn");
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
    let closeTimer = null;

    lessonBtn?.addEventListener("click", async () => {
        await openStudyPicker("lesson");
    });

    cardsBtn.addEventListener("click", async () => {
        await openStudyPicker("cards");
    });

    quizBtn.addEventListener("click", async () => {
        await openStudyPicker("quiz");
    });

    function openStudyPickerModal() {
        window.clearTimeout(closeTimer);
        modal.classList.add("is-open");
    }

    function closeStudyPickerModal({ reset = true } = {}) {
        modal.classList.remove("is-open");

        if (!reset) return;

        closeTimer = window.setTimeout(() => {
            if (modal.classList.contains("is-open")) return;
            content.innerHTML = "";
            searchInput.value = "";
            currentData = [];
        }, 220);
    }

    function navigateWithFade(url) {
        closeStudyPickerModal({ reset: false });
        document.body?.classList.add("page-transitioning");
        window.setTimeout(() => {
            window.location.href = url;
        }, 140);
    }

    closeBtn.addEventListener("click", () => {
        closeStudyPickerModal();
    });

    modal.addEventListener("click", (e) => {
        if (e.target === modal) {
            closeStudyPickerModal();
        }
    });

    searchInput.addEventListener("input", () => {
        renderStudyPickerContent(
            currentData,
            currentMode,
            content,
            searchInput.value.trim().toLowerCase(),
            navigateWithFade
        );
    });

    async function openStudyPicker(mode) {
        currentMode = mode;
        currentData = [];

        title.textContent = mode === "lesson"
            ? window.langlyUiText?.t("study.choose_lesson") || "Choose module for lesson"
            : mode === "cards"
                ? window.langlyUiText?.t("study.choose_cards") || "Choose module for cards"
                : window.langlyUiText?.t("study.choose_quiz") || "Choose module for quiz";

        searchInput.value = "";
        content.innerHTML = `<div class="study-picker-loading">${window.langlyUiText?.t("common.loading") || "Loading..."}</div>`;
        openStudyPickerModal();

        try {
            const token = localStorage.getItem("token");
            if (!token) {
                window.location.href = "login.html";
                return;
            }

            const foldersRes = await fetch(`${SIDEBAR_BASE_URL}/folders/`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (!foldersRes.ok) {
                content.innerHTML = `<div class="study-picker-empty">${window.langlyUiText?.t("study.load_error") || "Could not load folders."}</div>`;
                return;
            }

            const folders = await foldersRes.json();

            if (!folders.length) {
                content.innerHTML = `<div class="study-picker-empty">${window.langlyUiText?.t("study.no_folders") || "No folders yet."}</div>`;
                return;
            }

            const modulesByFolder = await Promise.all(
                folders.map(async (folder) => {
                    const modulesRes = await fetch(`${SIDEBAR_BASE_URL}/modules/${folder.id}`, {
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
                content.innerHTML = `<div class="study-picker-empty">${window.langlyUiText?.t("study.no_modules") || "No modules available yet."}</div>`;
                return;
            }

            renderStudyPickerContent(currentData, currentMode, content, "", navigateWithFade);
        } catch (error) {
            console.error(error);
            content.innerHTML = `<div class="study-picker-empty">${window.langlyUiText?.t("common.error") || "Something went wrong."}</div>`;
        }
    }

    // Prevent the "#" nav-item from jumping the page (it causes a visible "jerk")
    const legacyCardsLink = document.querySelector('.sidebar-nav a.nav-item[href="#"]');
    if (legacyCardsLink) {
        legacyCardsLink.addEventListener("click", async (e) => {
            e.preventDefault();
            await openStudyPicker("cards");
        });
    }
}

function renderStudyPickerContent(data, mode, content, searchTerm = "", navigate = null) {
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
        content.innerHTML = `<div class="study-picker-empty">${window.langlyUiText?.t("study.no_matches") || "No matching modules found."}</div>`;
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

                if (mode === "lesson") {
                    const url = `lesson.html?module=${module.id}&name=${encodeURIComponent(module.name)}`;
                    if (typeof navigate === "function") {
                        navigate(url);
                    } else {
                        window.location.href = url;
                    }
                } else if (mode === "cards") {
                    const url = `flashcards.html?module=${module.id}&name=${encodeURIComponent(module.name)}`;
                    if (typeof navigate === "function") {
                        navigate(url);
                    } else {
                        window.location.href = url;
                    }
                } else {
                    const url = `quiz.html?module=${module.id}&name=${encodeURIComponent(module.name)}`;
                    if (typeof navigate === "function") {
                        navigate(url);
                    } else {
                        window.location.href = url;
                    }
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
        const res = await fetch(`${SIDEBAR_BASE_URL}/words/module/${moduleId}`, {
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
