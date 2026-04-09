document.addEventListener("DOMContentLoaded", () => {
    const logo = document.getElementById("logo");

    if (logo) {
        logo.addEventListener("click", () => {
            window.location.href = "dashboard.html";
        });
    }

    const token = localStorage.getItem("token");

    if (!token) {
        window.location.href = "login.html";
        return;
    }

    const foldersView = document.getElementById("folders-view");
    const modulesView = document.getElementById("modules-view");
    const wordsView = document.getElementById("words-view");

    const foldersContainer = document.getElementById("folders-grid");
    const modulesContainer = document.getElementById("modules-container");
    const wordsList = document.getElementById("words-list");

    if (!foldersContainer) return;

    const folderInput = document.getElementById("folder-name-input");
    const folderDescription = document.getElementById("folder-description");
    const folderEmoji = document.getElementById("folder-emoji");

    const moduleInput = document.getElementById("module-name-input");

    const wordInput = document.getElementById("word-input");
    const translationInput = document.getElementById("translation-input");

    const wordMessage = document.getElementById("word-message");
    const wordMessageText = document.getElementById("word-message-text");
    const wordMessageClose = document.getElementById("word-message-close");

    const createFolderBtn = document.getElementById("create-folder-btn");
    const createModuleBtn = document.getElementById("create-module-btn");
    const saveWordBtn = document.getElementById("save-word-btn");

    const backToFoldersBtn = document.getElementById("back-to-folders");
    const backToModulesBtn = document.getElementById("back-to-modules");

    const folderTitle = document.getElementById("folder-title");
    const moduleTitle = document.getElementById("module-title");

    const folderModal = document.getElementById("folder-modal");
    const moduleModal = document.getElementById("module-modal");

    const closeFolderModal = document.getElementById("close-folder-modal");
    const closeModuleModal = document.getElementById("close-module-modal");

    const deleteModal = document.getElementById("delete-modal");
    const confirmDeleteBtn = document.getElementById("confirm-delete");
    const cancelDeleteBtn = document.getElementById("cancel-delete");
    const deleteText = document.getElementById("delete-text");

    const openFolderModal = document.getElementById("open-folder-modal");

    const searchInput = document.getElementById("search-input");

    let deleteCallback = null;

    let currentFolderId = null;
    let currentModuleId = null;

    let currentFolders = [];
    let currentModules = [];

    let sortValue = "new";
    let currentView = "folders";

    function showToast(text) {
        const toast = document.getElementById("toast");
        const toastText = document.getElementById("toast-text");

        if (!toast || !toastText) return;

        toastText.textContent = text;

        toast.classList.remove("hidden");
        setTimeout(() => toast.classList.add("show"), 10);

        setTimeout(() => {
            toast.classList.remove("show");
            setTimeout(() => toast.classList.add("hidden"), 300);
        }, 2500);
    }

    async function checkModuleHasWords(moduleId){
        const token = localStorage.getItem("token");

        const user = await getUser();

        const res = await fetch(
            `${BASE_URL}/words/?language_id=${user.active_language_id}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        const words = await res.json();

        return words.some(w => w.module_id == moduleId);
    }

    function showWordMessage(text, type = "error") {
        if (!wordMessage || !wordMessageText) return;

        wordMessageText.textContent = text;
        wordMessage.classList.remove("hidden", "error", "success");
        wordMessage.classList.add(type);
    }

    function hideWordMessage() {
        if (!wordMessage || !wordMessageText) return;

        wordMessageText.textContent = "";
        wordMessage.classList.add("hidden");
        wordMessage.classList.remove("error", "success");
    }

    function saveWordsState() {
        sessionStorage.setItem("langlyWordsView", currentView || "folders");
        sessionStorage.setItem("langlyCurrentFolderId", currentFolderId ?? "");
        sessionStorage.setItem("langlyCurrentModuleId", currentModuleId ?? "");
        sessionStorage.setItem("langlyCurrentFolderTitle", folderTitle?.textContent || "");
        sessionStorage.setItem("langlyCurrentModuleTitle", moduleTitle?.textContent || "");
    }

    function clearModuleState() {
        sessionStorage.setItem("langlyCurrentModuleId", "");
        sessionStorage.setItem("langlyCurrentModuleTitle", "");
    }

    function clearAllWordsState() {
        sessionStorage.setItem("langlyWordsView", "folders");
        sessionStorage.setItem("langlyCurrentFolderId", "");
        sessionStorage.setItem("langlyCurrentModuleId", "");
        sessionStorage.setItem("langlyCurrentFolderTitle", "");
        sessionStorage.setItem("langlyCurrentModuleTitle", "");
    }

    function showFoldersView() {
        currentView = "folders";
        foldersView.style.display = "block";
        modulesView.style.display = "none";
        wordsView.style.display = "none";
        currentFolderId = null;
        currentModuleId = null;
        updateTopButton();
        clearAllWordsState();
    }

    function showModulesView(folderId, folderName = "") {
        currentView = "modules";
        currentFolderId = folderId;
        currentModuleId = null;
        foldersView.style.display = "none";
        modulesView.style.display = "block";
        wordsView.style.display = "none";
        folderTitle.textContent = folderName;
        updateTopButton();
        clearModuleState();
        saveWordsState();
    }

    function showWordsView(module) {
        currentView = "words";
        currentModuleId = module.id;
        foldersView.style.display = "none";
        modulesView.style.display = "none";
        wordsView.style.display = "block";
        moduleTitle.textContent = module.name;
        hideWordMessage();
        saveWordsState();
    }

    function updateTopButton() {
        if (!openFolderModal) return;

        if (currentView === "modules" && currentFolderId) {
            openFolderModal.textContent = "+ Create Module";
            openFolderModal.onclick = () => {
                moduleModal.style.display = "flex";
            };
        } else {
            openFolderModal.textContent = "+ Create Folder";
            openFolderModal.onclick = () => {
                folderModal.style.display = "flex";
            };
        }
    }

    function openDeleteModal(text, callback) {
        deleteText.textContent = text;
        deleteCallback = callback;
        deleteModal.style.display = "flex";
    }

    confirmDeleteBtn.onclick = async () => {
        if (deleteCallback) {
            await deleteCallback();
        }
        deleteModal.style.display = "none";
        deleteCallback = null;
    };

    cancelDeleteBtn.onclick = () => {
        deleteModal.style.display = "none";
        deleteCallback = null;
    };

    deleteModal.onclick = (e) => {
        if (e.target === deleteModal) {
            deleteModal.style.display = "none";
            deleteCallback = null;
        }
    };

    closeFolderModal.onclick = () => {
        folderModal.style.display = "none";
    };

    closeModuleModal.onclick = () => {
        moduleModal.style.display = "none";
    };

    folderModal.onclick = (e) => {
        if (e.target === folderModal) {
            folderModal.style.display = "none";
        }
    };

    moduleModal.onclick = (e) => {
        if (e.target === moduleModal) {
            moduleModal.style.display = "none";
        }
    };

    if (wordMessageClose) {
        wordMessageClose.onclick = () => {
            hideWordMessage();
        };
    }

    if (wordInput) {
        wordInput.addEventListener("input", () => {
            hideWordMessage();
        });
    }

    if (translationInput) {
        translationInput.addEventListener("input", () => {
            hideWordMessage();
        });
    }

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            folderModal.style.display = "none";
            moduleModal.style.display = "none";
            deleteModal.style.display = "none";
            deleteCallback = null;
            hideWordMessage();
        }
    });

    const dropdown = document.getElementById("sort-dropdown");
    if (dropdown) {
        const selected = dropdown.querySelector(".select-selected");
        const items = dropdown.querySelector(".select-items");

        selected.onclick = () => {
            items.classList.toggle("select-hide");
            selected.classList.toggle("active");
        };

        items.querySelectorAll("div").forEach(item => {
            item.onclick = () => {
                selected.textContent = item.textContent;
                sortValue = item.dataset.value;

                items.querySelectorAll("div").forEach(i => i.classList.remove("selected"));
                item.classList.add("selected");

                items.classList.add("select-hide");
                selected.classList.remove("active");

                if (currentView === "modules") {
                    renderModules();
                } else if (currentView === "folders") {
                    renderFolders();
                }
            };
        });
    }

    async function getUser() {
        const res = await fetch(BASE_URL + "/users/me", {
            headers: { Authorization: `Bearer ${token}` }
        });
        return await res.json();
    }

    function applyFilters(list) {
        const search = searchInput?.value.toLowerCase() || "";

        let filtered = list.filter(item =>
            item.name.toLowerCase().includes(search)
        );

        if (sortValue === "az") filtered.sort((a, b) => a.name.localeCompare(b.name));
        if (sortValue === "za") filtered.sort((a, b) => b.name.localeCompare(a.name));
        if (sortValue === "new") filtered.sort((a, b) => b.id - a.id);
        if (sortValue === "old") filtered.sort((a, b) => a.id - b.id);

        return filtered;
    }

    async function loadFolders(force = false) {
        if (currentView !== "folders" && !force) return;

        const res = await fetch(BASE_URL + "/folders/", {
            headers: { Authorization: `Bearer ${token}` }
        });

        currentFolders = await res.json();

        if (currentView === "folders" || force) {
            renderFolders();
        }
    }

    function renderFolders() {
        if (currentView !== "folders") return;

        foldersContainer.innerHTML = "";

        const folders = applyFilters(currentFolders);

        folders.forEach(folder => {
            const card = document.createElement("div");
            card.className = "folder-card";

            card.innerHTML = `
                <div class="folder-top">
                    <div class="folder-emoji">${folder.emoji || "📁"}</div>
                    <div class="folder-title">${folder.name}</div>
                    <button class="delete-btn" type="button">🗑</button>
                </div>
                <div class="folder-description">${folder.description || ""}</div>
            `;

            card.querySelector(".delete-btn").onclick = (e) => {
                e.stopPropagation();

                const cardEl = e.target.closest(".folder-card");

                openDeleteModal("Delete this folder?", async () => {
                    cardEl.classList.add("delete-animation");

                    await new Promise(resolve => setTimeout(resolve, 300));

                    await fetch(`${BASE_URL}/folders/${folder.id}`, {
                        method: "DELETE",
                        headers: { Authorization: `Bearer ${token}` }
                    });

                    history.pushState(null, "", "my-words.html");
                    showFoldersView();
                    await loadFolders(true);
                });
            };

            card.onclick = () => {
                history.pushState(null, "", `?folder=${folder.id}`);
                openFolder(folder);
            };

            foldersContainer.appendChild(card);
        });

        const createCard = document.createElement("div");
        createCard.className = "folder-create-card";

        createCard.innerHTML = `
            <div class="plus">+</div>
            <div>Create folder</div>
        `;

        createCard.onclick = () => {
            folderModal.style.display = "flex";
        };

        foldersContainer.appendChild(createCard);
    }

    createFolderBtn.onclick = async () => {
        const name = folderInput.value.trim();
        const description = folderDescription.value.trim();
        const emoji = folderEmoji.value.trim();

        if (!name) return;

        await fetch(`${BASE_URL}/folders/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ name, description, emoji })
        });

        folderModal.style.display = "none";
        folderInput.value = "";
        folderDescription.value = "";
        folderEmoji.value = "";

        if (currentView === "folders") {
            await loadFolders(true);
        }
    };

    createModuleBtn.onclick = async () => {
        const name = moduleInput.value.trim();

        if (!name || !currentFolderId) return;

        await fetch(`${BASE_URL}/modules/?name=${name}&folder_id=${currentFolderId}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` }
        });

        moduleModal.style.display = "none";
        moduleInput.value = "";

        if (currentFolderId) {
            showModulesView(currentFolderId, folderTitle.textContent);
            await loadModules(currentFolderId);
        }
    };

    async function loadModules(folderId) {
        if (!folderId) return;

        const res = await fetch(`${BASE_URL}/modules/${folderId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        currentModules = await res.json();

        if (currentView === "modules") {
            renderModules();
        }
    }

    function goToFlashcards(moduleId, moduleName) {
        sessionStorage.setItem("langlyCurrentFolderId", currentFolderId ?? "");
        sessionStorage.setItem("langlyCurrentModuleId", moduleId ?? "");
        sessionStorage.setItem("langlyCurrentFolderTitle", folderTitle?.textContent || "");
        sessionStorage.setItem("langlyCurrentModuleTitle", moduleName || "");

        window.location.href = `flashcards.html?module=${moduleId}&name=${encodeURIComponent(moduleName)}`;
    }

    function goToQuiz(moduleId) {
        sessionStorage.setItem("langlyCurrentFolderId", currentFolderId ?? "");
        sessionStorage.setItem("langlyCurrentModuleId", moduleId ?? "");
        sessionStorage.setItem("langlyCurrentFolderTitle", folderTitle?.textContent || "");
        window.location.href = `quiz.html?module=${moduleId}`;
    }

    function renderModules() {
    if (currentView !== "modules") return;

    modulesContainer.innerHTML = "";

    const modules = applyFilters(currentModules);

    modules.forEach(module => {
        const card = document.createElement("div");
        card.className = "module-card";

        card.innerHTML = `
            <div class="module-top">
                <div class="module-name">${module.name}</div>
                <button class="delete-btn" type="button">🗑</button>
            </div>

            <div class="module-actions">
                <button class="study-btn cards-btn" type="button">Cards</button>
                <button class="study-btn quiz-btn" type="button">Quiz</button>
            </div>
        `;

        const deleteBtn = card.querySelector(".delete-btn");
        const cardsBtn = card.querySelector(".cards-btn");
        const quizBtn = card.querySelector(".quiz-btn");

        deleteBtn.onclick = (e) => {
            e.stopPropagation();

            const cardEl = e.target.closest(".module-card");

            openDeleteModal("Delete this module?", async () => {
                cardEl.classList.add("delete-animation");

                await new Promise(resolve => setTimeout(resolve, 300));

                await fetch(`${BASE_URL}/modules/${module.id}`, {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (currentFolderId) {
                    showModulesView(currentFolderId, folderTitle.textContent);
                    await loadModules(currentFolderId);
                }
            });
        };

        cardsBtn.onclick = async (e) => {
            e.stopPropagation();

            const hasWords = await checkModuleHasWords(module.id);

            if (!hasWords) {
                showToast("This module has no words yet");
                return;
            }

            goToFlashcards(module.id, module.name);
        };

        quizBtn.onclick = async (e) => {
            e.stopPropagation();

            const hasWords = await checkModuleHasWords(module.id);

            if (!hasWords) {
                showToast("Add words before starting quiz");
                return;
            }

            goToQuiz(module.id);
        };

        card.onclick = () => openModule(module);

        modulesContainer.appendChild(card);
    });

    const createCard = document.createElement("div");
    createCard.className = "folder-create-card";

    createCard.innerHTML = `
        <div class="plus">+</div>
        <div>Create module</div>
    `;

    createCard.onclick = () => {
        moduleModal.style.display = "flex";
    };

    modulesContainer.appendChild(createCard);
}

    async function openFolder(folder) {
        showModulesView(folder.id, folder.name);
        saveWordsState();
        await loadModules(folder.id);
    }

    async function openModule(module) {
        showWordsView(module);
        saveWordsState();
        await loadWords();
    }

    async function loadWords() {
        const user = await getUser();

        const res = await fetch(
            `${BASE_URL}/words/?language_id=${user.active_language_id}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        const words = await res.json();
        const filtered = words.filter(w => w.module_id === currentModuleId);

        wordsList.innerHTML = "";

        filtered.forEach(word => {
            const item = document.createElement("div");
            item.className = "word-item";

            item.innerHTML = `
                <div class="word-left">
                    <div class="word-main">${word.word}</div>
                </div>

                <div class="word-right">
                    <div class="word-translation">${word.translation}</div>
                    <button class="delete-word-btn" type="button">🗑</button>
                </div>
            `;

            const deleteBtn = item.querySelector(".delete-word-btn");

            deleteBtn.onclick = async () => {
                openDeleteModal(`Delete word "${word.word}"?`, async () => {
                    await fetch(`${BASE_URL}/words/${word.id}`, {
                        method: "DELETE",
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    });

                    await loadWords();
                    hideWordMessage();
                });
            };

            wordsList.appendChild(item);
        });
    }

    saveWordBtn.onclick = async () => {
        const word = wordInput.value.trim();
        const translation = translationInput.value.trim();

        hideWordMessage();

        if (!word || !translation) {
            showWordMessage("Please fill in both fields.", "error");
            return;
        }

        if (!currentModuleId) {
            showWordMessage("Please open a module first.", "error");
            return;
        }

        saveWordsState();

        try {
            const user = await getUser();

            const res = await fetch(`${BASE_URL}/words/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    language_id: user.active_language_id,
                    module_id: currentModuleId,
                    word,
                    translation,
                    example: null
                })
            });

            const data = await res.json().catch(() => null);

            if (!res.ok) {
                const errorText = data?.detail || "Something went wrong while adding the word.";
                showWordMessage(errorText, "error");
                return;
            }

            wordInput.value = "";
            translationInput.value = "";

            hideWordMessage();
            await loadWords();
        } catch (error) {
            showWordMessage("Server connection error. Please try again.", "error");
            console.error(error);
        }
    };

    backToFoldersBtn.onclick = async () => {
        history.pushState(null, "", "my-words.html");
        showFoldersView();
        await loadFolders(true);
    };

    backToModulesBtn.onclick = async () => {
        if (currentFolderId) {
            showModulesView(currentFolderId, folderTitle.textContent);
            await loadModules(currentFolderId);
        }
    };

    if (searchInput) {
        searchInput.addEventListener("input", () => {
            if (currentView === "modules") renderModules();
            else if (currentView === "folders") renderFolders();
        });
    }

    (async () => {
        await loadFolders(true);

        const params = new URLSearchParams(window.location.search);
        const folderIdFromUrl = params.get("folder");

        const savedView = sessionStorage.getItem("langlyWordsView");
        const savedFolderId = sessionStorage.getItem("langlyCurrentFolderId");
        const savedModuleId = sessionStorage.getItem("langlyCurrentModuleId");

        if (folderIdFromUrl) {
            const folder = currentFolders.find(f => f.id == folderIdFromUrl);

            if (folder) {
                await openFolder(folder);

                if (savedModuleId) {
                    const module = currentModules.find(m => m.id == savedModuleId);

                    if (module) {
                        await openModule(module);
                        return;
                    }
                }

                return;
            }
        }

        if (savedFolderId) {
            const savedFolder = currentFolders.find(f => f.id == savedFolderId);

            if (savedFolder) {
                await openFolder(savedFolder);

                if (savedView === "words" && savedModuleId) {
                    const savedModule = currentModules.find(m => m.id == savedModuleId);

                    if (savedModule) {
                        await openModule(savedModule);
                        return;
                    }
                }

                return;
            }
        }

        showFoldersView();
        await loadFolders(true);
    })();
});