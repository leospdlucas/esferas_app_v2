import { apiFetch, requireAuth, clearToken } from "./auth.js";
import { likertMap } from "./scoring.js";

let questions = [];

function renderQuestions() {
  const form = document.getElementById("quiz-form");
  form.innerHTML = "";

  questions.forEach((q, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "question-card";
    wrapper.id = `question-${q.id}`;
    wrapper.dataset.questionIndex = index + 1;

    const questionNumber = document.createElement("span");
    questionNumber.className = "question-number";
    questionNumber.textContent = `${index + 1}.`;
    
    const p = document.createElement("p");
    p.className = "question-text";
    p.appendChild(questionNumber);
    p.appendChild(document.createTextNode(` ${q.text}`));
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
      
      // Remove highlight quando responde
      input.addEventListener("change", () => {
        wrapper.classList.remove("unanswered-highlight");
      });

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
    status.textContent = `${questions.length} perguntas carregadas (ordem aleatória). Responda todas e clique em "Enviar e ver resultado".`;
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

function scrollToFirstUnanswered(missingIds) {
  if (missingIds.length === 0) return;
  
  const firstMissingId = missingIds[0];
  const element = document.getElementById(`question-${firstMissingId}`);
  
  if (element) {
    // Adiciona highlight visual
    element.classList.add("unanswered-highlight");
    
    // Scroll suave até a pergunta
    element.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center' 
    });
    
    // Pisca para chamar atenção
    element.style.animation = 'pulse-highlight 0.5s ease-in-out 3';
    
    // Remove animação após completar
    setTimeout(() => {
      element.style.animation = '';
    }, 1500);
  }
}

function highlightAllUnanswered(missingIds) {
  // Remove highlights anteriores
  document.querySelectorAll('.unanswered-highlight').forEach(el => {
    el.classList.remove('unanswered-highlight');
  });
  
  // Adiciona highlight em todas as não respondidas
  missingIds.forEach(id => {
    const element = document.getElementById(`question-${id}`);
    if (element) {
      element.classList.add("unanswered-highlight");
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await requireAuth();
  await loadQuestions();

  document.getElementById("logout").addEventListener("click", (e) => {
    e.preventDefault();
    clearToken();
    window.location.href = "/";
  });

  document.getElementById("submit-btn").addEventListener("click", async () => {
    const msg = document.getElementById("submit-msg");
    msg.textContent = "";
    msg.style.color = "#ef4444";
    
    const { answersById, missing } = collectAnswers();
    
    if (missing.length > 0) {
      // Destaca todas as perguntas não respondidas
      highlightAllUnanswered(missing);
      
      // Mensagem informativa
      const plural = missing.length > 1 ? 's' : '';
      msg.textContent = `⚠️ Você deixou ${missing.length} pergunta${plural} sem resposta. Rolando até a primeira...`;
      
      // Scroll até a primeira não respondida após breve delay
      setTimeout(() => {
        scrollToFirstUnanswered(missing);
      }, 300);
      
      return;
    }

    const submitBtn = document.getElementById("submit-btn");
    submitBtn.disabled = true;
    submitBtn.textContent = "Enviando...";
    msg.style.color = "#9ca3af";
    msg.textContent = "Processando respostas...";

    try {
      await apiFetch("/api/submit", {
        method: "POST",
        body: JSON.stringify({ answersById })
      });
      window.location.href = "/result.html";
    } catch (err) {
      msg.style.color = "#ef4444";
      msg.textContent = err.message;
      submitBtn.disabled = false;
      submitBtn.textContent = "Enviar e ver resultado";
    }
  });
});
