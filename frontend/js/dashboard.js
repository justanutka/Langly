document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("discovery-container");
  if (!container) {
    return;
  }

  await window.langlyUiText?.init?.();

  const logo = document.getElementById("logo");
  if (logo) {
    logo.addEventListener("click", () => {
      window.location.replace("dashboard.html");
    });
  }

  initDiscovery(container)
    .catch((e) => console.error("Discovery init error:", e));
});

function todayIso() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function setToast(container, text, type) {
  const toast = container.querySelector("#discovery-toast");
  if (!toast) return;

  toast.textContent = text || "";
  toast.classList.remove("success", "error", "show");
  if (type) toast.classList.add(type);

  if (text) {
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2400);
  }
}

function appendSpeechButton({ host, text, languageCode, label, className = "" }) {
  if (!host || !window.langlySpeech?.createButton) return;

  const button = window.langlySpeech.createButton({
    text,
    languageCode,
    label,
    className
  });

  host.appendChild(button);
}

function tr(key, params, fallback) {
  const value = window.langlyUiText?.t(key, params);
  return value && value !== key ? value : fallback || key;
}

function renderMiniStats({ container, stats }) {
  const host = container.querySelector("#dash-mini-grid");
  if (!host) return;

  const mastered = Number(stats?.mastered_words ?? 0);
  const learnedToday = Number(stats?.due_today ?? 0);
  const progress = Number(stats?.progress_percent ?? 0);
  const total = Number(stats?.total_words ?? 0);

  host.innerHTML = `
    <div class="dash-mini-card">
      <div class="dash-mini-label">${tr("dashboard.words_learned")}</div>
      <div class="dash-mini-value">${mastered}</div>
      <div class="dash-mini-sub">${tr("dashboard.marked_mastered")}</div>
    </div>
    <div class="dash-mini-card">
      <div class="dash-mini-label">${tr("dashboard.learned_today")}</div>
      <div class="dash-mini-value">${learnedToday}</div>
      <div class="dash-mini-sub">${tr("dashboard.marked_today")}</div>
    </div>
    <div class="dash-mini-card">
      <div class="dash-mini-label">${tr("dashboard.progress")}</div>
      <div class="dash-mini-value">${progress}%</div>
      <div class="dash-mini-sub">${tr("dashboard.active_language")}</div>
    </div>
    <div class="dash-mini-card">
      <div class="dash-mini-label">${tr("dashboard.total_words")}</div>
      <div class="dash-mini-value">${total}</div>
      <div class="dash-mini-sub">${tr("dashboard.across_folders")}</div>
    </div>
  `;
}

function renderQueueCard({ container, stats }) {
  const el = container.querySelector("#dash-queue-count");
  if (!el) return;

  const total = Number(stats?.total_words ?? 0);
  const mastered = Number(stats?.mastered_words ?? 0);
  const queue = Math.max(0, total - mastered);
  el.textContent = String(queue);
}

function initSessionSizeSelect({ container, state }) {
  const dropdown = container.querySelector("#dash-session-size");
  if (!dropdown) return;

  const saved = Number(localStorage.getItem("langlySessionSize") || "5");
  const initial = [5, 10, 20].includes(saved) ? saved : 5;
  state.sessionCount = initial;

  const options = [
    { value: "5", label: tr("dashboard.session_light", null, "5 words - light") },
    { value: "10", label: tr("dashboard.session_medium", null, "10 words - medium") },
    { value: "20", label: tr("dashboard.session_intensive", null, "20 words - intensive") }
  ];

  setDashSelectOptions({
    dropdown,
    options,
    value: String(initial),
    placeholder: tr("dashboard.session_size"),
    onChange: async (v) => {
      const n = Number(v || 5);
      state.sessionCount = [5, 10, 20].includes(n) ? n : 5;
      localStorage.setItem("langlySessionSize", String(state.sessionCount));
      await hydrateWords({ container, state });
    }
  });
}

async function initDiscovery(container) {
  const token = localStorage.getItem("token");
  if (!token) return;

  container.innerHTML = `
    <div class="dash-section">
      <div class="dash-top">
        <div class="dash-queue-card">
          <div class="dash-kicker">${tr("dashboard.study_queue")}</div>
          <div class="dash-queue-value"><span id="dash-queue-count">—</span> <span class="dash-queue-unit">${tr("dashboard.words")}</span></div>
          <div class="dash-queue-sub">${tr("dashboard.queue_sub")}</div>

          <div class="dash-queue-row">
            <div class="dash-queue-label">${tr("dashboard.session_size")}</div>
            <div class="dash-custom-select dash-custom-select--compact" id="dash-session-size" data-value="">
              <div class="dash-select-selected">${tr("dashboard.session_light", null, "5 words - light")}</div>
              <div class="dash-select-items dash-select-hide"></div>
            </div>
          </div>
        </div>

        <div class="dash-mini-grid" id="dash-mini-grid"></div>
      </div>

      <div class="dash-actions-grid">
        <div class="dash-action-card">
          <div class="dash-action-badge">1</div>
          <div class="dash-action-title">${tr("dashboard.build_deck")}</div>
          <div class="dash-action-desc">${tr("dashboard.build_deck_desc")}</div>
          <a class="dash-action-link" href="my-words.html">${tr("dashboard.open_library")}</a>
        </div>
        <div class="dash-action-card">
          <div class="dash-action-badge">2</div>
          <div class="dash-action-title">${tr("dashboard.practice_next")}</div>
          <div class="dash-action-desc">${tr("dashboard.practice_next_desc")}</div>
          <button class="dash-action-link dash-action-btn" id="dash-open-cards" type="button">${tr("dashboard.choose_module")}</button>
        </div>
        <div class="dash-action-card">
          <div class="dash-action-badge">3</div>
          <div class="dash-action-title">${tr("dashboard.test_recall")}</div>
          <div class="dash-action-desc">${tr("dashboard.test_recall_desc")}</div>
          <button class="dash-action-link dash-action-btn" id="dash-open-quiz" type="button">${tr("dashboard.start_quiz")}</button>
        </div>
      </div>

      <div class="discovery-card">
        <div class="discovery-header">
          <div>
            <h3 class="discovery-title">${tr("dashboard.today")}</h3>
          </div>
          <div class="discovery-actions">
            <button class="btn-soft btn-soft--ghost" id="discovery-shuffle" type="button">${tr("dashboard.shuffle")}</button>
            <a class="btn-soft btn-soft--primary" href="my-words.html">${tr("dashboard.open_library")}</a>
          </div>
        </div>

        <div class="discovery-destination">
          <div class="destination-label">${tr("dashboard.save_destination")}</div>

          <div class="dash-custom-select" id="discovery-folder" data-value="">
            <div class="dash-select-selected">${tr("dashboard.select_folder")}</div>
            <div class="dash-select-items dash-select-hide"></div>
          </div>

          <div class="dash-custom-select" id="discovery-module" data-value="">
            <div class="dash-select-selected">${tr("dashboard.select_module")}</div>
            <div class="dash-select-items dash-select-hide"></div>
          </div>

          <button class="btn-soft primary" id="discovery-save-all" type="button">${tr("dashboard.save_all")}</button>
        </div>
        <div class="discovery-hint" id="discovery-destination-hint"></div>

        <div class="discovery-list" id="discovery-list"></div>
        <div class="discovery-toast" id="discovery-toast"></div>
      </div>
    </div>
  `;

  const listEl = container.querySelector("#discovery-list");
  const shuffleBtn = container.querySelector("#discovery-shuffle");
  const saveAllBtn = container.querySelector("#discovery-save-all");

  const folderDropdown = container.querySelector("#discovery-folder");
  const moduleDropdown = container.querySelector("#discovery-module");
  const sessionSizeDropdown = container.querySelector("#dash-session-size");
  const openCardsBtn = container.querySelector("#dash-open-cards");
  const openQuizBtn = container.querySelector("#dash-open-quiz");

  const user = window.langlyApi?.getCurrentUser
    ? await window.langlyApi.getCurrentUser()
    : await fetchJson(BASE_URL + "/users/me", token);
  const stats = window.langlyApi?.getStudyStats
    ? await window.langlyApi.getStudyStats().catch(() => null)
    : await fetchJson(BASE_URL + "/study/stats", token).catch(() => null);

  if (!user?.active_language_id) {
    listEl.innerHTML = `<div class="empty-state">${tr("dashboard.select_active_language", null, "Select an active language first.")}</div>`;
    return;
  }

  const state = {
    user,
    stats,
    folders: [],
    modules: [],
    dailyWords: [],
    folderId: "",
    moduleId: "",
    sessionCount: 5
  };

  state.folders = window.langlyApi?.getFolders
    ? await window.langlyApi.getFolders().catch(() => [])
    : await fetchJson(BASE_URL + "/folders", token).catch(() => []);
  initDashSelect(folderDropdown);
  initDashSelect(moduleDropdown);
  initDashSelect(sessionSizeDropdown);

  renderMiniStats({ container, stats: state.stats, user: state.user });
  renderQueueCard({ container, stats: state.stats });

  initSessionSizeSelect({ container, state });

  if (openCardsBtn) {
    openCardsBtn.addEventListener("click", () => {
      const btn = document.getElementById("sidebar-cards-btn");
      if (btn) btn.click();
      else window.location.href = "my-words.html";
    });
  }

  if (openQuizBtn) {
    openQuizBtn.addEventListener("click", () => {
      const btn = document.getElementById("sidebar-quiz-btn");
      if (btn) btn.click();
      else window.location.href = "my-words.html";
    });
  }

  await hydrateFolderSelect({ container, state });
  await hydrateWords({ container, state });

  if (shuffleBtn) {
    shuffleBtn.addEventListener("click", async () => {
      bumpDailyVariant();
      await hydrateWords({ container, state });
    });
  }

  if (saveAllBtn) {
    saveAllBtn.addEventListener("click", async () => {
      if (!state.moduleId) {
        setToast(container, tr("dashboard.select_module_to_save"), "error");
        return;
      }

      let saved = 0;
      for (const item of state.dailyWords) {
        const ok = await saveDiscoveryWord({ token, state, item, silent: true });
        if (ok) saved += 1;
      }

      setToast(container, saved > 0 ? tr("dashboard.saved_words", { count: saved }) : tr("dashboard.nothing_saved"), saved > 0 ? "success" : "error");
      renderWordsList({ container, state });
    });
  }
}

function bumpDailyVariant() {
  const key = `langlyDiscoveryVariant:${todayIso()}`;
  const current = Number(localStorage.getItem(key) || "0");
  localStorage.setItem(key, String(current + 1));
}

function getDailyVariant() {
  const key = `langlyDiscoveryVariant:${todayIso()}`;
  return Number(localStorage.getItem(key) || "0");
}

async function hydrateFolderSelect({ container, state }) {
  const folderDropdown = container.querySelector("#discovery-folder");
  const moduleDropdown = container.querySelector("#discovery-module");
  const hintEl = container.querySelector("#discovery-destination-hint");
  if (!folderDropdown || !moduleDropdown) return;

  const savedFolderId = localStorage.getItem("langlyDiscoveryFolderId") || "";

  const initialFolder = state.folders.find(f => String(f.id) === String(savedFolderId)) || state.folders[0];
  state.folderId = initialFolder ? String(initialFolder.id) : "";
  localStorage.setItem("langlyDiscoveryFolderId", state.folderId);

  if (hintEl) {
    hintEl.textContent = "";
    if (!state.folders.length) {
      hintEl.innerHTML = `${tr("study.no_folders")} <a href="my-words.html">${tr("dashboard.open_library")}</a>.`;
    }
  }

  setDashSelectOptions({
    dropdown: folderDropdown,
    options: state.folders.map(f => ({ value: String(f.id), label: f.name })),
    value: state.folderId,
    placeholder: state.folders.length ? tr("dashboard.select_folder") : tr("study.no_folders"),
    onChange: async (folderId) => {
      state.folderId = String(folderId || "");
      localStorage.setItem("langlyDiscoveryFolderId", state.folderId);
      await hydrateModuleSelect({ container, state });
    }
  });

  await hydrateModuleSelect({ container, state });
}

async function hydrateModuleSelect({ container, state }) {
  const token = localStorage.getItem("token");
  const moduleDropdown = container.querySelector("#discovery-module");
  const hintEl = container.querySelector("#discovery-destination-hint");
  const saveAllBtn = container.querySelector("#discovery-save-all");
  if (!moduleDropdown) return;

  if (!state.folderId) {
    state.modules = [];
    state.moduleId = "";
  } else {
    state.modules = await fetchJson(`${BASE_URL}/modules/${encodeURIComponent(state.folderId)}`, token).catch(() => []);
    const savedModuleId = localStorage.getItem("langlyDiscoveryModuleId") || "";
    const initialModule = state.modules.find(m => String(m.id) === String(savedModuleId)) || state.modules[0];
    state.moduleId = initialModule ? String(initialModule.id) : "";
    localStorage.setItem("langlyDiscoveryModuleId", state.moduleId);
  }

  if (hintEl) {
    if (state.folderId && !state.modules.length) {
      hintEl.innerHTML = `${tr("dashboard.no_modules_in_folder", null, "No modules in this folder.")} <a href="my-words.html">${tr("dashboard.open_library")}</a>.`;
    } else if (state.folders.length) {
      hintEl.textContent = "";
    }
  }

  if (saveAllBtn) {
    saveAllBtn.disabled = !state.moduleId;
    saveAllBtn.style.opacity = state.moduleId ? "1" : "0.55";
    saveAllBtn.style.cursor = state.moduleId ? "pointer" : "not-allowed";
  }

  setDashSelectOptions({
    dropdown: moduleDropdown,
    options: state.modules.map(m => ({ value: String(m.id), label: m.name })),
    value: state.moduleId,
    placeholder: state.folderId
      ? (state.modules.length ? tr("dashboard.select_module") : tr("study.no_modules"))
      : tr("dashboard.select_folder_first", null, "Select folder first"),
    onChange: (moduleId) => {
      state.moduleId = String(moduleId || "");
      localStorage.setItem("langlyDiscoveryModuleId", state.moduleId);
      if (saveAllBtn) {
        saveAllBtn.disabled = !state.moduleId;
        saveAllBtn.style.opacity = state.moduleId ? "1" : "0.55";
        saveAllBtn.style.cursor = state.moduleId ? "pointer" : "not-allowed";
      }
    }
  });
}

async function hydrateWords({ container, state }) {
  const token = localStorage.getItem("token");
  const listEl = container.querySelector("#discovery-list");
  if (!listEl) return;

  listEl.innerHTML = `<div class="empty-state">${tr("dashboard.loading_words")}</div>`;

  const variant = getDailyVariant();
  const count = Number(state?.sessionCount || 5);

  let words = [];
  try {
    words = await fetchJson(
      `${BASE_URL}/study/daily-words?variant=${encodeURIComponent(String(variant))}&count=${encodeURIComponent(String(count))}`,
      token
    );
  } catch (e) {
    try {
      words = await fetchJson(BASE_URL + "/study/daily-words-online", token);
    } catch {
      words = [];
    }
  }

  state.dailyWords = Array.isArray(words) ? words : [];
  renderWordsList({ container, state });
}

function renderWordsList({ container, state }) {
  const listEl = container.querySelector("#discovery-list");
  if (!listEl) return;

  if (!state.dailyWords.length) {
    listEl.innerHTML = `<div class="empty-state">${tr("dashboard.no_words")}</div>`;
    return;
  }

  listEl.innerHTML = "";

  state.dailyWords.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "discovery-item";

    const base = item?.base_word ? String(item.base_word) : "";
    const w = String(item?.word || "");
    const t = String(item?.translation || "");
    const showBase =
      base &&
      base.trim().toLowerCase() !== w.trim().toLowerCase();

    row.innerHTML = `
      <div class="discovery-left">
        <div class="discovery-text-stack">
          <div class="discovery-line discovery-line--study">
            <span class="discovery-word">${escapeHtml(w)}</span>
          </div>
          <div class="discovery-line discovery-line--translation">
            <span class="discovery-translation">${escapeHtml(t)}</span>
          </div>
        </div>
        ${showBase ? `<div class="discovery-meta">${tr("dashboard.base", null, "Base")}: ${escapeHtml(base)}</div>` : ""}
      </div>
      <div class="discovery-item-actions">
        <button class="mini-pill" data-action="copy" type="button">${tr("dashboard.copy")}</button>
        <button class="mini-pill primary" data-action="save" type="button">${tr("dashboard.save")}</button>
      </div>
    `;

    const studyLine = row.querySelector(".discovery-line--study");
    const translationLine = row.querySelector(".discovery-line--translation");

    appendSpeechButton({
      host: studyLine,
      text: w,
      languageCode: state?.user?.active_language_code,
      label: `Play pronunciation for ${w}`,
      className: "speak-btn--study"
    });

    appendSpeechButton({
      host: translationLine,
      text: t,
      languageCode: state?.user?.native_language_code,
      label: `Play pronunciation for ${t}`,
      className: "speak-btn--translation"
    });

    const copyBtn = row.querySelector('[data-action="copy"]');
    if (copyBtn) {
      copyBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(`${w} ${"\u2014"} ${t}`);
          setToast(container, tr("dashboard.copied"), "success");
        } catch {
          setToast(container, tr("dashboard.copy_failed"), "error");
        }
      });
    }

    const saveBtn = row.querySelector('[data-action="save"]');
    if (saveBtn) {
      saveBtn.addEventListener("click", async () => {
        if (!state.moduleId) {
          setToast(container, tr("dashboard.select_module_to_save"), "error");
          return;
        }

        const token = localStorage.getItem("token");
        const ok = await saveDiscoveryWord({ token, state, item });
        if (ok) {
          setToast(container, tr("dashboard.saved"), "success");
          saveBtn.textContent = tr("dashboard.saved");
          saveBtn.disabled = true;
        }
      });
    }

    listEl.appendChild(row);
  });
}

async function saveDiscoveryWord({ token, state, item, silent = false }) {
  const languageId = state?.user?.active_language_id;
  const moduleId = state?.moduleId;

  const word = String(item?.word || "").trim();
  const translation = String(item?.translation || "").trim();

  if (!languageId || !moduleId || !word || !translation) return false;

  try {
    const res = await fetch(`${BASE_URL}/words/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        language_id: languageId,
        module_id: Number(moduleId),
        word,
        translation,
        example: null
      })
    });

    if (!res.ok) {
      if (!silent) {
        const data = await res.json().catch(() => null);
        const msg = data?.detail || tr("dashboard.could_not_save", null, "Could not save word.");
        setToast(document.getElementById("discovery-container"), msg, "error");
      }
      return false;
    }

    return true;
  } catch (e) {
    if (!silent) setToast(document.getElementById("discovery-container"), tr("dashboard.save_server_error", null, "Server error while saving."), "error");
    return false;
  }
}

async function fetchJson(url, token) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function initDashSelect(dropdown) {
  if (!dropdown) return;

  const selected = dropdown.querySelector(".dash-select-selected");
  const items = dropdown.querySelector(".dash-select-items");
  if (!selected || !items) return;

  selected.addEventListener("click", (event) => {
    event.stopPropagation();
    items.classList.toggle("dash-select-hide");
    selected.classList.toggle("active");
  });

  document.addEventListener("click", () => {
    items.classList.add("dash-select-hide");
    selected.classList.remove("active");
  });
}

function setDashSelectOptions({ dropdown, options, value, placeholder, onChange }) {
  const selected = dropdown.querySelector(".dash-select-selected");
  const items = dropdown.querySelector(".dash-select-items");
  if (!selected || !items) return;

  const normalized = Array.isArray(options) ? options : [];
  const current = normalized.find(o => String(o.value) === String(value));

  dropdown.dataset.value = current ? String(current.value) : "";
  selected.textContent = current ? current.label : (placeholder || tr("dashboard.select", null, "Select"));

  items.innerHTML = "";

  if (!normalized.length) {
    const empty = document.createElement("div");
    empty.textContent = tr("dashboard.no_items", null, "No items");
    items.appendChild(empty);
    return;
  }

  normalized.forEach(opt => {
    const el = document.createElement("div");
    el.dataset.value = String(opt.value);
    el.textContent = opt.label;
    if (String(opt.value) === String(value)) el.classList.add("selected");

    el.addEventListener("click", (event) => {
      event.stopPropagation();
      dropdown.dataset.value = String(opt.value);
      selected.textContent = opt.label;
      items.querySelectorAll("div").forEach(d => d.classList.remove("selected"));
      el.classList.add("selected");
      items.classList.add("dash-select-hide");
      selected.classList.remove("active");
      if (typeof onChange === "function") onChange(String(opt.value));
    });

    items.appendChild(el);
  });
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
