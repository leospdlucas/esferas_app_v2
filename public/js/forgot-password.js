import { apiFetch } from "./auth.js";

let userEmail = '';
let verifiedCode = '';

function setMsg(id, text, isError = false) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = text || "";
    el.className = isError ? "scale-legend msg-error" : "scale-legend msg-success";
  }
}

function showStep(stepId) {
  ['step-email', 'step-code', 'step-password', 'step-success'].forEach(id => {
    document.getElementById(id).style.display = id === stepId ? 'block' : 'none';
  });
}

// Code input auto-focus logic
function setupCodeInputs() {
  const inputs = document.querySelectorAll('.code-digit');
  
  inputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      const value = e.target.value;
      
      // Only allow numbers
      if (!/^\d*$/.test(value)) {
        e.target.value = '';
        return;
      }
      
      // Move to next input
      if (value && index < inputs.length - 1) {
        inputs[index + 1].focus();
      }
    });
    
    input.addEventListener('keydown', (e) => {
      // Move to previous input on backspace
      if (e.key === 'Backspace' && !e.target.value && index > 0) {
        inputs[index - 1].focus();
      }
    });
    
    // Handle paste
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
      
      pastedData.split('').forEach((char, i) => {
        if (inputs[i]) {
          inputs[i].value = char;
        }
      });
      
      if (pastedData.length > 0) {
        inputs[Math.min(pastedData.length, inputs.length - 1)].focus();
      }
    });
  });
}

function getCodeFromInputs() {
  const inputs = document.querySelectorAll('.code-digit');
  return Array.from(inputs).map(input => input.value).join('');
}

function clearCodeInputs() {
  const inputs = document.querySelectorAll('.code-digit');
  inputs.forEach(input => input.value = '');
  inputs[0]?.focus();
}

document.addEventListener("DOMContentLoaded", () => {
  setupCodeInputs();
  
  // Step 1: Submit email
  document.getElementById("email-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg("email-msg", "");
    
    const email = document.getElementById("reset-email").value.trim();
    const submitBtn = e.target.querySelector('button');
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span>Enviando...';
    
    try {
      await apiFetch("/api/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email })
      });
      
      userEmail = email;
      document.getElementById("sent-email").textContent = email;
      showStep('step-code');
      document.querySelector('.code-digit')?.focus();
      
    } catch (err) {
      setMsg("email-msg", err.message, true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enviar código';
    }
  });
  
  // Step 2: Verify code
  document.getElementById("code-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg("code-msg", "");
    
    const code = getCodeFromInputs();
    if (code.length !== 6) {
      setMsg("code-msg", "Digite o código completo de 6 dígitos.", true);
      return;
    }
    
    const submitBtn = e.target.querySelector('button');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span>Verificando...';
    
    try {
      await apiFetch("/api/verify-reset-code", {
        method: "POST",
        body: JSON.stringify({ email: userEmail, code })
      });
      
      verifiedCode = code;
      showStep('step-password');
      document.getElementById("new-password")?.focus();
      
    } catch (err) {
      setMsg("code-msg", err.message, true);
      clearCodeInputs();
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Verificar código';
    }
  });
  
  // Resend code
  document.getElementById("resend-code").addEventListener("click", async (e) => {
    e.preventDefault();
    setMsg("code-msg", "");
    
    try {
      await apiFetch("/api/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: userEmail })
      });
      
      setMsg("code-msg", "Novo código enviado!", false);
      clearCodeInputs();
      
    } catch (err) {
      setMsg("code-msg", err.message, true);
    }
  });
  
  // Step 3: Set new password
  document.getElementById("password-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg("password-msg", "");
    
    const newPassword = document.getElementById("new-password").value;
    const confirmPassword = document.getElementById("confirm-password").value;
    
    if (newPassword !== confirmPassword) {
      setMsg("password-msg", "As senhas não coincidem.", true);
      return;
    }
    
    const submitBtn = e.target.querySelector('button');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span>Alterando...';
    
    try {
      await apiFetch("/api/reset-password", {
        method: "POST",
        body: JSON.stringify({ 
          email: userEmail, 
          code: verifiedCode, 
          newPassword 
        })
      });
      
      showStep('step-success');
      
    } catch (err) {
      setMsg("password-msg", err.message, true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Alterar senha';
    }
  });
});
