

document.addEventListener("DOMContentLoaded", async () => {

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
    document.getElementById("user-email").textContent = user.email;


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

    const select = document.getElementById("language-select");

    select.innerHTML = "";

    languages.forEach(lang => {

      const option = document.createElement("option");

      option.value = lang.id;
      option.textContent = lang.name;

      if (user.active_language_id === lang.id) {
        option.selected = true;
      }

      select.appendChild(option);

    });

  } catch (error) {

    console.error("PROFILE ERROR:", error);

  }

});


// =========================
// CHANGE LANGUAGE
// =========================

async function changeLanguage() {

  const token = localStorage.getItem("token");

  const languageId =
    document.getElementById("language-select").value;

  const messageBox =
    document.getElementById("language-message");

  messageBox.textContent = "";

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

    messageBox.textContent = "Language updated successfully";
    messageBox.style.color = "green";

  }
  catch {

    messageBox.textContent = "Something went wrong";
    messageBox.style.color = "red";

  }

}