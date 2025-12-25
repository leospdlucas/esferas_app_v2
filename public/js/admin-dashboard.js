import { requireAuth, clearToken } from "./auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  const me = await requireAuth({ adminOnly: true });
  if (!me) return;

  document.getElementById("welcome").textContent = `Logado como: ${me.name} (${me.email})`;

  document.getElementById("logout").addEventListener("click", (e) => {
    e.preventDefault();
    clearToken();
    window.location.href = "/";
  });
});