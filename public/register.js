async function fetchBoats() {
  try {
    const res = await fetch("/api/boats");
    if (!res.ok) throw new Error("Failed to fetch /api/boats");
    const data = await res.json();
    renderBoats(data.boats || []);
  } catch (err) {
    console.error(err);
  }
}

function renderBoats(boats) {
  const tbody = document.getElementById("boats-body");
  tbody.innerHTML = "";

  boats.forEach((boat) => {
    const tr = document.createElement("tr");
    const registeredAt = boat.registeredAt ? new Date(boat.registeredAt) : null;

    tr.innerHTML = `
      <td>${boat.serial}</td>
      <td>${boat.name ?? "--"}</td>
      <td>${boat.owner || "--"}</td>
      <td>${boat.type || "--"}</td>
      <td>${registeredAt ? registeredAt.toLocaleString() : "--"}</td>
      <td><button class="remove-btn" data-serial="${boat.serial}" data-name="${boat.name ?? boat.serial}">Remove registration</button></td>
    `;

    tbody.appendChild(tr);
  });

  tbody.querySelectorAll(".remove-btn").forEach((btn) => {
    btn.addEventListener("click", () => unregisterBoat(btn.dataset.serial, btn.dataset.name));
  });
}

async function unregisterBoat(serial, name) {
  const confirmed = confirm(
    `Remove registration for "${name}" (serial ${serial})? Its tracking data will be kept, but it will disappear from the dashboard until re-registered.`
  );
  if (!confirmed) return;

  try {
    const res = await fetch(`/api/boats/${encodeURIComponent(serial)}`, { method: "DELETE" });
    const data = await res.json();

    if (!res.ok || !data.success) {
      alert(data.error || "Failed to remove registration.");
      return;
    }

    fetchBoats();
  } catch (err) {
    console.error(err);
    alert("Failed to remove registration.");
  }
}

// Demo-only gate: a hardcoded check, not real auth. Good enough for
// staging the intended "admin manages registrations" flow.
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin123";

function initRegisterPage() {
  fetchBoats();

  const form = document.getElementById("register-form");
  const messageEl = document.getElementById("form-message");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    messageEl.textContent = "";
    messageEl.className = "form-message";

    const serial = document.getElementById("serial").value.trim();
    const name = document.getElementById("name").value.trim();
    const owner = document.getElementById("owner").value.trim();
    const type = document.getElementById("type").value.trim();

    try {
      const res = await fetch("/api/register-boat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serial, name, owner, type }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        messageEl.textContent = data.error || "Registration failed.";
        messageEl.classList.add("form-message-error");
        return;
      }

      messageEl.textContent = `"${name}" registered successfully as serial ${serial}.`;
      messageEl.classList.add("form-message-success");
      form.reset();
      fetchBoats();
    } catch (err) {
      console.error(err);
      messageEl.textContent = "Registration failed.";
      messageEl.classList.add("form-message-error");
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const loginModal = document.getElementById("admin-login-modal");
  const registerMain = document.getElementById("register-main");
  const loginForm = document.getElementById("admin-login-form");
  const loginMessageEl = document.getElementById("admin-login-message");

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const username = document.getElementById("admin-username").value.trim();
    const password = document.getElementById("admin-password").value;

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      loginModal.style.display = "none";
      registerMain.style.display = "flex";
      initRegisterPage();
      return;
    }

    loginMessageEl.textContent = "Incorrect credentials. Returning to dashboard...";
    loginMessageEl.className = "form-message form-message-error";
    setTimeout(() => {
      window.location.href = "/";
    }, 1500);
  });
});
