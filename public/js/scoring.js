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
  // Converte de -10/+10 para 0/20
  let A_M = S_M + 10.0;
  let A_C = S_C + 10.0;
  let A_R = S_R + 10.0;

  // Amplifica as diferenças com função exponencial
  // Expoente 2.0 faz com que diferenças pequenas se tornem maiores
  // Ex: se A_M=15, A_C=12, A_R=10 → antes: 40.5%, 32.4%, 27%
  //                                → depois: 51%, 32.6%, 16.4%
  const exponent = 2.0;
  A_M = Math.pow(A_M, exponent);
  A_C = Math.pow(A_C, exponent);
  A_R = Math.pow(A_R, exponent);

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

export function plotTriangle(canvas, point, { label = "Você", points = [], weights = null } = {}) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  
  // High DPI support
  const displayWidth = canvas.clientWidth || canvas.width;
  const displayHeight = canvas.clientHeight || canvas.height;
  canvas.width = displayWidth * dpr;
  canvas.height = displayHeight * dpr;
  ctx.scale(dpr, dpr);
  
  const width = displayWidth;
  const height = displayHeight;
  
  // Clear with gradient background
  const bgGradient = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width);
  bgGradient.addColorStop(0, '#0a0a1a');
  bgGradient.addColorStop(1, '#030014');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);

  const margin = 60;
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

  // Draw glow effect behind triangle
  ctx.shadowColor = 'rgba(99, 102, 241, 0.3)';
  ctx.shadowBlur = 30;
  
  // Triangle gradient fill
  const triGradient = ctx.createLinearGradient(mapX(0), mapY(triNormHeight), mapX(1), mapY(0));
  triGradient.addColorStop(0, 'rgba(139, 92, 246, 0.1)');
  triGradient.addColorStop(0.5, 'rgba(99, 102, 241, 0.05)');
  triGradient.addColorStop(1, 'rgba(6, 182, 212, 0.1)');
  
  ctx.fillStyle = triGradient;
  ctx.beginPath();
  ctx.moveTo(mapX(M.x), mapY(M.y));
  ctx.lineTo(mapX(C.x), mapY(C.y));
  ctx.lineTo(mapX(R.x), mapY(R.y));
  ctx.closePath();
  ctx.fill();
  
  ctx.shadowBlur = 0;

  // Draw grid lines inside triangle
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.1)';
  ctx.lineWidth = 0.5;
  
  // Inner triangles
  for (let i = 1; i <= 3; i++) {
    const ratio = i / 4;
    const innerM = { x: M.x + (0.5 - M.x) * ratio, y: M.y + (triNormHeight/3 - M.y) * ratio };
    const innerC = { x: C.x + (0.5 - C.x) * ratio, y: C.y + (triNormHeight/3 - C.y) * ratio };
    const innerR = { x: R.x + (0.5 - R.x) * ratio, y: R.y + (triNormHeight/3 - R.y) * ratio };
    
    ctx.beginPath();
    ctx.moveTo(mapX(M.x * (1-ratio) + 0.5 * ratio), mapY(M.y * (1-ratio) + triNormHeight/3 * ratio));
    ctx.lineTo(mapX(C.x * (1-ratio) + 0.5 * ratio), mapY(C.y * (1-ratio) + triNormHeight/3 * ratio));
    ctx.lineTo(mapX(R.x * (1-ratio) + 0.5 * ratio), mapY(R.y * (1-ratio) + triNormHeight/3 * ratio));
    ctx.closePath();
    ctx.stroke();
  }

  // Draw main triangle border with gradient
  const borderGradient = ctx.createLinearGradient(mapX(0), mapY(0), mapX(1), mapY(triNormHeight));
  borderGradient.addColorStop(0, '#6366f1');
  borderGradient.addColorStop(0.5, '#8b5cf6');
  borderGradient.addColorStop(1, '#06b6d4');
  
  ctx.strokeStyle = borderGradient;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(mapX(M.x), mapY(M.y));
  ctx.lineTo(mapX(C.x), mapY(C.y));
  ctx.lineTo(mapX(R.x), mapY(R.y));
  ctx.closePath();
  ctx.stroke();

  // Draw vertex icons/circles
  const vertexRadius = 8;
  
  // M vertex (Segurança) - Red/Orange
  ctx.fillStyle = '#ef4444';
  ctx.shadowColor = '#ef4444';
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.arc(mapX(M.x), mapY(M.y), vertexRadius, 0, Math.PI * 2);
  ctx.fill();
  
  // C vertex (Prosperidade) - Yellow/Gold
  ctx.fillStyle = '#eab308';
  ctx.shadowColor = '#eab308';
  ctx.beginPath();
  ctx.arc(mapX(C.x), mapY(C.y), vertexRadius, 0, Math.PI * 2);
  ctx.fill();
  
  // R vertex (Fé) - Purple/Blue
  ctx.fillStyle = '#8b5cf6';
  ctx.shadowColor = '#8b5cf6';
  ctx.beginPath();
  ctx.arc(mapX(R.x), mapY(R.y), vertexRadius, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.shadowBlur = 0;

  // Draw vertex labels
  ctx.font = "bold 14px 'Inter', system-ui";
  ctx.textAlign = "center";
  
  // M label
  ctx.fillStyle = "#ef4444";
  ctx.textBaseline = "top";
  ctx.fillText("⚔️ SEGURANÇA", mapX(M.x), mapY(M.y) + 15);
  ctx.font = "11px 'Inter', system-ui";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText("Estirpe Pátria", mapX(M.x), mapY(M.y) + 33);
  
  // C label
  ctx.font = "bold 14px 'Inter', system-ui";
  ctx.fillStyle = "#eab308";
  ctx.fillText("💰 PROSPERIDADE", mapX(C.x), mapY(C.y) + 15);
  ctx.font = "11px 'Inter', system-ui";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText("Ventos Áureo", mapX(C.x), mapY(C.y) + 33);
  
  // R label
  ctx.font = "bold 14px 'Inter', system-ui";
  ctx.fillStyle = "#8b5cf6";
  ctx.textBaseline = "bottom";
  ctx.fillText("🙏 SENTIDO", mapX(R.x), mapY(R.y) - 15);
  ctx.font = "11px 'Inter', system-ui";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText("Sociedade da Fé", mapX(R.x), mapY(R.y) - 30);

  // Plot background points (all respondents)
  if (Array.isArray(points) && points.length > 0) {
    for (const p of points) {
      const px = mapX(p.x);
      const py = mapY(p.y);
      ctx.fillStyle = "rgba(99, 102, 241, 0.25)";
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Plot main user point with enhanced visibility
  if (point) {
    const px = mapX(point.x);
    const py = mapY(point.y);

    // Outer glow rings
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 25, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
    ctx.beginPath();
    ctx.arc(px, py, 18, 0, Math.PI * 2);
    ctx.stroke();

    // Crosshair lines
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    
    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(px - 35, py);
    ctx.lineTo(px - 12, py);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px + 12, py);
    ctx.lineTo(px + 35, py);
    ctx.stroke();
    
    // Vertical line
    ctx.beginPath();
    ctx.moveTo(px, py - 35);
    ctx.lineTo(px, py - 12);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px, py + 12);
    ctx.lineTo(px, py + 35);
    ctx.stroke();
    
    ctx.setLineDash([]);

    // Main point with glow
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 20;
    
    // Outer ring
    ctx.fillStyle = 'rgba(16, 185, 129, 0.3)';
    ctx.beginPath();
    ctx.arc(px, py, 12, 0, Math.PI * 2);
    ctx.fill();
    
    // Inner point
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(px, py, 8, 0, Math.PI * 2);
    ctx.fill();
    
    // Center white dot
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();

    // Label with background
    ctx.font = "bold 13px 'Inter', system-ui";
    const labelText = label;
    const labelWidth = ctx.measureText(labelText).width + 16;
    const labelHeight = 24;
    const labelX = px + 20;
    const labelY = py - labelHeight / 2;
    
    // Label background
    ctx.fillStyle = 'rgba(16, 185, 129, 0.9)';
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 10;
    roundRect(ctx, labelX, labelY, labelWidth, labelHeight, 6);
    ctx.fill();
    
    ctx.shadowBlur = 0;
    
    // Label text
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(labelText, labelX + 8, py);
    
    // Draw percentage indicators if weights provided
    if (weights) {
      const { w_M, w_C, w_R } = weights;
      ctx.font = "bold 11px 'Inter', system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      
      // Draw percentage near each vertex
      const pctM = (w_M * 100).toFixed(0) + '%';
      const pctC = (w_C * 100).toFixed(0) + '%';
      const pctR = (w_R * 100).toFixed(0) + '%';
      
      // Position percentages along the lines from point to vertices
      const drawPct = (vx, vy, pct, color) => {
        const midX = px + (mapX(vx) - px) * 0.4;
        const midY = py + (mapY(vy) - py) * 0.4;
        
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        roundRect(ctx, midX - 18, midY - 10, 36, 20, 4);
        ctx.fill();
        
        ctx.fillStyle = color;
        ctx.fillText(pct, midX, midY);
      };
      
      drawPct(M.x, M.y, pctM, '#ef4444');
      drawPct(C.x, C.y, pctC, '#eab308');
      drawPct(R.x, R.y, pctR, '#8b5cf6');
    }
  }
}

// Helper function for rounded rectangles
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
