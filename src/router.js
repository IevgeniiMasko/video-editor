const User = require('./controllers/user');
const Video = require('./controllers/video');
const { authenticate } = require('./middleware');

module.exports = (server) => {
  // ------------------------------------------------ //
  // ************ USER ROUTES ************* //
  // ------------------------------------------------ //

  server.post('/api/login', User.logUserIn);

  server.use(authenticate);
  server.delete('/api/logout', User.logUserOut);
  server.get('/api/user', User.sendUserInfo);
  server.put('/api/user', User.updateUser);

  // ------------------------------------------------ //
  // ************ VIDEO ROUTES ************* //
  // ------------------------------------------------ //

  server.get('/api/videos', Video.getVideos);
  server.post('/api/upload-video', Video.uploadVideo);
  server.patch('/api/video/extract-audio', Video.extractAudio);
  server.put('/api/video/resize', Video.resizeVideo);
  server.get('/get-video-asset', Video.getVideoAsset);
};
