function authenticateToken(req, res, next) {
  // Bypass authentication: Inject a mock admin user context
  req.user = {
    UserID: 1,
    Username: 'admin',
    FullName: 'System Administrator',
    Role: 'ADMIN',
    IsPaid: true
  };
  next();
}

function requireRole(roles) {
  return (req, res, next) => {
    // Automatically allow access as the mocked user is an ADMIN
    next();
  };
}

// Restricted write access middleware: automatically allow writes since mocked user is an ADMIN
function restrictGuestWrite(req, res, next) {
  next();
}

module.exports = { authenticateToken, requireRole, restrictGuestWrite };

