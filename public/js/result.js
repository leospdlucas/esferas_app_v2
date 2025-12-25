import { apiFetch, requireAuth, clearToken } from "./auth.js";
import { interpretAxis, computeTriangleCoords, plotTriangle } from "./scoring.js";

function setText(id, text) {
  const el = document.getElementById(id);
  el.textContent = text ?? "";
}

function dominantLabel(w_M, w_C, w_R) {
  const weights = {
    "Estirpe Pátria (Segurança)": w_M,
    "Ventos Áureo (Prosperidade)": w_C,
    "Sociedade da Fé (Sentido)": w_R
  };
  let dominant = "";
  let maxVal = -Infinity;
  for (const [k, v] of Object.entries(weights)) {
    if (v > maxVal) { maxVal = v; dominant = k; }
  }
  return `${dominant} (${(maxVal * 100).toFixed(1)}%)`;
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
    status.textContent = `Última resposta em ${new Date(data.created_at).toLocaleString("pt-BR")}.`;

    setText("score-M", Number(data.S_M).toFixed(2));
    setText("score-C", Number(data.S_C).toFixed(2));
    setText("score-R", Number(data.S_R).toFixed(2));

    setText("label-M", interpretAxis(Number(data.S_M)));
    setText("label-C", interpretAxis(Number(data.S_C)));
    setText("label-R", interpretAxis(Number(data.S_R)));

    setText("weight-M", (Number(data.w_M) * 100).toFixed(1) + "%");
    setText("weight-C", (Number(data.w_C) * 100).toFixed(1) + "%");
    setText("weight-R", (Number(data.w_R) * 100).toFixed(1) + "%");

    setText("dominant-esfera", dominantLabel(Number(data.w_M), Number(data.w_C), Number(data.w_R)));

    const canvas = document.getElementById("triangle-canvas");
    const point = computeTriangleCoords(Number(data.w_M), Number(data.w_C), Number(data.w_R));
    plotTriangle(canvas, point, { label: "Você" });

    if (me && me.role === "admin") {
      document.getElementById("admin-links").style.display = "block";
    }
  } catch (err) {
    status.textContent = "Você ainda não respondeu. Vá em “Responder novamente”.";
  }
});