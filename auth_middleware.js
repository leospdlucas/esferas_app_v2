import jwt from "jsonwebtoken";

export function authRequired(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Não autenticado." });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, role, name, email }
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido ou expirado." });
  }
}

export function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Acesso restrito ao administrador." });
  }
  next();
}