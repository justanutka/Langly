const BASE_URL = "http://127.0.0.1:8000";

document.addEventListener("DOMContentLoaded", () => {

  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "login.html";
    return;
  }

  const foldersContainer = document.getElementById("folders-container");
  const modulesContainer = document.getElementById("modules-container");
  const wordsList = document.getElementById("words-list");

  const foldersView = document.getElementById("folders-view");
  const modulesView = document.getElementById("modules-view");
  const wordsView = document.getElementById("words-view");

  const createFolderBtn = document.getElementById("create-folder-btn");
  const createModuleBtn = document.getElementById("create-module-btn");
  const saveWordBtn = document.getElementById("save-word-btn");

  const folderInput = document.getElementById("folder-name-input");

  const wordInput = document.getElementById("word-input");
  const translationInput = document.getElementById("translation-input");

  const backToFoldersBtn = document.getElementById("back-to-folders");
  const backToModulesBtn = document.getElementById("back-to-modules");

  const folderTitle = document.getElementById("folder-title");
  const moduleTitle = document.getElementById("module-title");

  let currentFolderId = null;
  let currentModuleId = null;

  // =========================
  // LOAD FOLDERS
  // =========================

  async function loadFolders() {

    const res = await fetch(BASE_URL + "/folders/", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const folders = await res.json();

    renderFolders(folders);
  }

  // =========================
  // RENDER FOLDERS
  // =========================

  function renderFolders(folders) {

    foldersContainer.innerHTML = "";

    folders.forEach(folder => {

      const card = document.createElement("div");
      card.className = "folder-card";

      card.innerHTML = `
        <div class="folder-title">📁 ${folder.name}</div>
      `;

      card.addEventListener("click", () => openFolder(folder));

      foldersContainer.appendChild(card);
    });
  }

  // =========================
  // CREATE FOLDER
  // =========================

  createFolderBtn.addEventListener("click", async () => {

    const name = folderInput.value.trim();

    if (!name) return;

    await fetch(BASE_URL + "/folders?name=" + name, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    folderInput.value = "";

    loadFolders();
  });

  // =========================
  // OPEN FOLDER
  // =========================

  async function openFolder(folder) {

    currentFolderId = folder.id;

    foldersView.style.display = "none";
    modulesView.style.display = "block";

    folderTitle.textContent = folder.name;

    loadModules(folder.id);
  }

  // =========================
  // LOAD MODULES
  // =========================

  async function loadModules(folderId) {

    const res = await fetch(BASE_URL + "/modules/" + folderId, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const modules = await res.json();

    renderModules(modules);
  }

  // =========================
  // RENDER MODULES
  // =========================

  function renderModules(modules) {

    modulesContainer.innerHTML = "";

    modules.forEach(module => {

      const card = document.createElement("div");
      card.className = "module-card";

      card.innerHTML = `
        <div style="font-weight:600;">🧠 ${module.name}</div>
      `;

      card.addEventListener("click", () => openModule(module));

      modulesContainer.appendChild(card);
    });
  }

  // =========================
  // CREATE MODULE
  // =========================

  const moduleInput = document.getElementById("module-name-input");

  createModuleBtn.addEventListener("click", async () => {

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

    loadModules(currentFolderId);
  });

  // =========================
  // OPEN MODULE
  // =========================

  async function openModule(module) {

    currentModuleId = module.id;

    modulesView.style.display = "none";
    wordsView.style.display = "block";

    moduleTitle.textContent = module.name;

    loadWords();
  }

  // =========================
  // LOAD WORDS
  // =========================

  async function loadWords() {

    const user = await fetch(BASE_URL + "/users/me", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const userData = await user.json();

    const languageId = userData.active_language_id;

    const res = await fetch(
      `${BASE_URL}/words?language_id=${languageId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const words = await res.json();

    const moduleWords = words.filter(w => w.module_id === currentModuleId);

    renderWords(moduleWords);
  }

  // =========================
  // RENDER WORDS
  // =========================

  function renderWords(words) {

    wordsList.innerHTML = "";

    words.forEach(word => {

      const item = document.createElement("div");
      item.className = "word-item";

      item.innerHTML = `
        <div>${word.word}</div>
        <div>${word.translation}</div>
      `;

      wordsList.appendChild(item);
    });
  }

  // =========================
  // CREATE WORD
  // =========================

  saveWordBtn.addEventListener("click", async () => {

    const word = wordInput.value.trim();
    const translation = translationInput.value.trim();

    if (!word || !translation) return;

    const user = await fetch(BASE_URL + "/users/me", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const userData = await user.json();

    const languageId = userData.active_language_id;

    await fetch(BASE_URL + "/words/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        language_id: languageId,
        module_id: currentModuleId,
        word: word,
        translation: translation,
        example: null
      })
    });

    wordInput.value = "";
    translationInput.value = "";

    loadWords();
  });

  // =========================
  // NAVIGATION
  // =========================

  backToFoldersBtn.addEventListener("click", () => {

    modulesView.style.display = "none";
    foldersView.style.display = "block";

  });

  backToModulesBtn.addEventListener("click", () => {

    wordsView.style.display = "none";
    modulesView.style.display = "block";

  });

  loadFolders();

});