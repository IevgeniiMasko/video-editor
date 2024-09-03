const DB = require('../DB');
const path = require('path');

const authenticate = (req, res, next) => {
  if (req.headers.cookie) {
    const token = req.headers.cookie.split('=')[1];

    DB.update();
    const session = DB.sessions.find((session) => session.token === token);
    if (session) {
      req.userId = session.userId;
      return next();
    }
  }

  return res.status(401).json({ error: 'Unauthorized' });
};

const serverIndex = (req, res, next) => {
  const routes = ['/', '/login', '/profile'];

  if (routes.indexOf(req.url) !== -1 && req.method === 'GET') {
    return res
      .status(200)
      .sendFile(path.join(__dirname, '../../public/index.html'), 'text/html');
  } else {
    next();
  }
};

const middleware = {
  authenticate,
  serverIndex,
};

module.exports = middleware;
