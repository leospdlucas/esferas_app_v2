import { likertMap, shuffle, computeScores, normalizeAffinities } from "./scoring.js";

let questions = [];

function setMsg(id, text, isError = false) {
  const el = document.getElementById(id);
  el.textContent = text || "";
  el.className = isError ? "scale-legend msg-error" : "scale-legend msg-success";
}

function renderQuestions(qs) {
  const form = document.getElementById("quiz-form");
  form.innerHTML = "";

  qs.forEach((q, idx) => {
    const div = document.createElement("div");
    div.className = "question-card";
    div.id = `question-${q.id}`;
    div.innerHTML = `
      <p class="question-text"><span class="question-number">${idx + 1}.</span> ${q.text}</p>
      <div class="options-row">
        ${[1, 2, 3, 4, 5].map(v => `
          <label>
            <input type="radio" name="q${q.id}" value="${v}" />
            <span>${v} - ${["Discordo totalmente", "Discordo parcialmente", "Neutro", "Concordo parcialmente", "Concordo totalmente"][v - 1]}</span>
          </label>
        `).join("")}
      </div>
    `;
    form.appendChild(div);
  });

  // Add change listeners to enable submit button
  form.querySelectorAll('input[type="radio"]').forEach(input => {
    input.addEventListener("change", checkAllAnswered);
  });
}

function checkAllAnswered() {
  const answered = document.querySelectorAll('#quiz-form input[type="radio"]:checked').length;
  const total = questions.length;
  const btn = document.getElementById("submit-btn");
  
  btn.disabled = answered < total;
  
  if (answered < total) {
    setMsg("status-msg", `${answered} de ${total} respondidas`);
  } else {
    setMsg("status-msg", `✓ Todas respondidas! Clique no botão abaixo.`);
  }
}

function collectAnswers() {
  const answersById = {};
  questions.forEach(q => {
    const checked = document.querySelector(`input[name="q${q.id}"]:checked`);
    if (checked) {
      answersById[String(q.id)] = likertMap[checked.value];
    }
  });
  return answersById;
}

function findFirstUnanswered() {
  for (const q of questions) {
    const checked = document.querySelector(`input[name="q${q.id}"]:checked`);
    if (!checked) {
      return q.id;
    }
  }
  return null;
}

function scrollToQuestion(qId) {
  const el = document.getElementById(`question-${qId}`);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("unanswered-highlight");
    setTimeout(() => el.classList.remove("unanswered-highlight"), 3000);
  }
}

async function loadQuestions() {
  try {
    const response = await fetch("/data/questions.json");
    const data = await response.json();
    questions = shuffle([...data]);
    renderQuestions(questions);
    setMsg("status-msg", `0 de ${questions.length} respondidas`);
  } catch (err) {
    setMsg("status-msg", "Erro ao carregar perguntas: " + err.message, true);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadQuestions();

  document.getElementById("submit-btn").addEventListener("click", () => {
    const unansweredId = findFirstUnanswered();
    if (unansweredId) {
      setMsg("submit-msg", "Responda todas as perguntas antes de continuar.", true);
      scrollToQuestion(unansweredId);
      return;
    }

    const answersById = collectAnswers();
    
    // Compute scores locally
    const { S_M, S_C, S_R } = computeScores(questions, answersById);
    const { w_M, w_C, w_R } = normalizeAffinities(S_M, S_C, S_R);
    
    // Store in sessionStorage for result page
    const resultData = {
      S_M, S_C, S_R,
      w_M, w_C, w_R,
      created_at: new Date().toISOString(),
      isGuest: true
    };
    
    sessionStorage.setItem("dte_guest_result", JSON.stringify(resultData));
    
    // Redirect to guest result page
    window.location.href = "/result-guest.html";
  });
});
