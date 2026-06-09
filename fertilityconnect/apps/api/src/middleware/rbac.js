// src/middleware/rbac.js
// Role-based access control
// Usage: router.get('/admin', auth, rbac('admin'), handler)
//        router.get('/leads', auth, rbac('hospital', 'admin'), handler)

const rbac = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}.`,
      });
    }

    next();
  };
};

module.exports = rbac;
