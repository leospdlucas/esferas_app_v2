import { apiFetch, setToken, getToken, clearToken } from "./auth.js";

const INVITE_KEY = "dte_invite_code";

function setMsg(id, text, isError = false) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = text || "";
    el.style.color = isError ? "#ef4444" : "#9ca3af";
  }
}

async function goNext() {
  const me = await apiFetch("/api/me");
  if (me.role === "admin") {
    window.location.href = "/admin-dashboard.html";
  } else {
    window.location.href = "/quiz.html";
  }
}

function preserveInviteInLink() {
  const url = new URL(window.location.href);
  const invite = url.searchParams.get('invite');
  if (invite) {
    const linkCadastro = document.getElementById('link-cadastro');
    if (linkCadastro) {
      linkCadastro.href = `/cadastro.html?invite=${encodeURIComponent(invite)}`;
    }
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const url = new URL(window.location.href);
  const inviteParam = url.searchParams.get('invite');
  
  if (inviteParam) {
    localStorage.setItem(INVITE_KEY, inviteParam);
    const inviteMsg = document.getElementById('invite-detected');
    if (inviteMsg) inviteMsg.style.display = 'block';
  }
  
  preserveInviteInLink();

  // Se já tem token, valida no servidor antes de redirecionar
  if (getToken()) {
    try {
      const me = await apiFetch("/api/me");
      // Token válido, redireciona
      if (me.role === "admin") {
        window.location.href = "/admin-dashboard.html";
      } else {
        window.location.href = "/quiz.html";
      }
      return;
    } catch {
      // Token inválido ou expirado, limpa e continua na página de login
      clearToken();
      console.log("Token inválido, limpando...");
    }
  }

  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      setMsg("login-msg", "");
      
      const submitBtn = loginForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = "Entrando...";
      
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
        setMsg("login-msg", err.message, true);
        submitBtn.disabled = false;
        submitBtn.textContent = "Entrar";
      }
    });
  }
});
