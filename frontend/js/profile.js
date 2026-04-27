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

    // =========================
    // LOAD USER
    // =========================

    const meRes = await fetch(BASE_URL + "/users/me", {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (!meRes.ok) throw new Error("User fetch failed");

    const user = await meRes.json();

    document.getElementById("profile-email").textContent = user.email;

    const sidebarEmail = document.getElementById("user-email");
    if (sidebarEmail) sidebarEmail.textContent = user.email;
    document.getElementById("profile-level").textContent = ` ${user.level}`;
    document.getElementById("profile-xp").textContent = `${user.xp}`;
      document.getElementById("profile-streak").textContent = ` ${user.streak} 🔥`;

    // =========================
    // LOAD LANGUAGES
    // =========================

    const langRes = await fetch(BASE_URL + "/users/languages", {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (!langRes.ok) throw new Error("Languages fetch failed");

    const languages = await langRes.json();

    initLanguageDropdown(languages, user.active_language_id);

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

  const active =
    languages.find(lang => lang.id === activeLanguageId) ||
    languages[0];

  dropdown.dataset.value = active ? String(active.id) : "";
  selected.textContent = active ? active.name : "Select language";

  items.innerHTML = "";

  languages.forEach(lang => {
    const option = document.createElement("div");
    option.dataset.value = String(lang.id);
    option.textContent = lang.name;

    if (activeLanguageId === lang.id) {
      option.classList.add("selected");
    }

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


// =========================
// CHANGE LANGUAGE
// =========================

async function changeLanguage() {

  const token = localStorage.getItem("token");

  const dropdown = document.getElementById("language-dropdown");
  const languageId = dropdown ? dropdown.dataset.value : "";

  const messageBox =
    document.getElementById("language-message");

  messageBox.textContent = "";
  messageBox.classList.remove("success", "error");

  if (!languageId) {
    messageBox.textContent = "Choose a language";
    messageBox.classList.add("error");
    return;
  }

  try {

    const res = await fetch(
      BASE_URL + "/users/set-language?language_id=" + languageId,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      }
    );

    if (!res.ok) throw new Error();

    const meRes = await fetch(BASE_URL + "/users/me", {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (meRes.ok) {
      const user = await meRes.json();
      document.getElementById("profile-level").textContent = ` ${user.level}`;
      document.getElementById("profile-xp").textContent = `${user.xp}`;
      document.getElementById("profile-streak").textContent = ` ${user.streak} 🔥`;
    }

    const streakEl = document.getElementById("profile-streak");
    if (streakEl) {
      streakEl.textContent = String(streakEl.textContent).replace("\u00F0\u0178\u201D\u00A5", "🔥");
    }

    const streakFix = document.getElementById("profile-streak");
    if (streakFix) {
      streakFix.textContent = String(streakFix.textContent).replace("\u00F0\u0178\u201D\u00A5", "\uD83D\uDD25");
    }

    messageBox.textContent = "Language updated successfully";
    messageBox.classList.add("success");

  }
  catch {

    messageBox.textContent = "Something went wrong";
    messageBox.classList.add("error");

  }

}
