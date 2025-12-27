import { apiFetch, getToken } from "./auth.js";

const INVITE_KEY = "dte_invite_code";
const GUEST_KEY = "dte_guest_nickname";

function qs(name) {
  const u = new URL(window.location.href);
  return u.searchParams.get(name);
}

function setMsg(id, text, isError = false) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = text || "";
    el.style.color = isError ? "#ef4444" : "#9ca3af";
  }
}

function showOptions() {
  document.getElementById("guest-card").style.display = "block";
  document.getElementById("divider-1").style.display = "flex";
  document.getElementById("actions-card").style.display = "block";
}

document.addEventListener("DOMContentLoaded", async () => {
  const code = (qs("code") || "").trim();
  const msg = document.getElementById("msg");
  const btnCadastro = document.getElementById("btn-cadastro");
  const btnLogin = document.getElementById("btn-login");

  if (!code) {
    msg.textContent = "❌ Convite ausente ou inválido.";
    msg.style.color = "#ef4444";
    showOptions();
    btnCadastro.href = "/cadastro.html";
    btnLogin.href = "/";
    return;
  }

  // Armazena o código do convite
  localStorage.setItem(INVITE_KEY, code);

  // Se já está logado, redireciona direto
  if (getToken()) {
    try {
      const me = await apiFetch("/api/me");
      if (me.role === "admin") {
        msg.textContent = "✓ Você está logado como admin. Redirecionando...";
        msg.style.color = "#22c55e";
        setTimeout(() => {
          window.location.href = "/admin-dashboard.html";
        }, 1000);
      } else {
        msg.textContent = "✓ Convite aceito! Redirecionando para o questionário...";
        msg.style.color = "#22c55e";
        setTimeout(() => {
          window.location.href = "/quiz.html";
        }, 1000);
      }
      return;
    } catch {
      // Token inválido, continua para login/cadastro
    }
  }

  msg.textContent = "✓ Convite válido! Escolha como deseja participar:";
  msg.style.color = "#22c55e";
  showOptions();
  
  // Preserva o código do convite nos links
  btnCadastro.href = `/cadastro.html?invite=${encodeURIComponent(code)}`;
  btnLogin.href = `/?invite=${encodeURIComponent(code)}`;

  // Guest form handler
  const guestForm = document.getElementById("guest-form");
  if (guestForm) {
    guestForm.addEventListener("submit", (e) => {
      e.preventDefault();
      setMsg("guest-msg", "");
      
      const nickname = document.getElementById("guest-nickname").value.trim();
      
      if (!nickname || nickname.length < 2) {
        setMsg("guest-msg", "Digite um apelido com pelo menos 2 caracteres.", true);
        return;
      }
      
      if (nickname.length > 30) {
        setMsg("guest-msg", "O apelido deve ter no máximo 30 caracteres.", true);
        return;
      }
      
      // Salva o apelido no sessionStorage
      sessionStorage.setItem(GUEST_KEY, nickname);
      
      // Redireciona para o quiz de convidado
      window.location.href = "/quiz-guest.html";
    });
  }
});
