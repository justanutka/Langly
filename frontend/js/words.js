
document.addEventListener("DOMContentLoaded", () => {

    const token = localStorage.getItem("token");

    if (!token) {
        window.location.href = "login.html";
        return;
    }

    /* -----------------------------
       VIEWS
    ----------------------------- */

    const foldersView = document.getElementById("folders-view");
    const modulesView = document.getElementById("modules-view");
    const wordsView = document.getElementById("words-view");

    /* -----------------------------
       CONTAINERS
    ----------------------------- */

    const foldersContainer = document.getElementById("folders-grid");
    const modulesContainer = document.getElementById("modules-container");
    const wordsList = document.getElementById("words-list");

    if (!foldersContainer) return;

    /* -----------------------------
       INPUTS
    ----------------------------- */

    const folderInput = document.getElementById("folder-name-input");
    const folderDescription = document.getElementById("folder-description");
    const folderEmoji = document.getElementById("folder-emoji");

    const moduleInput = document.getElementById("module-name-input");

    const wordInput = document.getElementById("word-input");
    const translationInput = document.getElementById("translation-input");

    /* -----------------------------
       BUTTONS
    ----------------------------- */

    const createFolderBtn = document.getElementById("create-folder-btn");
    const createModuleBtn = document.getElementById("create-module-btn");
    const saveWordBtn = document.getElementById("save-word-btn");

    const backToFoldersBtn = document.getElementById("back-to-folders");
    const backToModulesBtn = document.getElementById("back-to-modules");

    /* -----------------------------
       TITLES
    ----------------------------- */

    const folderTitle = document.getElementById("folder-title");
    const moduleTitle = document.getElementById("module-title");

    /* -----------------------------
       MODALS
    ----------------------------- */

    const folderModal = document.getElementById("folder-modal");
    const moduleModal = document.getElementById("module-modal");

    const openFolderModal = document.getElementById("open-folder-modal");
    const closeFolderModal = document.getElementById("close-folder-modal");
    const closeModuleModal = document.getElementById("close-module-modal");

    /* -----------------------------
       STATE
    ----------------------------- */

    let currentFolderId = null;
    let currentModuleId = null;

    /* -----------------------------
       USER
    ----------------------------- */

    async function getUser() {

        const res = await fetch(BASE_URL + "/users/me", {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        return await res.json();
    }

    /* -----------------------------
       MODALS
    ----------------------------- */

    if (openFolderModal) {
        openFolderModal.onclick = () => folderModal.style.display = "flex";
    }

    if (closeFolderModal) {
        closeFolderModal.onclick = () => folderModal.style.display = "none";
    }

    if (closeModuleModal) {
        closeModuleModal.onclick = () => moduleModal.style.display = "none";
    }

    /* -----------------------------
       LOAD FOLDERS
    ----------------------------- */

    async function loadFolders() {

        const res = await fetch(BASE_URL + "/folders/", {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const folders = await res.json();

        foldersContainer.innerHTML = "";

        folders.forEach(folder => {

            const card = document.createElement("div");
            card.className = "folder-card";

            card.innerHTML = `
                <div class="folder-top">
                    <div class="folder-emoji">
                        ${folder.emoji || "📁"}
                    </div>

                    <div class="folder-title">
                        ${folder.name}
                    </div>
                </div>

                <div class="folder-description">
                    ${folder.description || ""}
                </div>

                <div class="folder-actions">
                    <div class="action-pill">Cards</div>
                    <div class="action-pill quiz-pill">Quiz</div>
                    <div class="action-pill test-pill">Test</div>
                </div>
            `;

            card.onclick = () => openFolder(folder);

            foldersContainer.appendChild(card);

        });

        const createCard = document.createElement("div");
        createCard.className = "folder-create-card";

        createCard.innerHTML = `
            <div class="plus">+</div>
            <div>Create folder</div>
        `;

        card.onclick = () => {

            history.pushState(null, "", `?folder=${folder.id}`);

            openFolder(folder);

        };

        foldersContainer.appendChild(createCard);
    }

    /* -----------------------------
       CREATE FOLDER
    ----------------------------- */

    createFolderBtn.onclick = async () => {

        const name = folderInput.value.trim();
        const description = folderDescription.value.trim();
        const emoji = folderEmoji.value.trim();

        if (!name) return;

        await fetch(
            `${BASE_URL}/folders?name=${name}&description=${description}&emoji=${emoji}`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        folderInput.value = "";
        folderDescription.value = "";
        folderEmoji.value = "";

        folderModal.style.display = "none";

        loadFolders();
    };

    /* -----------------------------
       OPEN FOLDER
    ----------------------------- */

    async function openFolder(folder) {

        history.pushState(null, "", `?folder=${folder.id}`);

        currentFolderId = folder.id;

        foldersView.style.display = "none";
        modulesView.style.display = "block";

        folderTitle.textContent = folder.name;

        loadModules(folder.id);
    }

    window.openFolderFromSidebar = async function(folderId) {

        const res = await fetch(BASE_URL + "/folders/", {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const folders = await res.json();

        const folder = folders.find(f => f.id == folderId);

        if (folder) {
            openFolder(folder);
        }

    }

    /* -----------------------------
       LOAD MODULES
    ----------------------------- */

    async function loadModules(folderId) {

        const res = await fetch(`${BASE_URL}/modules/${folderId}`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const modules = await res.json();

        modulesContainer.innerHTML = "";

        modules.forEach(module => {

            const card = document.createElement("div");
            card.className = "module-card";

            card.innerHTML = `
                <div class="module-icon">🧠</div>
                <div class="module-name">${module.name}</div>
            `;

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

    /* -----------------------------
       CREATE MODULE
    ----------------------------- */

    createModuleBtn.onclick = async () => {

        const name = moduleInput.value.trim();

        if (!name) return;

        await fetch(
            `${BASE_URL}/modules?folder_id=${currentFolderId}&name=${name}`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        moduleInput.value = "";

        moduleModal.style.display = "none";

        loadModules(currentFolderId);
    };

    /* -----------------------------
       OPEN MODULE
    ----------------------------- */

    async function openModule(module) {

        currentModuleId = module.id;

        modulesView.style.display = "none";
        wordsView.style.display = "block";

        moduleTitle.textContent = module.name;

        loadWords();
    }

    /* -----------------------------
       LOAD WORDS
    ----------------------------- */

    async function loadWords() {

        const user = await getUser();

        const res = await fetch(
            `${BASE_URL}/words/?language_id=${user.active_language_id}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const words = await res.json();

        const filtered = words.filter(w => w.module_id === currentModuleId);

        wordsList.innerHTML = "";

        filtered.forEach(word => {

            const item = document.createElement("div");
            item.className = "word-item";

            item.innerHTML = `
                <div class="word-main">
                    ${word.word}
                </div>

                <div class="word-translation">
                    ${word.translation}
                </div>
            `;

            wordsList.appendChild(item);

        });

    }

    /* -----------------------------
       ADD WORD
    ----------------------------- */

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
                word: word,
                translation: translation,
                example: null
            })
        });

        wordInput.value = "";
        translationInput.value = "";

        loadWords();
    };

    /* -----------------------------
       NAVIGATION
    ----------------------------- */

    backToFoldersBtn.onclick = () => {

        modulesView.style.display = "none";
        foldersView.style.display = "block";

    };

    backToModulesBtn.onclick = () => {

        wordsView.style.display = "none";
        modulesView.style.display = "block";

    };

    /* -----------------------------
       INIT
    ----------------------------- */

   setTimeout(async () => {

        await loadFolders();

        const params = new URLSearchParams(window.location.search);

        /* OPEN FOLDER FROM SIDEBAR */

        const folderId = params.get("folder");

        if (folderId) {

            const res = await fetch(BASE_URL + "/folders/", {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`
                }
            });

            const folders = await res.json();

            const folder = folders.find(f => f.id == folderId);

            if (folder) {
                openFolder(folder);
            }

        }

        /* OPEN CREATE FOLDER MODAL */

        if (params.get("create") === "true") {

            const modal = document.getElementById("folder-modal");

            if (modal) modal.style.display = "flex";

        }

    }, 50);
});

function getFolderFromURL() {

    const params = new URLSearchParams(window.location.search);
    return params.get("folder");

}

window.openFolderFromSidebar = async function(folderId) {

    try {

        const res = await fetch(BASE_URL + "/folders/", {
            headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`
            }
        });

        const folders = await res.json();

        const folder = folders.find(f => f.id == folderId);

        if (!folder) return;

        openFolder(folder);

    } catch (error) {

        console.error("Sidebar folder open error:", error);

    }

};
