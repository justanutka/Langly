const BASE_URL = "http://127.0.0.1:8000";

document.addEventListener("DOMContentLoaded", () => {

    const token = localStorage.getItem("token");

    if (!token) {
        window.location.href = "login.html";
        return;
    }

    const foldersView = document.getElementById("folders-view");
    const modulesView = document.getElementById("modules-view");
    const wordsView = document.getElementById("words-view");

    const foldersContainer = document.getElementById("folders-container");
    const modulesContainer = document.getElementById("modules-container");
    const wordsList = document.getElementById("words-list");

    const folderInput = document.getElementById("folder-name-input");
    const moduleInput = document.getElementById("module-name-input");

    const createFolderBtn = document.getElementById("create-folder-btn");
    const createModuleBtn = document.getElementById("create-module-btn");
    const saveWordBtn = document.getElementById("save-word-btn");

    const wordInput = document.getElementById("word-input");
    const translationInput = document.getElementById("translation-input");

    const backToFoldersBtn = document.getElementById("back-to-folders");
    const backToModulesBtn = document.getElementById("back-to-modules");

    const folderTitle = document.getElementById("folder-title");
    const moduleTitle = document.getElementById("module-title");

    let currentFolderId = null;
    let currentModuleId = null;

    async function getUser() {

        const res = await fetch(BASE_URL + "/users/me", {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        return await res.json();
    }

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

            card.innerHTML = `📁 ${folder.name}`;

            card.onclick = () => openFolder(folder);

            foldersContainer.appendChild(card);
        });
    }

    createFolderBtn.onclick = async () => {

        const name = folderInput.value.trim();

        if (!name) return;

        await fetch(`${BASE_URL}/folders?name=${name}`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        folderInput.value = "";

        loadFolders();
    };

    async function openFolder(folder) {

        currentFolderId = folder.id;

        foldersView.style.display = "none";
        modulesView.style.display = "block";

        folderTitle.textContent = folder.name;

        loadModules(folder.id);
    }

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

            card.innerHTML = `🧠 ${module.name}`;

            card.onclick = () => openModule(module);

            modulesContainer.appendChild(card);
        });
    }

    createModuleBtn.onclick = async () => {

        const name = moduleInput.value.trim();

        if (!name) return;

        await fetch(`${BASE_URL}/modules?folder_id=${currentFolderId}&name=${name}`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        moduleInput.value = "";

        loadModules(currentFolderId);
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

            item.innerHTML = `${word.word} — ${word.translation}`;

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
                word: word,
                translation: translation,
                example: null
            })
        });

        wordInput.value = "";
        translationInput.value = "";

        loadWords();
    };

    backToFoldersBtn.onclick = () => {
        modulesView.style.display = "none";
        foldersView.style.display = "block";
    };

    backToModulesBtn.onclick = () => {
        wordsView.style.display = "none";
        modulesView.style.display = "block";
    };

    loadFolders();

});