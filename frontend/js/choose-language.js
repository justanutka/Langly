const BASE_URL = "http://127.0.0.1:8000";

document.addEventListener("DOMContentLoaded", async () => {
  const pageBody = document.body;
  const languagesContainer = document.getElementById("languages-container");
  const token = localStorage.getItem("token");

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
    const res = await fetch(BASE_URL + "/users/languages");

    if (!res.ok) {
      throw new Error("Failed to load languages");
    }

    const languages = await res.json();

    if (!languagesContainer) {
      setPageReady();
      return;
    }

    languagesContainer.innerHTML = "";

    if (!Array.isArray(languages) || !languages.length) {
      languagesContainer.innerHTML = '<div class="language-loading">No languages available.</div>';
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
          btn.textContent = "Saving...";

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
      languagesContainer.innerHTML = '<div class="language-loading">Could not load languages.</div>';
    }
  } finally {
    setPageReady();
  }
});
