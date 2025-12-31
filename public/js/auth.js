const TOKEN_KEY = "dte_token";

export function setToken(token) {
  // Usa sessionStorage para que o token seja limpo ao fechar o navegador
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = options.headers ? { ...options.headers } : {};
  if (!headers["Content-Type"] && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(path, { ...options, headers });
  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = (data && data.error) ? data.error : `Erro HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export async function requireAuth({ adminOnly = false } = {}) {
  try {
    const me = await apiFetch("/api/me");
    if (adminOnly && me.role !== "admin") {
      window.location.href = "/result.html";
      return null;
    }
    return me;
  } catch {
    window.location.href = "/";
    return null;
  }
}