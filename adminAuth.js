// The admin password is always 24434. It can be overridden with the
// ADMIN_TOKEN environment variable, but defaults to 24434 so the admin
// login always works out of the box.
const DEFAULT_ADMIN_TOKEN = '24434';

function requireAdmin(req, res, next) {
  const configuredToken = process.env.ADMIN_TOKEN || DEFAULT_ADMIN_TOKEN;
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.get('x-admin-token');
  if (!token || token !== configuredToken) {
    return res.status(401).json({ success: false, message: 'Unauthorized admin access' });
  }
  next();
}

module.exports = { requireAdmin };
