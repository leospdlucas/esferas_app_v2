import { apiFetch, requireAuth, clearToken } from "./auth.js";
import { computeTriangleCoords, plotTriangle } from "./scoring.js";

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
  try {
    const data = await apiFetch("/api/admin/aggregate");
    status.textContent = "Dados carregados.";

    setText("n", data.n);

    setText("score-M", Number(data.S_M).toFixed(2));
    setText("score-C", Number(data.S_C).toFixed(2));
    setText("score-R", Number(data.S_R).toFixed(2));

    setText("weight-M", (Number(data.w_M) * 100).toFixed(1) + "%");
    setText("weight-C", (Number(data.w_C) * 100).toFixed(1) + "%");
    setText("weight-R", (Number(data.w_R) * 100).toFixed(1) + "%");

    const points = (data.points || []).map(p => ({ x: Number(p.x), y: Number(p.y) }));
    const aggPoint = computeTriangleCoords(Number(data.w_M), Number(data.w_C), Number(data.w_R));

    plotTriangle(document.getElementById("triangle-canvas"), aggPoint, {
      label: "Média",
      points,
      weights: { w_M: Number(data.w_M), w_C: Number(data.w_C), w_R: Number(data.w_R) }
    });
  } catch (err) {
    status.textContent = err.message;
  }
});