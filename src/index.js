const express = require('express');
const { serverIndex } = require('./middleware/index.js');
const apiRouter = require('./router.js');
const path = require('path');

const PORT = 8060;

const server = express();

server.use(express.static(path.join(__dirname, '../public')));

server.use(express.json());

// For different routes that need the index.html file
server.use(serverIndex);

apiRouter(server);

server.use((error, req, res, next) => {
  if (error && error.status) {
    res.status(error.status).json({ error: error.message });
  } else {
    console.error(error);
    res.status(500).json({
      error: 'Sorry, something unexpected happened from our side.',
    });
  }
});

server.listen(PORT, () => {
  console.log(`Server has started on port ${PORT}`);
});
