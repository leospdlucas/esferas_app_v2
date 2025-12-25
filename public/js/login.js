import { apiFetch, setToken, getToken } from "./auth.js";

const INVITE_KEY = "dte_invite_code";


function setMsg(id, text) {
  const el = document.getElementById(id);
  el.textContent = text || "";
}

async function goNext() {
  let me;
  try {
    me = await apiFetch("/api/me");
  } catch (e) {
    setMsg("login-msg", "Falha ao validar sessão. Tente novamente.");
    return;
  }
  if (me.role === "admin") {
    window.location.href = "/admin-dashboard.html";
  } else {
    window.location.href = "/quiz.html";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const url = new URL(window.location.href);
  if (url.searchParams.get('invite')) {
    setMsg('reg-msg', 'Convite detectado: crie sua conta (ou faça login) para continuar.');
  }

  if (getToken()) {
    try {
      await apiFetch("/api/me");
      return goNext();
    } catch {
      // ignore
    }
  }

  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg("login-msg", "");
    try {
      const email = document.getElementById("login-email").value.trim();
      const password = document.getElementById("login-password").value;
      const data = await apiFetch("/api/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      setToken(data.token);
      if (data.role === "admin") {
        window.location.href = "/admin-dashboard.html";
      } else {
        window.location.href = "/quiz.html";
      }
    } catch (err) {
      setMsg("login-msg", err.message);
    }
  });

  document.getElementById("register-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg("reg-msg", "");
    try {
      const name = document.getElementById("reg-name").value.trim();
      const email = document.getElementById("reg-email").value.trim();
      const password = document.getElementById("reg-password").value;
      const inviteCode = localStorage.getItem(INVITE_KEY);
      await apiFetch("/api/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password, inviteCode })
      });
      setMsg("reg-msg", "Conta criada. Agora faça login acima.");
    } catch (err) {
      setMsg("reg-msg", err.message);
    }
  });
});
