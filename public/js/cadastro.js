import { apiFetch, setToken, getToken } from "./auth.js";

const INVITE_KEY = "dte_invite_code";

function setMsg(id, text, isError = false) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = text || "";
    el.style.color = isError ? "#ef4444" : "#22c55e";
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
    const linkLogin = document.getElementById('link-login');
    if (linkLogin) {
      linkLogin.href = `/?invite=${encodeURIComponent(invite)}`;
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

  // Se já tem token válido, redireciona
  if (getToken()) {
    try {
      await apiFetch("/api/me");
      return goNext();
    } catch {
      // Token inválido, continua na página
    }
  }

  const registerForm = document.getElementById("register-form");
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      setMsg("reg-msg", "");
      
      const submitBtn = registerForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = "Criando conta...";
      
      try {
        const name = document.getElementById("reg-name").value.trim();
        const email = document.getElementById("reg-email").value.trim();
        const password = document.getElementById("reg-password").value;
        const inviteCode = localStorage.getItem(INVITE_KEY);
        
        await apiFetch("/api/register", {
          method: "POST",
          body: JSON.stringify({ name, email, password, inviteCode })
        });
        
        setMsg("reg-msg", "✓ Conta criada com sucesso! Fazendo login...");
        
        // Auto-login após cadastro
        const loginData = await apiFetch("/api/login", {
          method: "POST",
          body: JSON.stringify({ email, password })
        });
        
        setToken(loginData.token);
        
        // Limpa o código de convite após uso
        localStorage.removeItem(INVITE_KEY);
        
        if (loginData.role === "admin") {
          window.location.href = "/admin-dashboard.html";
        } else {
          window.location.href = "/quiz.html";
        }
        
      } catch (err) {
        setMsg("reg-msg", err.message, true);
        submitBtn.disabled = false;
        submitBtn.textContent = "Criar conta";
      }
    });
  }
});
