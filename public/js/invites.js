import { apiFetch, requireAuth, clearToken } from "./auth.js";

let currentInviteCode = null;

function fmtDate(sqliteDate) {
  if (!sqliteDate) return "Nunca";
  return new Date(sqliteDate.replace(" ", "T") + "Z").toLocaleString("pt-BR");
}

function showToast(message = "Link copiado!") {
  const toast = document.getElementById("copied-toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2000);
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("Link copiado!");
    return true;
  } catch {
    // Fallback para navegadores mais antigos
    const input = document.createElement("input");
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    document.body.removeChild(input);
    showToast("Link copiado!");
    return true;
  }
}

async function shareLink(url, title = "Convite DTE") {
  if (navigator.share) {
    try {
      await navigator.share({
        title: title,
        text: "Você foi convidado para responder o Diagrama de Tendência Esferal!",
        url: url
      });
    } catch (err) {
      // Usuário cancelou ou erro - copia para clipboard como fallback
      await copyToClipboard(url);
    }
  } else {
    // Navegador não suporta share - copia para clipboard
    await copyToClipboard(url);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await requireAuth({ adminOnly: true });

  document.getElementById("logout").addEventListener("click", (e) => {
    e.preventDefault();
    clearToken();
    window.location.href = "/";
  });

  document.getElementById("status").textContent = "Pronto para gerar convites.";

  const msg = document.getElementById("inv-msg");
  const resultDiv = document.getElementById("invite-result");
  const linkInput = document.getElementById("invite-link");
  const qrDisplay = document.getElementById("qr-display");
  const qrImage = document.getElementById("qr-image");
  const invitesList = document.getElementById("invites-list");

  // Carregar lista de convites
  async function loadInvites() {
    try {
      const invites = await apiFetch("/api/admin/invites");
      invitesList.innerHTML = "";
      
      if (!invites || invites.length === 0) {
        invitesList.innerHTML = '<p class="scale-legend">Nenhum convite criado ainda.</p>';
        return;
      }

      for (const inv of invites) {
        const url = `${window.location.origin}/invite.html?code=${inv.code}`;
        const maxUses = inv.max_uses > 0 ? inv.max_uses : "∞";
        const status = inv.max_uses > 0 && inv.uses >= inv.max_uses ? 
          '<span class="badge badge-danger">Esgotado</span>' : 
          '<span class="badge badge-success">Ativo</span>';

        const item = document.createElement("div");
        item.className = "invite-item";
        item.innerHTML = `
          <div class="invite-info">
            <div class="invite-code">${inv.code.substring(0, 8)}...</div>
            <div class="invite-meta">
              Usos: ${inv.uses}/${maxUses} · Expira: ${fmtDate(inv.expires_at)} ${status}
            </div>
          </div>
          <div class="invite-buttons">
            <button type="button" data-action="copy" title="Copiar link">📋</button>
            <button type="button" data-action="qr" title="Ver QR Code">📱</button>
            <button type="button" data-action="share" title="Compartilhar">📤</button>
          </div>
        `;

        item.querySelectorAll("button").forEach(btn => {
          btn.addEventListener("click", async () => {
            const action = btn.dataset.action;
            if (action === "copy") {
              await copyToClipboard(url);
            } else if (action === "qr") {
              window.open(`/api/invites/${inv.code}/qr.png`, "_blank");
            } else if (action === "share") {
              await shareLink(url);
            }
          });
        });

        invitesList.appendChild(item);
      }
    } catch (err) {
      invitesList.innerHTML = `<p class="scale-legend msg-error">Erro ao carregar: ${err.message}</p>`;
    }
  }

  // Gerar novo convite
  document.getElementById("inv-generate").addEventListener("click", async () => {
    msg.textContent = "";
    resultDiv.style.display = "none";
    qrDisplay.style.display = "none";

    const btn = document.getElementById("inv-generate");
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Gerando...';

    try {
      const expiresDaysRaw = document.getElementById("inv-expires").value;
      const maxUsesRaw = document.getElementById("inv-max").value;

      const payload = {
        expiresDays: expiresDaysRaw ? Number(expiresDaysRaw) : null,
        maxUses: maxUsesRaw ? Number(maxUsesRaw) : 0
      };

      const data = await apiFetch("/api/admin/invites", { 
        method: "POST", 
        body: JSON.stringify(payload) 
      });

      const url = data.absoluteUrl || `${window.location.origin}${data.url}`;
      currentInviteCode = data.code;

      // Mostrar resultado
      linkInput.value = url;
      qrImage.src = `/api/invites/${data.code}/qr.png`;
      resultDiv.style.display = "block";

      // Copiar automaticamente
      await copyToClipboard(url);

      // Recarregar lista
      await loadInvites();

    } catch (err) {
      msg.textContent = err.message;
    } finally {
      btn.disabled = false;
      btn.textContent = "Gerar Convite";
    }
  });

  // Copiar link
  document.getElementById("copy-link").addEventListener("click", async () => {
    await copyToClipboard(linkInput.value);
  });

  // Mostrar QR Code
  document.getElementById("show-qr").addEventListener("click", () => {
    qrDisplay.style.display = qrDisplay.style.display === "none" ? "block" : "none";
  });

  // Baixar QR Code
  document.getElementById("download-qr").addEventListener("click", () => {
    if (currentInviteCode) {
      const link = document.createElement("a");
      link.href = `/api/invites/${currentInviteCode}/qr.png`;
      link.download = `convite-dte-${currentInviteCode.substring(0, 8)}.png`;
      link.click();
    }
  });

  // Compartilhar
  document.getElementById("share-link").addEventListener("click", async () => {
    await shareLink(linkInput.value);
  });

  // Carregar convites iniciais
  await loadInvites();
});
