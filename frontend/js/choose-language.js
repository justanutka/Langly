const BASE_URL = "http://127.0.0.1:8000";

document.addEventListener("DOMContentLoaded", async () => {

  const token = localStorage.getItem("token");

  // Если нет токена — отправляем на login
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  // =========================
  // SMART LOGO REDIRECT
  // =========================
  const logo = document.getElementById("logo-link");

  if (logo) {
    logo.addEventListener("click", () => {
      const token = localStorage.getItem("token");

      if (token) {
        window.location.href = "dashboard.html";
      } else {
        window.location.href = "index.html";
      }
    });
  }

  // =========================
  // LOAD LANGUAGES
  // =========================
  try {

    const res = await fetch(BASE_URL + "/users/languages");

    if (!res.ok) {
      throw new Error("Failed to load languages");
    }

    const languages = await res.json();
    const container = document.getElementById("languages-container");

    if (!container) return;

    languages.forEach(lang => {

      const btn = document.createElement("button");
      btn.textContent = lang.name;
      btn.classList.add("language-btn");

      btn.addEventListener("click", async () => {

        try {
          const setRes = await fetch(
            BASE_URL + "/users/set-language?language_id=" + lang.id,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${token}`
              }
            }
          );

          if (!setRes.ok) {
            throw new Error("Failed to set language");
          }

          window.location.href = "dashboard.html";

        } catch (error) {
          console.error("Language selection error:", error);
        }

      });

      container.appendChild(btn);
    });

  } catch (error) {
    console.error("Error loading languages:", error);
  }

});