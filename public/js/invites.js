import { apiFetch, requireAuth, clearToken } from "./auth.js";

function fmtDate(sqliteDate) {
  if (!sqliteDate) return "—";
  // sqlite "YYYY-MM-DD HH:MM:SS"
  return new Date(sqliteDate.replace(" ", "T") + "Z").toLocaleString("pt-BR");
}

function el(html) {
  const div = document.createElement("div");
  div.innerHTML = html.trim();
  return div.firstChild;
}

document.addEventListener("DOMContentLoaded", async () => {
  await requireAuth({ adminOnly: true });

  document.getElementById("logout").addEventListener("click", (e) => {
    e.preventDefault();
    clearToken();
    window.location.href = "/";
  });

  document.getElementById("status").textContent = "Pronto.";

  const msg = document.getElementById("inv-msg");
  const qrWrap = document.getElementById("inv-qr-wrap");
  const qrImg = document.getElementById("inv-qr");
  const linkText = document.getElementById("inv-link-text");
  const list = document.getElementById("invites");

  async function refresh() {
    const invites = await apiFetch("/api/admin/invites");
    list.innerHTML = "";
    if (!invites || invites.length === 0) {
      list.textContent = "Nenhum convite ainda.";
      return;
    }
    for (const inv of invites) {
      const exp = inv.expires_at ? fmtDate(inv.expires_at) : "—";
      const max = inv.max_uses && inv.max_uses > 0 ? inv.max_uses : "ilimitado";
      const row = el(`
        <div class="question-card" style="display:flex;justify-content:space-between;gap:12px;align-items:center;">
          <div>
            <div style="font-weight:600;">Código: ${inv.code}</div>
            <div class="scale-legend">Usos: ${inv.uses} / ${max} · Expira: ${exp}</div>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button type="button" data-action="copy">Copiar link</button>
            <button type="button" data-action="qr">Ver QR</button>
          </div>
        </div>
      `);

      row.querySelectorAll("button").forEach((b) => b.addEventListener("click", async () => {
        const action = b.getAttribute("data-action");
        const url = `${window.location.origin}/invite.html?code=${inv.code}`;
        if (action === "copy") {
          await navigator.clipboard.writeText(url);
          msg.textContent = "Link copiado.";
        } else if (action === "qr") {
          window.open(`/api/invites/${inv.code}/qr.png`, "_blank");
        }
      }));

      list.appendChild(row);
    }
  }

  document.getElementById("inv-generate").addEventListener("click", async () => {
    msg.textContent = "";
    qrWrap.style.display = "none";
    try {
      const expiresDaysRaw = document.getElementById("inv-expires").value;
      const maxUsesRaw = document.getElementById("inv-max").value;

      const payload = {
        expiresDays: expiresDaysRaw ? Number(expiresDaysRaw) : null,
        maxUses: maxUsesRaw ? Number(maxUsesRaw) : 0
      };

      const data = await apiFetch("/api/admin/invites", { method: "POST", body: JSON.stringify(payload) });
      const url = data.absoluteUrl || `${window.location.origin}${data.url}`;

      qrImg.src = data.qrPngUrl;
      linkText.textContent = url;
      qrWrap.style.display = "block";

      await navigator.clipboard.writeText(url);
      msg.textContent = "Convite criado. QR Code exibido e link copiado.";
      await refresh();
    } catch (e) {
      msg.textContent = e.message;
    }
  });

  await refresh();
});