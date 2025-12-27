import { apiFetch, getToken } from "./auth.js";

const INVITE_KEY = "dte_invite_code";

function setMsg(id, text, isError = false) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = text || "";
    el.className = isError ? "scale-legend msg-error" : "scale-legend msg-success";
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
      const me = await apiFetch("/api/me");
      if (me.role === "admin") {
        window.location.href = "/admin-dashboard.html";
      } else {
        window.location.href = "/quiz.html";
      }
      return;
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
      submitBtn.innerHTML = '<span class="spinner"></span>Criando...';
      
      try {
        const name = document.getElementById("reg-name").value.trim();
        const email = document.getElementById("reg-email").value.trim();
        const password = document.getElementById("reg-password").value;
        const inviteCode = localStorage.getItem(INVITE_KEY);
        
        await apiFetch("/api/register", {
          method: "POST",
          body: JSON.stringify({ name, email, password, inviteCode })
        });
        
        // Limpa o código de convite após uso
        localStorage.removeItem(INVITE_KEY);
        
        // Mostra mensagem de sucesso e redireciona para login
        setMsg("reg-msg", "✓ Conta criada com sucesso! Redirecionando para login...", false);
        
        setTimeout(() => {
          window.location.href = "/";
        }, 2000);
        
      } catch (err) {
        setMsg("reg-msg", err.message, true);
        submitBtn.disabled = false;
        submitBtn.textContent = "Criar conta";
      }
    });
  }
});
