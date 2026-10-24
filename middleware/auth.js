function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ message: "Please log in to continue." });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ message: "Please log in to continue." });
  }
  if (req.session.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access is required." });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
