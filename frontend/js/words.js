const BASE_URL = "http://127.0.0.1:8000";

document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("folders-view")) return;

  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "login.html";
    return;
  }

  let folders = JSON.parse(localStorage.getItem("langly_folders")) || [];
  let currentFolderId = null;

  const foldersView = document.getElementById("folders-view");
  const modulesView = document.getElementById("modules-view");
  const studyView = document.getElementById("study-view");

  const foldersContainer = document.getElementById("folders-container");
  const modulesContainer = document.getElementById("modules-container");
  const folderTitle = document.getElementById("folder-title");
  const studyContent = document.getElementById("study-content");

  const createFolderBtn = document.getElementById("create-folder-btn");
  const createModuleBtn = document.getElementById("create-module-btn");
  const backToFoldersBtn = document.getElementById("back-to-folders");
  const backToModulesBtn = document.getElementById("back-to-modules");

  function saveState() {
    localStorage.setItem("langly_folders", JSON.stringify(folders));
  }

  async function getCurrentUser() {
    const res = await fetch(BASE_URL + "/users/me", {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (!res.ok) {
      throw new Error("Cannot load current user");
    }

    return await res.json();
  }

  async function getActiveLanguageId() {
    const user = await getCurrentUser();

    if (!user.active_language_id) {
      throw new Error("Select active language in profile first");
    }

    return user.active_language_id;
  }

  async function createWordInBackend(word, translation) {
    const languageId = await getActiveLanguageId();

    const res = await fetch(BASE_URL + "/words/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        language_id: languageId,
        word: word,
        translation: translation,
        example: null
      })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.detail || "Failed to create word");
    }

    return data;
  }

  function showFolders() {
    foldersView.style.display = "block";
    modulesView.style.display = "none";
    studyView.style.display = "none";
  }

  function showModules(folderId) {
    currentFolderId = folderId;

    foldersView.style.display = "none";
    modulesView.style.display = "block";
    studyView.style.display = "none";

    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;

    folderTitle.textContent = folder.name;
    renderModules();
  }

  function showStudy() {
    foldersView.style.display = "none";
    modulesView.style.display = "none";
    studyView.style.display = "block";
  }

  if (backToFoldersBtn) {
    backToFoldersBtn.addEventListener("click", showFolders);
  }

  if (backToModulesBtn) {
    backToModulesBtn.addEventListener("click", () => {
      showModules(currentFolderId);
    });
  }

  if (createFolderBtn) {
    createFolderBtn.addEventListener("click", () => {
      const name = prompt("Folder name:");
      if (!name || !name.trim()) return;

      folders.push({
        id: Date.now(),
        name: name.trim(),
        modules: []
      });

      saveState();
      renderFolders();
    });
  }

  if (createModuleBtn) {
    createModuleBtn.addEventListener("click", () => {
      const name = prompt("Module name:");
      if (!name || !name.trim()) return;

      const folder = folders.find(f => f.id === currentFolderId);
      if (!folder) return;

      folder.modules.push({
        id: Date.now(),
        name: name.trim(),
        words: []
      });

      saveState();
      renderModules();
    });
  }

  function renderFolders() {
    if (!foldersContainer) return;

    foldersContainer.innerHTML = "";

    if (folders.length === 0) {
      foldersContainer.innerHTML =
        `<p style="color:#64748B;">No folders yet. Create your first one 🚀</p>`;
      return;
    }

    folders.forEach(folder => {
      const card = document.createElement("div");
      card.className = "folder-card";

      card.innerHTML = `
        <div class="folder-title">📁 ${folder.name}</div>
        <div class="folder-meta">${folder.modules.length} modules</div>
      `;

      card.addEventListener("click", () => {
        showModules(folder.id);
      });

      foldersContainer.appendChild(card);
    });
  }

  function renderModules() {
    if (!modulesContainer) return;

    modulesContainer.innerHTML = "";

    const folder = folders.find(f => f.id === currentFolderId);
    if (!folder) return;

    if (folder.modules.length === 0) {
      modulesContainer.innerHTML =
        `<p style="color:#64748B;">No modules yet. Create one 📚</p>`;
      return;
    }

    folder.modules.forEach(module => {
      const card = document.createElement("div");
      card.className = "module-card";

      const wordsCount = Array.isArray(module.words) ? module.words.length : 0;

      card.innerHTML = `
        <div style="font-weight:600;">🧠 ${module.name}</div>
        <div style="margin-top:6px; font-size:14px; color:#64748B;">
          ${wordsCount} words
        </div>
        <div style="display:flex; gap:10px; margin-top:12px; flex-wrap:wrap;">
          <button class="btn-main add-word-btn">Add Word</button>
          <button class="btn-main study-btn">Study</button>
        </div>
      `;

      const addWordBtn = card.querySelector(".add-word-btn");
      const studyBtn = card.querySelector(".study-btn");

      addWordBtn.addEventListener("click", async (e) => {
        e.stopPropagation();

        try {
          const word = prompt("Word:");
          if (!word || !word.trim()) return;

          const translation = prompt("Translation:");
          if (!translation || !translation.trim()) return;

          const createdWord = await createWordInBackend(
            word.trim(),
            translation.trim()
          );

          if (!Array.isArray(module.words)) {
            module.words = [];
          }

          module.words.push({
            id: createdWord.id,
            word: createdWord.word,
            translation: createdWord.translation
          });

          saveState();
          renderModules();

        } catch (error) {
          alert(error.message);
        }
      });

      studyBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        showStudy();
        renderFlashcards(module);
      });

      modulesContainer.appendChild(card);
    });
  }

  function renderFlashcards(module) {
    if (!studyContent) return;

    if (!module.words || module.words.length === 0) {
      studyContent.innerHTML = `<p>No words yet</p>`;
      return;
    }

    let index = 0;
    let flipped = false;

    function drawCard() {
      const currentWord = module.words[index];

      studyContent.innerHTML = `
        <div class="flashcard" id="flashcard">
          ${flipped ? currentWord.translation : currentWord.word}
        </div>

        <div style="display:flex; gap:12px; margin-top:20px;">
          <button class="btn-main" id="prev-card-btn">Prev</button>
          <button class="btn-main" id="next-card-btn">Next</button>
        </div>
      `;

      const card = document.getElementById("flashcard");
      const prevBtn = document.getElementById("prev-card-btn");
      const nextBtn = document.getElementById("next-card-btn");

      card.addEventListener("click", () => {
        flipped = !flipped;
        drawCard();
      });

      prevBtn.addEventListener("click", () => {
        index = (index - 1 + module.words.length) % module.words.length;
        flipped = false;
        drawCard();
      });

      nextBtn.addEventListener("click", () => {
        index = (index + 1) % module.words.length;
        flipped = false;
        drawCard();
      });
    }

    drawCard();
  }

  renderFolders();
});