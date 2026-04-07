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

    let deleteCallback = null;

    let currentFolderId = null;
    let currentModuleId = null;

    let currentFolders = [];
    let currentModules = [];

    let sortValue = "new";

    const searchInput = document.getElementById("search-input");

    function updateTopButton() {
        if (!openFolderModal) return;

        if (currentFolderId) {
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
        if (deleteCallback) await deleteCallback();
        deleteModal.style.display = "none";
    };

    if (cancelDeleteBtn) {
        cancelDeleteBtn.onclick = () => {
            deleteModal.style.display = "none";
        };
    }

    deleteModal.onclick = (e) => {
        if (e.target === deleteModal) {
            deleteModal.style.display = "none";
        }
    };

    if (closeFolderModal) {
        closeFolderModal.onclick = () => {
            folderModal.style.display = "none";
        };
    }

    if (closeModuleModal) {
        closeModuleModal.onclick = () => {
            moduleModal.style.display = "none";
        };
    }

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

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            folderModal.style.display = "none";
            moduleModal.style.display = "none";
            if (deleteModal) deleteModal.style.display = "none";
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

                if (currentFolderId) renderModules();
                else renderFolders();
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

    async function loadFolders() {
        const res = await fetch(BASE_URL + "/folders/", {
            headers: { Authorization: `Bearer ${token}` }
        });

        currentFolders = await res.json();
        renderFolders();
    }

    function renderFolders() {
        foldersContainer.innerHTML = "";

        const folders = applyFilters(currentFolders);

        folders.forEach(folder => {
            const card = document.createElement("div");
            card.className = "folder-card";

            card.innerHTML = `
                <div class="folder-top">
                    <div class="folder-emoji">${folder.emoji || "📁"}</div>
                    <div class="folder-title">${folder.name}</div>
                    <button class="delete-btn">🗑</button>
                </div>
                <div class="folder-description">${folder.description || ""}</div>
            `;

            card.querySelector(".delete-btn").onclick = (e) => {
                e.stopPropagation();

                openDeleteModal("Delete this folder?", async () => {
                    await fetch(`${BASE_URL}/folders/${folder.id}`, {
                        method: "DELETE",
                        headers: { Authorization: `Bearer ${token}` }
                    });

                    loadFolders();
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

        loadFolders();
    };

    async function loadModules(folderId) {
        const res = await fetch(`${BASE_URL}/modules/${folderId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        currentModules = await res.json();
        renderModules();
    }

    function renderModules() {
        modulesContainer.innerHTML = "";

        const modules = applyFilters(currentModules);

        modules.forEach(module => {
            const card = document.createElement("div");
            card.className = "module-card";

            card.innerHTML = `
                <div class="module-name">${module.name}</div>
                <button class="delete-btn">🗑</button>
            `;

            card.querySelector(".delete-btn").onclick = (e) => {
                e.stopPropagation();

                openDeleteModal("Delete this module?", async () => {
                    await fetch(`${BASE_URL}/modules/${module.id}`, {
                        method: "DELETE",
                        headers: { Authorization: `Bearer ${token}` }
                    });

                    loadModules(currentFolderId);
                });
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

    createModuleBtn.onclick = async () => {
        const name = moduleInput.value.trim();
        if (!name || !currentFolderId) return;

        await fetch(`${BASE_URL}/modules/?name=${name}&folder_id=${currentFolderId}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` }
        });

        moduleModal.style.display = "none";
        moduleInput.value = "";

        loadModules(currentFolderId);
    };

    async function openFolder(folder) {
        currentFolderId = folder.id;

        foldersView.style.display = "none";
        modulesView.style.display = "block";

        folderTitle.textContent = folder.name;

        updateTopButton();
        loadModules(folder.id);
    }

    window.openFolderFromSidebar = async function(folderId) {
        const res = await fetch(BASE_URL + "/folders/", {
            headers: { Authorization: `Bearer ${token}` }
        });

        const folders = await res.json();
        const folder = folders.find(f => f.id == folderId);

        if (folder) openFolder(folder);
    };

    async function openModule(module) {
        currentModuleId = module.id;

        modulesView.style.display = "none";
        wordsView.style.display = "block";

        moduleTitle.textContent = module.name;

        loadWords();
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
                <div class="word-main">${word.word}</div>
                <div class="word-translation">${word.translation}</div>
            `;

            wordsList.appendChild(item);
        });
    }

    saveWordBtn.onclick = async () => {
        const word = wordInput.value.trim();
        const translation = translationInput.value.trim();

        if (!word || !translation) return;

        const user = await getUser();

        await fetch(BASE_URL + "/words/", {
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

        loadWords();
    };

    backToFoldersBtn.onclick = () => {
        modulesView.style.display = "none";
        foldersView.style.display = "block";
        currentFolderId = null;

        updateTopButton();
    };

    backToModulesBtn.onclick = () => {
        wordsView.style.display = "none";
        modulesView.style.display = "block";
    };

    if (searchInput) {
        searchInput.addEventListener("input", () => {
            if (currentFolderId) renderModules();
            else renderFolders();
        });
    }

    (async () => {
        await loadFolders();
        updateTopButton();

        const params = new URLSearchParams(window.location.search);
        const folderId = params.get("folder");

        if (folderId) {
            openFolderFromSidebar(folderId);
        }
    })();

});