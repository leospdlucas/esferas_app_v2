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

async function showUser(user) {
  const status = document.getElementById("status");
  status.textContent = "Carregando detalhes...";
  const d = await apiFetch(`/api/admin/user/${user.id}`);
  const card = document.getElementById("detail-card");
  card.style.display = "block";

  const latest = d.latest;
  setText("detail-title",
    `${user.name} · ${user.email} · Última resposta: ${latest ? new Date(latest.created_at).toLocaleString("pt-BR") : "sem respostas"}`
  );

  if (!latest) {
    document.getElementById("raw").textContent = "Sem respostas.";
    status.textContent = "Usuário sem respostas.";
    return;
  }

  setText("d-score-M", Number(latest.S_M).toFixed(2));
  setText("d-score-C", Number(latest.S_C).toFixed(2));
  setText("d-score-R", Number(latest.S_R).toFixed(2));

  setText("d-label-M", interpretAxis(Number(latest.S_M)));
  setText("d-label-C", interpretAxis(Number(latest.S_C)));
  setText("d-label-R", interpretAxis(Number(latest.S_R)));

  setText("d-weight-M", (Number(latest.w_M) * 100).toFixed(1) + "%");
  setText("d-weight-C", (Number(latest.w_C) * 100).toFixed(1) + "%");
  setText("d-weight-R", (Number(latest.w_R) * 100).toFixed(1) + "%");

  const canvas = document.getElementById("triangle-canvas");
  const point = computeTriangleCoords(Number(latest.w_M), Number(latest.w_C), Number(latest.w_R));
  plotTriangle(canvas, point, { label: user.name });

  document.getElementById("raw").textContent = JSON.stringify(latest.answersById, null, 2);
  status.textContent = "Detalhes carregados.";
}

document.addEventListener("DOMContentLoaded", async () => {
  await requireAuth({ adminOnly: true });

  document.getElementById("logout").addEventListener("click", (e) => {
    e.preventDefault();
    clearToken();
    window.location.href = "/";
  });

  const input = document.getElementById("q");
  const btn = document.getElementById("search");
  const msg = document.getElementById("msg");
  const results = document.getElementById("results");
  const status = document.getElementById("status");

  async function runSearch() {
    msg.textContent = "";
    results.innerHTML = "";
    document.getElementById("detail-card").style.display = "none";

    const q = input.value.trim();
    if (!q) {
      msg.textContent = "Informe parte do nome ou e-mail.";
      return;
    }

    status.textContent = "Buscando...";
    try {
      const data = await apiFetch(`/api/admin/search?query=${encodeURIComponent(q)}`);
      status.textContent = `Encontrado(s): ${data.length}`;
      if (!data.length) {
        results.textContent = "Nenhum usuário encontrado.";
        return;
      }
      data.forEach((u) => {
        const row = el(`
          <div class="question-card" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
            <div>
              <div style="font-weight:600;">${u.name}</div>
              <div class="scale-legend">${u.email}</div>
            </div>
            <button type="button">Ver</button>
          </div>
        `);
        row.querySelector("button").addEventListener("click", () => showUser(u));
        results.appendChild(row);
      });
    } catch (e) {
      status.textContent = "Erro.";
      msg.textContent = e.message;
    }
  }

  btn.addEventListener("click", runSearch);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runSearch();
  });
});