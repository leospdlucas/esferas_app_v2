export const likertMap = {
  "1": -10,
  "2": -5,
  "3": 0,
  "4": 5,
  "5": 10
};

export function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function interpretAxis(score) {
  if (score >= 5) return "forte inclinação";
  if (score >= 2) return "inclinação moderada";
  if (score > -2) return "perfil neutro / oscilante";
  if (score > -5) return "baixa afinidade";
  return "rejeição forte";
}

export function computeScores(questions, answersById) {
  const M_vals = [];
  const C_vals = [];
  const R_vals = [];

  questions.forEach((q) => {
    const val = answersById[String(q.id)];
    if (typeof val !== "number") return;
    if (q.axis === "M") M_vals.push(val);
    if (q.axis === "C") C_vals.push(val);
    if (q.axis === "R") R_vals.push(val);
  });

  const mean = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;

  const S_M = mean(M_vals);
  const S_C = mean(C_vals);
  const S_R = mean(R_vals);
  return { S_M, S_C, S_R };
}

export function normalizeAffinities(S_M, S_C, S_R) {
  // Scores vão de -10 a +10, então somamos 10 para ter valores de 0 a 20
  let A_M = S_M + 10.0;
  let A_C = S_C + 10.0;
  let A_R = S_R + 10.0;

  const total = A_M + A_C + A_R;
  if (total === 0) {
    return { w_M: 1 / 3, w_C: 1 / 3, w_R: 1 / 3 };
  }

  return {
    w_M: A_M / total,
    w_C: A_C / total,
    w_R: A_R / total
  };
}

export function computeTriangleCoords(w_M, w_C, w_R) {
  const x_M = 0.0, y_M = 0.0;
  const x_C = 1.0, y_C = 0.0;
  const x_R = 0.5, y_R = Math.sqrt(3) / 2.0;

  const x = w_M * x_M + w_C * x_C + w_R * x_R;
  const y = w_M * y_M + w_C * y_C + w_R * y_R;
  return { x, y };
}

export function plotTriangle(canvas, point, { label = "Você", points = [] } = {}) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const margin = 40;
  const triWidth = width - margin * 2;
  const triHeight = height - margin * 2;

  const triNormHeight = Math.sqrt(3) / 2;
  const scaleX = triWidth;
  const scaleY = triHeight / triNormHeight;

  function mapX(x) { return margin + x * scaleX; }
  function mapY(y) { return height - margin - y * scaleY; }

  const M = { x: 0.0, y: 0.0 };
  const C = { x: 1.0, y: 0.0 };
  const R = { x: 0.5, y: triNormHeight };

  ctx.strokeStyle = "#4b5563";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(mapX(M.x), mapY(M.y));
  ctx.lineTo(mapX(C.x), mapY(C.y));
  ctx.lineTo(mapX(R.x), mapY(R.y));
  ctx.closePath();
  ctx.stroke();

  ctx.fillStyle = "#e5e7eb";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = "12px system-ui";
  ctx.fillText("Estirpe Pátria", mapX(M.x), mapY(M.y) + 4);
  ctx.fillText("(Segurança)", mapX(M.x), mapY(M.y) + 18);
  ctx.fillText("Ventos Áureo", mapX(C.x), mapY(C.y) + 4);
  ctx.fillText("(Prosperidade)", mapX(C.x), mapY(C.y) + 18);
  ctx.textBaseline = "bottom";
  ctx.fillText("Sociedade da Fé", mapX(R.x), mapY(R.y) - 4);
  ctx.fillText("(Sentido)", mapX(R.x), mapY(R.y) - 18);

  // Plot background points (all respondents)
  if (Array.isArray(points) && points.length > 0) {
    ctx.fillStyle = "rgba(34,197,94,0.30)";
    for (const p of points) {
      const px = mapX(p.x);
      const py = mapY(p.y);
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (point) {
    const px = mapX(point.x);
    const py = mapY(point.y);

    ctx.fillStyle = "#22c55e";
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = "12px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#e5e7eb";
    ctx.fillText(label, px + 8, py);
  }
}