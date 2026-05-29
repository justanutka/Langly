const SETTINGS_BASE_URL = "http://127.0.0.1:8000";

document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  const dropdown = document.getElementById("interface-language-dropdown");
  const saveBtn = document.getElementById("save-interface-language-btn");
  const messageBox = document.getElementById("settings-message");
  const logo = document.getElementById("logo");
  const logoutBtn = document.getElementById("logout-btn");

  if (logo) {
    logo.addEventListener("click", () => {
      document.body?.classList.add("page-transitioning");
      window.location.href = "dashboard.html";
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("token");
      document.body?.classList.add("page-transitioning");
      window.location.href = "index.html";
    });
  }

  if (!token) {
    window.location.href = "login.html";
    return;
  }

  if (!dropdown || !saveBtn || !messageBox) {
    return;
  }

  let languages = [];

  function t(key, params, fallback) {
    const value = window.langlyUiText?.t(key, params);
    return value && value !== key ? value : fallback || key;
  }

  function setMessage(text, type = "") {
    messageBox.textContent = text || "";
    messageBox.classList.remove("success", "error");
    if (type) messageBox.classList.add(type);
  }

  function closeDropdown() {
    const selected = dropdown.querySelector(".settings-select-selected");
    const items = dropdown.querySelector(".settings-select-items");
    items?.classList.add("settings-select-hide");
    selected?.classList.remove("active");
  }

  function initDropdown(activeLanguageId) {
    const selected = dropdown.querySelector(".settings-select-selected");
    const items = dropdown.querySelector(".settings-select-items");
    if (!selected || !items) return;

    const active = languages.find(lang => String(lang.id) === String(activeLanguageId)) || languages[0];
    dropdown.dataset.value = active ? String(active.id) : "";
    selected.textContent = active ? active.name : t("settings.select_language");

    items.innerHTML = "";

    languages.forEach((lang) => {
      const option = document.createElement("div");
      option.dataset.value = String(lang.id);
      option.textContent = lang.name;

      if (String(active?.id) === String(lang.id)) {
        option.classList.add("selected");
      }

      option.addEventListener("click", (event) => {
        event.stopPropagation();
        dropdown.dataset.value = String(lang.id);
        selected.textContent = lang.name;
        items.querySelectorAll("div").forEach(el => el.classList.remove("selected"));
        option.classList.add("selected");
        closeDropdown();
        setMessage("", "");
      });

      items.appendChild(option);
    });

    if (!dropdown.dataset.bound) {
      selected.addEventListener("click", (event) => {
        event.stopPropagation();
        items.classList.toggle("settings-select-hide");
        selected.classList.toggle("active");
      });

      document.addEventListener("click", closeDropdown);
      dropdown.dataset.bound = "1";
    }
  }

  async function getUser() {
    await window.langlyUiText?.init?.();

    if (window.langlyCurrentUser) {
      return window.langlyCurrentUser;
    }

    const user = window.langlyApi?.getCurrentUser
      ? await window.langlyApi.getCurrentUser()
      : await fetch(SETTINGS_BASE_URL + "/users/me", {
          headers: { Authorization: `Bearer ${token}` }
        }).then((res) => {
          if (!res.ok) throw new Error("Unauthorized");
          return res.json();
        });
    window.langlyCurrentUser = user;
    window.langlyUiText?.setLocaleFromUser(user);
    window.langlyUiText?.apply(document);
    return user;
  }

  try {
    const user = await getUser();

    if (!user.active_language_id) {
      window.location.href = "choose-language.html";
      return;
    }

    const languagesPromise = window.langlyApi?.getLanguages
      ? window.langlyApi.getLanguages()
      : fetch(SETTINGS_BASE_URL + "/users/languages", {
          headers: { Authorization: `Bearer ${token}` }
        }).then((res) => {
          if (!res.ok) throw new Error("Settings load failed");
          return res.json();
        });

    await loadSidebar({ user });

    languages = await languagesPromise;
    window.langlyUiText?.setLocaleFromUser(user);
    window.langlyUiText?.apply(document);
    initDropdown(user.interface_language_id || user.native_language_id);
  } catch (error) {
    console.error("Settings load error:", error);
    setMessage(t("common.error"), "error");
  }

  saveBtn.addEventListener("click", async () => {
    const languageId = dropdown.dataset.value;
    if (!languageId) {
      setMessage(t("settings.choose_language"), "error");
      return;
    }

    const chosen = languages.find(lang => String(lang.id) === String(languageId));

    try {
      saveBtn.disabled = true;
      saveBtn.textContent = t("common.saving");

      const res = await fetch(
        SETTINGS_BASE_URL + "/users/set-interface-language?language_id=" + encodeURIComponent(languageId),
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (!res.ok) {
        throw new Error("Interface language update failed");
      }

      if (chosen?.code) {
        window.langlyUiText?.setLocale(chosen.code);
        window.langlyUiText?.apply(document);
      }

      initDropdown(languageId);
      setMessage(t("settings.saved"), "success");
    } catch (error) {
      console.error("Interface language save error:", error);
      setMessage(t("common.error"), "error");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = t("settings.save_language");
    }
  });
});
