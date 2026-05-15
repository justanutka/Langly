document.addEventListener("DOMContentLoaded", async () => {
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

  try {
    const [meRes, statsRes, langRes] = await Promise.all([
      fetch(BASE_URL + "/users/me", {
        headers: { Authorization: `Bearer ${token}` }
      }),
      fetch(BASE_URL + "/study/stats", {
        headers: { Authorization: `Bearer ${token}` }
      }),
      fetch(BASE_URL + "/users/languages", {
        headers: { Authorization: `Bearer ${token}` }
      })
    ]);

    if (!meRes.ok) throw new Error("User fetch failed");
    if (!langRes.ok) throw new Error("Languages fetch failed");

    const user = await meRes.json();
    const stats = statsRes.ok ? await statsRes.json() : null;
    const languages = await langRes.json();

    // Sidebar email
    const sidebarEmail = document.getElementById("user-email");
    if (sidebarEmail) sidebarEmail.textContent = user.email || "";

    // Email + avatar
    const email = String(user.email || "");
    const emailEl = document.getElementById("profile-email");
    if (emailEl) emailEl.textContent = email;

    const avatarEl = document.getElementById("profile-avatar");
    if (avatarEl) avatarEl.textContent = (email[0] || "L").toUpperCase();

    // Main stats
    const levelEl = document.getElementById("profile-level");
    const xpEl = document.getElementById("profile-xp");
    if (levelEl) levelEl.textContent = String(stats?.level ?? user.level ?? "—");
    if (xpEl) xpEl.textContent = String(stats?.xp ?? user.xp ?? "—");

    const streakEl = document.getElementById("profile-streak");
    if (streakEl) {
      const streak = Number(stats?.streak ?? user.streak ?? 0);
      const label = streak === 1 ? "day" : "days";
      streakEl.textContent = `${streak} ${label}`;
    }

    const learnedEl = document.getElementById("profile-words-learned");
    if (learnedEl) learnedEl.textContent = String(stats?.mastered_words ?? 0);

    const learnedTodayEl = document.getElementById("profile-learned-today");
    if (learnedTodayEl) learnedTodayEl.textContent = String(stats?.due_today ?? 0);

    const savedEl = document.getElementById("profile-saved-words");
    if (savedEl) savedEl.textContent = String(stats?.total_words ?? 0);

    // Progress
    const progressPercentEl = document.getElementById("profile-progress-percent");
    const progressFillEl = document.getElementById("profile-progress-fill");
    if (progressPercentEl && progressFillEl) {
      const xp = Number(stats?.xp ?? user.xp ?? 0);
      const xpToNext = Number(stats?.xp_to_next_level ?? 0);
      const total = xp + xpToNext;
      const percent = total > 0 ? Math.max(0, Math.min(100, Math.round((xp / total) * 100))) : 0;
      progressPercentEl.textContent = `${percent}%`;
      progressFillEl.style.width = `${percent}%`;
    }

    // Languages
    initLanguageDropdown(languages, user.active_language_id);

    const activeLang = languages.find(l => l.id === user.active_language_id);
    const activeLangNameEl = document.getElementById("profile-active-language-name");
    if (activeLangNameEl) activeLangNameEl.textContent = activeLang?.name || "—";

    const saveBtn = document.getElementById("profile-save-language-btn");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => changeLanguage({ languages }));
    }
  } catch (error) {
    console.error("PROFILE ERROR:", error);
  }
});

function initLanguageDropdown(languages, activeLanguageId) {
  const dropdown = document.getElementById("language-dropdown");
  if (!dropdown) return;

  const selected = dropdown.querySelector(".profile-select-selected");
  const items = dropdown.querySelector(".profile-select-items");
  if (!selected || !items) return;

  const active = languages.find(lang => lang.id === activeLanguageId) || languages[0];
  dropdown.dataset.value = active ? String(active.id) : "";
  selected.textContent = active ? active.name : "Select language";

  items.innerHTML = "";

  languages.forEach(lang => {
    const option = document.createElement("div");
    option.dataset.value = String(lang.id);
    option.textContent = lang.name;

    if (activeLanguageId === lang.id) option.classList.add("selected");

    option.addEventListener("click", (event) => {
      event.stopPropagation();
      dropdown.dataset.value = String(lang.id);
      selected.textContent = lang.name;
      items.querySelectorAll("div").forEach(el => el.classList.remove("selected"));
      option.classList.add("selected");
      items.classList.add("profile-select-hide");
      selected.classList.remove("active");
    });

    items.appendChild(option);
  });

  selected.addEventListener("click", (event) => {
    event.stopPropagation();
    items.classList.toggle("profile-select-hide");
    selected.classList.toggle("active");
  });

  document.addEventListener("click", () => {
    items.classList.add("profile-select-hide");
    selected.classList.remove("active");
  });
}

async function changeLanguage({ languages } = {}) {
  const token = localStorage.getItem("token");

  const dropdown = document.getElementById("language-dropdown");
  const languageId = dropdown ? dropdown.dataset.value : "";

  const messageBox = document.getElementById("language-message");
  if (!messageBox) return;

  messageBox.textContent = "";
  messageBox.classList.remove("success", "error");

  if (!languageId) {
    messageBox.textContent = "Choose a language";
    messageBox.classList.add("error");
    return;
  }

  try {
    const res = await fetch(
      BASE_URL + "/users/set-language?language_id=" + encodeURIComponent(languageId),
      { method: "POST", headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) throw new Error("Set language failed");

    const [meRes, statsRes] = await Promise.all([
      fetch(BASE_URL + "/users/me", { headers: { Authorization: `Bearer ${token}` } }),
      fetch(BASE_URL + "/study/stats", { headers: { Authorization: `Bearer ${token}` } })
    ]);

    const me = meRes.ok ? await meRes.json() : null;
    const stats = statsRes.ok ? await statsRes.json() : null;

    if (me) {
      const sidebarEmail = document.getElementById("user-email");
      if (sidebarEmail) sidebarEmail.textContent = me.email || "";
    }

    const levelEl = document.getElementById("profile-level");
    const xpEl = document.getElementById("profile-xp");
    if (levelEl) levelEl.textContent = String(stats?.level ?? me?.level ?? "—");
    if (xpEl) xpEl.textContent = String(stats?.xp ?? me?.xp ?? "—");

    const streakEl = document.getElementById("profile-streak");
    if (streakEl) {
      const streak = Number(stats?.streak ?? me?.streak ?? 0);
      const label = streak === 1 ? "day" : "days";
      streakEl.textContent = `${streak} ${label}`;
    }

    const learnedEl = document.getElementById("profile-words-learned");
    if (learnedEl) learnedEl.textContent = String(stats?.mastered_words ?? 0);

    const learnedTodayEl = document.getElementById("profile-learned-today");
    if (learnedTodayEl) learnedTodayEl.textContent = String(stats?.due_today ?? 0);

    const savedEl = document.getElementById("profile-saved-words");
    if (savedEl) savedEl.textContent = String(stats?.total_words ?? 0);

    const progressPercentEl = document.getElementById("profile-progress-percent");
    const progressFillEl = document.getElementById("profile-progress-fill");
    if (progressPercentEl && progressFillEl) {
      const xp = Number(stats?.xp ?? me?.xp ?? 0);
      const xpToNext = Number(stats?.xp_to_next_level ?? 0);
      const total = xp + xpToNext;
      const percent = total > 0 ? Math.max(0, Math.min(100, Math.round((xp / total) * 100))) : 0;
      progressPercentEl.textContent = `${percent}%`;
      progressFillEl.style.width = `${percent}%`;
    }

    const activeLangNameEl = document.getElementById("profile-active-language-name");
    if (activeLangNameEl) {
      const chosen = languages?.find?.(l => String(l.id) === String(languageId));
      activeLangNameEl.textContent = chosen?.name || "—";
    }

    messageBox.textContent = "Language updated successfully";
    messageBox.classList.add("success");
  } catch (error) {
    console.error(error);
    messageBox.textContent = "Something went wrong";
    messageBox.classList.add("error");
  }
}
