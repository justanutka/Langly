const BASE_URL = "http://127.0.0.1:8000";

document.addEventListener("DOMContentLoaded", async () => {
  const pageBody = document.body;
  const languagesContainer = document.getElementById("languages-container");
  const token = localStorage.getItem("token");

  function t(key, fallback) {
    const value = window.langlyUiText?.t(key);
    return value && value !== key ? value : fallback;
  }

  function renderStaticText() {
    const title = document.querySelector(".card h1");
    const subtitle = document.querySelector(".card p");
    const loading = document.querySelector(".language-loading");

    if (title) title.textContent = `${t("choose.title", "Choose your study language")} 🌍`;
    if (subtitle) subtitle.textContent = t("choose.subtitle", "You can change it later in your profile settings.");
    if (loading) loading.textContent = t("choose.loading", "Loading languages...");
  }

  function setPageReady() {
    pageBody.classList.remove("page-pending");
  }

  function redirectTo(url) {
    pageBody.classList.add("page-pending");
    window.location.replace(url);
  }

  if (!token) {
    redirectTo("login.html");
    return;
  }

  await window.langlyUiText?.init?.();
  renderStaticText();

  const logo = document.getElementById("logo-link");

  if (logo) {
    logo.addEventListener("click", () => {
      if (localStorage.getItem("token")) {
        redirectTo("dashboard.html");
      } else {
        redirectTo("index.html");
      }
    });
  }

  try {
    const languages = window.langlyApi?.getLanguages
      ? await window.langlyApi.getLanguages()
      : await fetch(BASE_URL + "/users/languages").then((res) => {
          if (!res.ok) throw new Error("Failed to load languages");
          return res.json();
        });

    if (!languagesContainer) {
      setPageReady();
      return;
    }

    languagesContainer.innerHTML = "";

    if (!Array.isArray(languages) || !languages.length) {
      languagesContainer.innerHTML = `<div class="language-loading">${t("choose.empty", "No languages available.")}</div>`;
      return;
    }

    languages.forEach((lang) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = lang.name;
      btn.classList.add("language-btn");

      btn.addEventListener("click", async () => {
        const allButtons = languagesContainer.querySelectorAll(".language-btn");
        const originalText = btn.textContent;

        try {
          allButtons.forEach((button) => {
            button.disabled = true;
          });
          btn.textContent = t("common.saving", "Saving...");

          const setRes = await fetch(
            BASE_URL + "/users/set-language?language_id=" + lang.id,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`
              }
            }
          );

          if (!setRes.ok) {
            throw new Error("Failed to set language");
          }

          redirectTo("dashboard.html");
        } catch (error) {
          console.error("Language selection error:", error);
          btn.textContent = originalText;
          allButtons.forEach((button) => {
            button.disabled = false;
          });
        }
      });

      languagesContainer.appendChild(btn);
    });
  } catch (error) {
    console.error("Error loading languages:", error);
    if (languagesContainer) {
      languagesContainer.innerHTML = `<div class="language-loading">${t("choose.error", "Could not load languages.")}</div>`;
    }
  } finally {
    setPageReady();
  }
});
