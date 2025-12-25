import { apiFetch, requireAuth, clearToken } from "./auth.js";
import { interpretAxis, computeTriangleCoords, plotTriangle } from "./scoring.js";

function el(html) {
  const div = document.createElement("div");
  div.innerHTML = html.trim();
  return div.firstChild;
}

function setText(id, text) {
  document.getElementById(id).textContent = text ?? "";
}

document.addEventListener("DOMContentLoaded", async () => {
  await requireAuth({ adminOnly: true });

  document.getElementById("logout").addEventListener("click", (e) => {
    e.preventDefault();
    clearToken();
    window.location.href = "/";
  });

  const status = document.getElementById("status");

  setupInvites();
  try {
    const users = await apiFetch("/api/admin/users");
    status.textContent = `Total de usuários: ${users.length}. Clique em um usuário para ver detalhes.`;

    const container = document.getElementById("users");
    container.innerHTML = "";

    if (users.length === 0) {
      container.textContent = "Nenhum usuário encontrado.";
      return;
    }

    users.forEach((u) => {
      const row = el(`
        <div class="question-card" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div>
            <div style="font-weight:600;">${u.name}</div>
            <div class="scale-legend">${u.email} · ${u.role}</div>
          </div>
          <button type="button" data-id="${u.id}" style="margin:0;">Ver</button>
        </div>
      `);
      row.querySelector("button").addEventListener("click", () => loadDetail(u.id, u));
      container.appendChild(row);
    });
  } catch (err) {
    status.textContent = err.message;
  }
});

async function loadDetail(userId, u) {
  const status = document.getElementById("status");

  setupInvites();
  status.textContent = "Carregando detalhes...";
  try {
    const d = await apiFetch(`/api/admin/user/${userId}`);
    const card = document.getElementById("detail-card");
    card.style.display = "block";
    document.getElementById("detail-title").textContent =
      `${u.name} · ${u.email} · Última resposta: ${d.latest ? new Date(d.latest.created_at).toLocaleString("pt-BR") : "sem respostas"}`;

    if (!d.latest) {
      document.getElementById("raw").textContent = "Sem respostas.";
      status.textContent = "Usuário sem respostas.";
      return;
    }

    const r = d.latest;
    setText("d-score-M", Number(r.S_M).toFixed(2));
    setText("d-score-C", Number(r.S_C).toFixed(2));
    setText("d-score-R", Number(r.S_R).toFixed(2));
    setText("d-label-M", interpretAxis(Number(r.S_M)));
    setText("d-label-C", interpretAxis(Number(r.S_C)));
    setText("d-label-R", interpretAxis(Number(r.S_R)));
    setText("d-weight-M", (Number(r.w_M) * 100).toFixed(1) + "%");
    setText("d-weight-C", (Number(r.w_C) * 100).toFixed(1) + "%");
    setText("d-weight-R", (Number(r.w_R) * 100).toFixed(1) + "%");

    const canvas = document.getElementById("triangle-canvas");
    const point = computeTriangleCoords(Number(r.w_M), Number(r.w_C), Number(r.w_R));
    plotTriangle(canvas, point, { label: u.name });

    document.getElementById("raw").textContent = JSON.stringify(r.answersById, null, 2);
    status.textContent = "Detalhes carregados.";
  } catch (err) {
    status.textContent = err.message;
  }
}

async function setupInvites() {
  const btn = document.getElementById("inv-generate");
  const msg = document.getElementById("inv-msg");
  const linkBox = document.getElementById("inv-link");
  const list = document.getElementById("invites");

  async function refresh() {
    try {
      const invites = await apiFetch("/api/admin/invites");
      list.innerHTML = "";
      if (!invites || invites.length === 0) {
        list.textContent = "Nenhum convite ainda.";
        return;
      }
      for (const inv of invites) {
        const exp = inv.expires_at ? new Date(inv.expires_at + "Z").toLocaleString("pt-BR") : "—";
        const max = inv.max_uses && inv.max_uses > 0 ? inv.max_uses : "ilimitado";
        const row = document.createElement("div");
        row.className = "question-card";
        row.innerHTML = `
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;">
            <div>
              <div style="font-weight:600;">Código: ${inv.code}</div>
              <div class="scale-legend">Usos: ${inv.uses} / ${max} · Expira: ${exp}</div>
            </div>
            <button type="button" data-action="copy">Copiar link</button>
            <button type="button" data-action="qr">Ver QR</button>
          </div>
        `;
        const buttons = row.querySelectorAll("button");
        buttons.forEach((b) => b.addEventListener("click", async () => {
          const action = b.getAttribute("data-action");
          const url = `${window.location.origin}/invite.html?code=${inv.code}`;
          if (action === "copy") {
            await navigator.clipboard.writeText(url);
            msg.textContent = "Link copiado para a área de transferência.";
          } else if (action === "qr") {
            window.open(`/api/invites/${inv.code}/qr.png`, "_blank");
          }
        }));


        list.appendChild(row);
      }
    } catch (e) {
      list.textContent = "Erro ao carregar convites.";
    }
  }

  btn.addEventListener("click", async () => {
    msg.textContent = "";
    linkBox.style.display = "none";
    try {
      const expiresDaysRaw = document.getElementById("inv-expires").value;
      const maxUsesRaw = document.getElementById("inv-max").value;
      const payload = {
        expiresDays: expiresDaysRaw ? Number(expiresDaysRaw) : null,
        maxUses: maxUsesRaw ? Number(maxUsesRaw) : 0
      };
      const data = await apiFetch("/api/admin/invites", { method: "POST", body: JSON.stringify(payload) });
      const url = data.absoluteUrl || `${window.location.origin}${data.url}`;
      const qrWrap = document.getElementById("inv-qr-wrap");
      const qrImg = document.getElementById("inv-qr");
      const linkText = document.getElementById("inv-link-text");
      if (qrWrap && qrImg && linkText) {
        qrImg.src = data.qrPngUrl;
        linkText.textContent = url;
        qrWrap.style.display = "block";
      }
      // still copy link for convenience
      await navigator.clipboard.writeText(url);
      msg.textContent = "Convite criado. QR Code exibido e link copiado.";
      await refresh();
    } catch (e) {
      msg.textContent = e.message;
    }
  });

  await refresh();
}
