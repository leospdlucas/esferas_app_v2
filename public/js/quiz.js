import { apiFetch, requireAuth, clearToken } from "./auth.js";
import { likertMap } from "./scoring.js";

const KEEP_ALIVE_MS = 5 * 60 * 1000; // 5 minutes

let questions = [];

function renderQuestions() {
  const form = document.getElementById("quiz-form");
  form.innerHTML = "";

  questions.forEach((q) => {
    const wrapper = document.createElement("div");
    wrapper.className = "question-card";

    const p = document.createElement("p");
    p.className = "question-text";
    p.textContent = q.text;
    wrapper.appendChild(p);

    const optionsRow = document.createElement("div");
    optionsRow.className = "options-row";

    const labels = [
      "Discordo totalmente",
      "Discordo parcialmente",
      "Neutro / Não sei",
      "Concordo parcialmente",
      "Concordo totalmente"
    ];

    for (let val = 1; val <= 5; val++) {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "q" + q.id;
      input.value = String(val);

      label.appendChild(input);
      const spanText = document.createElement("span");
      spanText.textContent = `${val} – ${labels[val - 1]}`;
      label.appendChild(spanText);
      optionsRow.appendChild(label);
    }

    wrapper.appendChild(optionsRow);
    form.appendChild(wrapper);
  });
}

async function loadQuestions() {
  const status = document.getElementById("status-msg");
  try {
    questions = await apiFetch("/api/questions");
    renderQuestions();
    status.textContent = "Perguntas carregadas (ordem aleatória). Responda todas e clique em \"Enviar e ver resultado\".";
    document.getElementById("submit-btn").disabled = false;
  } catch (err) {
    console.error(err);
    status.textContent = "Erro ao carregar perguntas.";
  }
}


function collectAnswers() {
  const answersById = {};
  const missing = [];
  questions.forEach((q) => {
    const selected = document.querySelector(`input[name="q${q.id}"]:checked`);
    if (!selected) missing.push(q.id);
    else answersById[String(q.id)] = likertMap[selected.value];
  });
  return { answersById, missing };
}

document.addEventListener("DOMContentLoaded", async () => {
  // Prevent free hosting from sleeping while the user is answering
  setInterval(() => { fetch("/api/ping").catch(() => {}); }, KEEP_ALIVE_MS);

  const me = await requireAuth();
  if (me && me.role === "admin") {
    window.location.href = "/admin-dashboard.html";
    return;
  }
  await loadQuestions();

  document.getElementById("logout").addEventListener("click", (e) => {
    e.preventDefault();
    clearToken();
    window.location.href = "/";
  });

  document.getElementById("submit-btn").addEventListener("click", async () => {
    const msg = document.getElementById("submit-msg");
    msg.textContent = "";
    const { answersById, missing } = collectAnswers();
    if (missing.length > 0) {
      msg.textContent = `Você deixou ${missing.length} pergunta(s) sem resposta.`;
      return;
    }

    try {
      await apiFetch("/api/submit", {
        method: "POST",
        body: JSON.stringify({ answersById })
      });
      window.location.href = "/result.html";
    } catch (err) {
      msg.textContent = err.message;
    }
  });
});