const DB = require('../DB');

const logUserIn = (req, res, next) => {
  const username = req.body.username;
  const password = req.body.password;

  DB.update();
  const user = DB.users.find((user) => user.username === username);

  if (user && user.password === password) {
    const token = Math.floor(Math.random() * 10000000000).toString();

    DB.sessions.push({ userId: user.id, token: token });
    DB.save();

    res.setHeader('Set-Cookie', `token=${token}; Path=/;`);
    res.status(200).json({ message: 'Logged in successfully!' });
  } else {
    return res.status(401).json({ message: 'Invalid username or password.' });
  }
};

const logUserOut = (req, res) => {
  DB.update();
  const sessionIndex = DB.sessions.findIndex(
    (session) => session.userId === req.userId,
  );

  if (sessionIndex > -1) {
    DB.sessions.splice(sessionIndex, 1);
    DB.save();
  }
  res.setHeader(
    'Set-Cookie',
    `token=deleted; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
  );
  res.status(200).json({ message: 'Logged out successfully!' });
};

const sendUserInfo = (req, res) => {
  DB.update();
  const user = DB.users.find((user) => user.id === req.userId);
  res.json({ username: user.username, name: user.name });
};

const updateUser = (req, res) => {
  const username = req.body.username;
  const name = req.body.name;
  const password = req.body.password;

  DB.update();
  const user = DB.users.find((user) => user.id === req.userId);

  user.username = username;
  user.name = name;

  if (password) {
    user.password = password;
  }

  DB.save();

  res.status(200).json({
    username: user.username,
    name: user.name,
    password_status: password ? 'updated' : 'not updated',
  });
};

const controller = {
  logUserIn,
  logUserOut,
  sendUserInfo,
  updateUser,
};

module.exports = controller;
