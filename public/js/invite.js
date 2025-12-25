import { apiFetch, getToken } from "./auth.js";

const INVITE_KEY = "dte_invite_code";

function qs(name) {
  const u = new URL(window.location.href);
  return u.searchParams.get(name);
}

document.addEventListener("DOMContentLoaded", async () => {
  const code = (qs("code") || "").trim();
  const msg = document.getElementById("msg");
  const go = document.getElementById("go");

  if (!code) {
    msg.textContent = "Convite ausente ou inválido.";
    go.href = "/";
    return;
  }

  // store locally so /register can include it
  localStorage.setItem(INVITE_KEY, code);

  // If already logged in, just go to quiz
  if (getToken()) {
    try {
      await apiFetch("/api/me");
      if (me.role === "admin") {
        msg.textContent = "Você está logado como admin. Indo para o painel...";
        go.href = "/admin-dashboard.html";
        window.location.href = "/admin-dashboard.html";
      } else {
        msg.textContent = "Convite registrado. Redirecionando para o questionário...";
        go.href = "/quiz.html";
        window.location.href = "/quiz.html";
      }
      return;
    } catch {
      // token invalid; keep going to login/register
    }
  }

  msg.textContent = "Convite registrado. Clique em “Continuar” para fazer login ou criar cadastro.";
  go.href = "/?invite=1";
});