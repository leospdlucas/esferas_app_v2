import fs from "fs";
import path from "path";

export function loadQuestions() {
  const p = path.join(process.cwd(), "public", "data", "questions.json");
  const raw = fs.readFileSync(p, "utf-8");
  return JSON.parse(raw);
}

export function computeScores(questions, answersById) {
  const M_vals = [];
  const C_vals = [];
  const R_vals = [];

  for (const q of questions) {
    const val = answersById[String(q.id)];
    if (typeof val !== "number") continue;
    if (q.axis === "M") M_vals.push(val);
    if (q.axis === "C") C_vals.push(val);
    if (q.axis === "R") R_vals.push(val);
  }

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

  // Amplifica as diferenças com função exponencial
  const exponent = 2.0;
  A_M = Math.pow(A_M, exponent);
  A_C = Math.pow(A_C, exponent);
  A_R = Math.pow(A_R, exponent);

  const total = A_M + A_C + A_R;
  if (total === 0) return { w_M: 1/3, w_C: 1/3, w_R: 1/3 };

  return { w_M: A_M/total, w_C: A_C/total, w_R: A_R/total };
}

export function computeTriangleCoords(w_M, w_C, w_R) {
  const x_M = 0.0, y_M = 0.0;
  const x_C = 1.0, y_C = 0.0;
  const x_R = 0.5, y_R = Math.sqrt(3) / 2.0;
  const x = w_M * x_M + w_C * x_C + w_R * x_R;
  const y = w_M * y_M + w_C * y_C + w_R * y_R;
  return { x, y };
}

export function validateAnswers(questions, answersById) {
  // Ensure every question answered and values are valid (-10, -5, 0, 5, 10)
  const validValues = [-10, -5, 0, 5, 10];
  const missing = [];
  for (const q of questions) {
    const v = answersById[String(q.id)];
    if (typeof v !== "number" || !Number.isFinite(v)) missing.push(q.id);
    else if (!validValues.includes(v)) missing.push(q.id);
  }
  return { ok: missing.length === 0, missing };
}