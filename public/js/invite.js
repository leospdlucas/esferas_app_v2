import { apiFetch, getToken } from "./auth.js";

const INVITE_KEY = "dte_invite_code";

function qs(name) {
  const u = new URL(window.location.href);
  return u.searchParams.get(name);
}

document.addEventListener("DOMContentLoaded", async () => {
  const code = (qs("code") || "").trim();
  const msg = document.getElementById("msg");
  const actionsCard = document.getElementById("actions-card");
  const btnCadastro = document.getElementById("btn-cadastro");
  const btnLogin = document.getElementById("btn-login");

  if (!code) {
    msg.textContent = "❌ Convite ausente ou inválido.";
    msg.style.color = "#ef4444";
    actionsCard.style.display = "block";
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

  msg.textContent = "✓ Convite válido! Crie sua conta ou faça login para continuar.";
  msg.style.color = "#22c55e";
  actionsCard.style.display = "block";
  
  // Preserva o código do convite nos links
  btnCadastro.href = `/cadastro.html?invite=${encodeURIComponent(code)}`;
  btnLogin.href = `/?invite=${encodeURIComponent(code)}`;
});
