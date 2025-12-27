import { interpretAxis, computeTriangleCoords, plotTriangle } from "./scoring.js";

let shareData = {
  dominant: '',
  dominantPercent: 0,
  w_M: 0,
  w_C: 0,
  w_R: 0
};

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text ?? "";
}

function setBar(id, score) {
  const el = document.getElementById(id);
  if (el) {
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

function showToast(message) {
  const toast = document.getElementById('share-toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

function getShareText() {
  const pctM = (shareData.w_M * 100).toFixed(0);
  const pctC = (shareData.w_C * 100).toFixed(0);
  const pctR = (shareData.w_R * 100).toFixed(0);
  
  return `🎯 Meu resultado no DTE (Diagrama de Tendência Esferal):

${shareData.dominant.icon} Esfera dominante: ${shareData.dominant.name} (${shareData.dominantPercent}%)

⚔️ Segurança: ${pctM}%
💰 Prosperidade: ${pctC}%
🙏 Sentido: ${pctR}%

Descubra sua tendência também!`;
}

function getShareUrl() {
  return window.location.origin;
}

function generateShareImage() {
  return new Promise((resolve) => {
    const originalCanvas = document.getElementById('triangle-canvas');
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const padding = 40;
    const headerHeight = 80;
    const footerHeight = 60;
    
    canvas.width = originalCanvas.width + padding * 2;
    canvas.height = originalCanvas.height + headerHeight + footerHeight + padding;
    
    ctx.fillStyle = '#030014';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#6366f1';
    ctx.font = 'bold 28px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DTE', canvas.width / 2, 45);
    
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px Inter, sans-serif';
    ctx.fillText('Diagrama de Tendência Esferal', canvas.width / 2, 70);
    
    ctx.drawImage(originalCanvas, padding, headerHeight);
    
    const footerY = headerHeight + originalCanvas.height + 20;
    ctx.fillStyle = '#f1f5f9';
    ctx.font = 'bold 16px Inter, sans-serif';
    ctx.textAlign = 'center';
    
    const pctM = (shareData.w_M * 100).toFixed(0);
    const pctC = (shareData.w_C * 100).toFixed(0);
    const pctR = (shareData.w_R * 100).toFixed(0);
    
    ctx.fillText(`⚔️ ${pctM}%   💰 ${pctC}%   🙏 ${pctR}%`, canvas.width / 2, footerY);
    
    ctx.fillStyle = '#64748b';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText(window.location.origin, canvas.width / 2, footerY + 25);
    
    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/png');
  });
}

async function downloadImage() {
  const blob = await generateShareImage();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'meu-resultado-dte.png';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Imagem baixada!');
}

async function copyResultText() {
  const text = getShareText() + '\n' + getShareUrl();
  try {
    await navigator.clipboard.writeText(text);
    showToast('Texto copiado!');
  } catch {
    showToast('Erro ao copiar');
  }
}

function shareWhatsApp() {
  const text = encodeURIComponent(getShareText() + '\n\n' + getShareUrl());
  window.open(`https://wa.me/?text=${text}`, '_blank');
}

function shareTwitter() {
  const text = encodeURIComponent(`🎯 Meu resultado no DTE: ${shareData.dominant.icon} ${shareData.dominant.name} (${shareData.dominantPercent}%)!\n\nDescubra sua tendência também:`);
  const url = encodeURIComponent(getShareUrl());
  window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
}

function shareFacebook() {
  const url = encodeURIComponent(getShareUrl());
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
}

function shareTelegram() {
  const text = encodeURIComponent(getShareText());
  const url = encodeURIComponent(getShareUrl());
  window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank');
}

document.addEventListener("DOMContentLoaded", () => {
  // Get result from sessionStorage
  const storedResult = sessionStorage.getItem("dte_guest_result");
  
  if (!storedResult) {
    // No result, redirect to quiz
    window.location.href = "/quiz-guest.html";
    return;
  }

  const data = JSON.parse(storedResult);

  const S_M = Number(data.S_M);
  const S_C = Number(data.S_C);
  const S_R = Number(data.S_R);
  const w_M = Number(data.w_M);
  const w_C = Number(data.w_C);
  const w_R = Number(data.w_R);

  // Store for sharing
  shareData.w_M = w_M;
  shareData.w_C = w_C;
  shareData.w_R = w_R;

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
  shareData.dominant = dominant;
  shareData.dominantPercent = (dominant.weight * 100).toFixed(0);
  
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

  // Setup share buttons
  document.getElementById('share-whatsapp').addEventListener('click', shareWhatsApp);
  document.getElementById('share-twitter').addEventListener('click', shareTwitter);
  document.getElementById('share-facebook').addEventListener('click', shareFacebook);
  document.getElementById('share-telegram').addEventListener('click', shareTelegram);
  document.getElementById('download-image').addEventListener('click', downloadImage);
  document.getElementById('copy-result').addEventListener('click', copyResultText);
});
