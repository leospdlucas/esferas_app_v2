import { apiFetch, requireAuth, clearToken } from "./auth.js";
import { interpretAxis, computeTriangleCoords, plotTriangle } from "./scoring.js";

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text ?? "";
}

function setBar(id, score) {
  const el = document.getElementById(id);
  if (el) {
    // Convert score from -10/+10 to 0-100%
    const percent = ((score + 10) / 20) * 100;
    setTimeout(() => {
      el.style.width = percent + '%';
    }, 100);
  }
}

function getDominantInfo(w_M, w_C, w_R) {
  const spheres = [
    { key: 'M', name: 'Segurança', subtitle: 'Estirpe Pátria', icon: '⚔️', weight: w_M, color: '#ef4444' },
    { key: 'C', name: 'Prosperidade', subtitle: 'Ventos Áureo', icon: '💰', weight: w_C, color: '#eab308' },
    { key: 'R', name: 'Sentido', subtitle: 'Sociedade da Fé', icon: '🙏', weight: w_R, color: '#8b5cf6' }
  ];
  
  spheres.sort((a, b) => b.weight - a.weight);
  return spheres[0];
}

document.addEventListener("DOMContentLoaded", async () => {
  const me = await requireAuth();
  
  document.getElementById("logout").addEventListener("click", (e) => {
    e.preventDefault();
    clearToken();
    window.location.href = "/";
  });

  const status = document.getElementById("status-msg");

  try {
    const data = await apiFetch("/api/my-latest");
    const date = new Date(data.created_at).toLocaleString("pt-BR");
    status.textContent = `Resultado de ${date}`;

    const S_M = Number(data.S_M);
    const S_C = Number(data.S_C);
    const S_R = Number(data.S_R);
    const w_M = Number(data.w_M);
    const w_C = Number(data.w_C);
    const w_R = Number(data.w_R);

    // Set scores
    setText("score-M", S_M.toFixed(1));
    setText("score-C", S_C.toFixed(1));
    setText("score-R", S_R.toFixed(1));

    // Set interpretations
    setText("label-M", interpretAxis(S_M));
    setText("label-C", interpretAxis(S_C));
    setText("label-R", interpretAxis(S_R));

    // Set weights
    setText("weight-M", (w_M * 100).toFixed(0) + "%");
    setText("weight-C", (w_C * 100).toFixed(0) + "%");
    setText("weight-R", (w_R * 100).toFixed(0) + "%");

    // Animate bars
    setBar("bar-M", S_M);
    setBar("bar-C", S_C);
    setBar("bar-R", S_R);

    // Set dominant sphere
    const dominant = getDominantInfo(w_M, w_C, w_R);
    document.getElementById("dominant-icon").textContent = dominant.icon;
    document.getElementById("dominant-name").innerHTML = `
      <strong style="color:${dominant.color}">${dominant.name}</strong> · ${dominant.subtitle}
      <br><span style="font-size:1.5rem;font-weight:700;color:${dominant.color}">${(dominant.weight * 100).toFixed(0)}%</span>
    `;
    document.getElementById("dominant-card").style.borderColor = dominant.color;
    document.getElementById("dominant-card").style.background = `linear-gradient(135deg, ${dominant.color}22, ${dominant.color}11)`;

    // Draw triangle
    const canvas = document.getElementById("triangle-canvas");
    const point = computeTriangleCoords(w_M, w_C, w_R);
    plotTriangle(canvas, point, { 
      label: "Você", 
      weights: { w_M, w_C, w_R }
    });

    // Show admin link if admin
    if (me && me.role === "admin") {
      document.getElementById("admin-links").style.display = "block";
    }
    
  } catch (err) {
    status.textContent = "Você ainda não respondeu ao questionário.";
    document.getElementById("results").style.display = "none";
    
    // Show a helpful message
    const card = document.createElement("div");
    card.className = "card";
    card.style.textAlign = "center";
    card.innerHTML = `
      <p style="margin-bottom:16px;color:var(--text-secondary);">Complete o questionário para ver seu resultado.</p>
      <a href="/quiz.html" class="button">Responder agora</a>
    `;
    document.querySelector(".container").appendChild(card);
  }
});
