fetch("http://127.0.0.1:8000/docs")
    .then(res => res.json())
    .then(data => {
        document.getElementById("api-status").textContent =
          "API status: " + (data.status || "unknown");
      })
    .catch(() => {
        document.getElementById("api-status").textContent =
          "API status: cannot connect. Is the server running?";
      });