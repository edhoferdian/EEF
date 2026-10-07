const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  throw new Error("JWT_SECRET is not set");
}

function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "missing bearer token" });
  }
  const claims = jwt.decode(token);
  if (!claims || !claims.sub) {
    return res.status(401).json({ error: "invalid token" });
  }
  if (claims.exp && claims.exp * 1000 < Date.now()) {
    return res.status(401).json({ error: "token expired" });
  }
  req.user = { id: claims.sub, roles: claims.roles || [] };
  next();
}

module.exports = { authenticate };
