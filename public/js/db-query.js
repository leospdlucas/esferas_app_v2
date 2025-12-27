import { apiFetch, requireAuth, clearToken } from "./auth.js";

let lastResults = [];
let lastColumns = [];

function setMsg(text, isError = false) {
  const el = document.getElementById("query-msg");
  el.textContent = text;
  el.className = isError ? "scale-legend msg-error" : "scale-legend msg-success";
}

function showResults(columns, rows) {
  lastColumns = columns;
  lastResults = rows;
  
  const card = document.getElementById("results-card");
  const content = document.getElementById("results-content");
  const count = document.getElementById("results-count");
  
  if (!rows || rows.length === 0) {
    count.textContent = "Nenhum resultado encontrado.";
    content.innerHTML = "";
    card.style.display = "block";
    return;
  }
  
  count.textContent = `${rows.length} registro(s) encontrado(s)`;
  
  // Build table
  let html = '<table class="results-table"><thead><tr>';
  columns.forEach(col => {
    html += `<th>${escapeHtml(col)}</th>`;
  });
  html += '</tr></thead><tbody>';
  
  rows.forEach(row => {
    html += '<tr>';
    columns.forEach(col => {
      const val = row[col];
      const display = val === null ? '<em style="color:var(--text-muted)">null</em>' : escapeHtml(String(val));
      html += `<td title="${escapeHtml(String(val || ''))}">${display}</td>`;
    });
    html += '</tr>';
  });
  
  html += '</tbody></table>';
  content.innerHTML = html;
  card.style.display = "block";
}

function showError(error) {
  const card = document.getElementById("results-card");
  const content = document.getElementById("results-content");
  const count = document.getElementById("results-count");
  
  count.textContent = "Erro na consulta";
  content.innerHTML = `<div class="error-box">${escapeHtml(error)}</div>`;
  card.style.display = "block";
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function exportCSV() {
  if (!lastResults.length) return;
  
  let csv = lastColumns.join(',') + '\n';
  lastResults.forEach(row => {
    const values = lastColumns.map(col => {
      const val = row[col];
      if (val === null) return '';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    });
    csv += values.join(',') + '\n';
  });
  
  downloadFile(csv, 'dte-export.csv', 'text/csv');
}

function exportJSON() {
  if (!lastResults.length) return;
  const json = JSON.stringify(lastResults, null, 2);
  downloadFile(json, 'dte-export.json', 'application/json');
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function copyResults() {
  if (!lastResults.length) return;
  
  let text = lastColumns.join('\t') + '\n';
  lastResults.forEach(row => {
    const values = lastColumns.map(col => row[col] ?? '');
    text += values.join('\t') + '\n';
  });
  
  try {
    await navigator.clipboard.writeText(text);
    setMsg("Copiado para a área de transferência!");
  } catch {
    setMsg("Erro ao copiar", true);
  }
}

async function loadStats() {
  try {
    const stats = await apiFetch("/api/admin/db-stats");
    document.getElementById("stat-users").textContent = stats.users || 0;
    document.getElementById("stat-submissions").textContent = stats.submissions || 0;
    document.getElementById("stat-invites").textContent = stats.invites || 0;
    document.getElementById("stat-today").textContent = stats.today || 0;
  } catch (err) {
    console.error("Erro ao carregar stats:", err);
  }
}

async function executeQuery(sql) {
  setMsg("");
  
  const btn = document.getElementById("btn-execute");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Executando...';
  
  try {
    const data = await apiFetch("/api/admin/db-query", {
      method: "POST",
      body: JSON.stringify({ sql })
    });
    
    if (data.error) {
      showError(data.error);
      setMsg("Erro na consulta", true);
    } else {
      showResults(data.columns || [], data.rows || []);
      setMsg(`Consulta executada em ${data.time || 0}ms`);
    }
  } catch (err) {
    showError(err.message);
    setMsg("Erro na consulta", true);
  } finally {
    btn.disabled = false;
    btn.textContent = "▶ Executar";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await requireAuth({ adminOnly: true });

  document.getElementById("logout").addEventListener("click", (e) => {
    e.preventDefault();
    clearToken();
    window.location.href = "/";
  });

  // Load stats
  await loadStats();

  // SQL input
  const sqlInput = document.getElementById("sql-input");
  
  // Execute button
  document.getElementById("btn-execute").addEventListener("click", () => {
    const sql = sqlInput.value.trim();
    if (!sql) {
      setMsg("Digite uma consulta SQL", true);
      return;
    }
    executeQuery(sql);
  });
  
  // Clear button
  document.getElementById("btn-clear").addEventListener("click", () => {
    sqlInput.value = "";
    document.getElementById("results-card").style.display = "none";
    setMsg("");
  });
  
  // Preset queries
  document.querySelectorAll(".preset-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const query = btn.dataset.query;
      sqlInput.value = query;
      executeQuery(query);
    });
  });
  
  // Export buttons
  document.getElementById("btn-export-csv").addEventListener("click", exportCSV);
  document.getElementById("btn-export-json").addEventListener("click", exportJSON);
  document.getElementById("btn-copy").addEventListener("click", copyResults);
  
  // Ctrl+Enter to execute
  sqlInput.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "Enter") {
      e.preventDefault();
      document.getElementById("btn-execute").click();
    }
  });
});
