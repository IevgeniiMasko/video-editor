const path = require('node:path');
const cluster = require('node:cluster');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const { pipeline } = require('node:stream/promises');
const util = require('../../lib/util');
const DB = require('../DB');
const FF = require('../../lib/FF');

let jobs;
if (cluster.isPrimary) {
  const JobQueue = require('../../lib/JobQueue');
  jobs = new JobQueue();
}

const getVideos = (req, res) => {
  DB.update();
  const videos = DB.videos.filter((video) => {
    return video.userId === req.userId;
  });

  res.status(200).json(videos);
};

const uploadVideo = async (req, res, next) => {
  const specifiedFileName = req.headers.filename;
  const extension = path.extname(specifiedFileName).substring(1).toLowerCase();
  const name = path.parse(specifiedFileName).name;
  const videoId = crypto.randomBytes(4).toString('hex');

  const FORMATS_SUPPORTED = ['mov', 'mp4'];

  if (FORMATS_SUPPORTED.indexOf(extension) == -1) {
    return res
      .status(400)
      .json({ message: 'Only these formats are allowed: mov, mp4' });
  }

  try {
    await fs.mkdir(`./storage/${videoId}`);
    const fullPath = `./storage/${videoId}/original.${extension}`; // the original video path
    const file = await fs.open(fullPath, 'w');
    const fileStream = file.createWriteStream();
    const thumbnailPath = `./storage/${videoId}/thumbnail.jpg`;

    await pipeline(req, fileStream);

    await FF.makeThumbnail(fullPath, thumbnailPath);
    const dimensions = await FF.getDimensions(fullPath);

    DB.update();
    DB.videos.unshift({
      id: DB.videos.length,
      videoId,
      name,
      extension,
      dimensions,
      userId: req.userId,
      extractedAudio: false,
      resizes: {},
    });
    DB.save();

    res.status(201).json({
      status: 'success',
      message: 'The file was uploaded successfully!',
    });
  } catch (e) {
    util.deleteFolder(`./storage/${videoId}`);
    if (e.code !== 'ECONNRESET') return next(e);
  }
};

const extractAudio = async (req, res, next) => {
  const videoId = req.query.videoId;

  DB.update();
  const video = DB.videos.find((video) => video.videoId === videoId);

  if (video.extractedAudio) {
    return res.status(400).json({
      status: 'success',
      message: 'The audio has already been extracted for this video.',
    });
  }

  try {
    const originalVideoPath = `./storage/${videoId}/original.${video.extension}`;
    const targetAudioPath = `./storage/${videoId}/audio.aac`;

    await FF.extractAudio(originalVideoPath, targetAudioPath);

    video.extractedAudio = true;
    DB.save();

    res.status(200).json({
      status: 'success',
      message: 'The audio was extracted successfully!',
    });
  } catch (e) {
    util.deleteFile(targetAudioPath);
    next(e);
  }
};

// Resize a video file (creates a new video file)
const resizeVideo = async (req, res) => {
  const videoId = req.body.videoId;
  const width = Number(req.body.width);
  const height = Number(req.body.height);

  DB.update();
  const video = DB.videos.find((video) => video.videoId === videoId);
  video.resizes[`${width}x${height}`] = { processing: true };
  DB.save();

  if (cluster.isPrimary) {
    jobs.enqueue({
      type: 'resize',
      videoId,
      width,
      height,
    });
  } else {
    process.send({
      messageType: 'new-resize',
      data: { videoId, width, height },
    });
  }

  res.status(200).json({
    status: 'success',
    message: 'The video is now being processed!',
  });
};

const getVideoAsset = async (req, res) => {
  const videoId = req.query.videoId;
  const type = req.query.type; // thumbnail, original, audio, resize

  DB.update();
  const video = DB.videos.find((video) => video.videoId === videoId);

  if (!video) {
    res.status(404).json({
      status: 'success',
      message: 'Video not found!',
    });
  }

  let file;
  let mimeType;
  let filename; // the final file name for the download (including the extension)

  switch (type) {
    case 'thumbnail':
      file = await fs.open(
        path.join(__dirname, `../../storage/${videoId}/thumbnail.jpg`),
        'r',
      );
      mimeType = 'image/jpeg';
      break;
    case 'audio':
      file = await fs.open(
        path.join(__dirname, `../../storage/${videoId}/audio.aac`),
        'r',
      );
      mimeType = 'audio/aac';
      filename = `${video.name}-audio.aac`;
      break;
    case 'resize':
      const dimensions = req.query.dimensions;
      file = await fs.open(
        path.join(
          __dirname,
          `../../storage/${videoId}/${dimensions}.${video.extension}`,
        ),
        'r',
      );
      mimeType = 'video/mp4'; // Not a good practice! Videos are not always MP4 - used for simplicity
      filename = `${video.name}-${dimensions}.${video.extension}`;
      break;
    case 'original':
      file = await fs.open(
        path.join(
          __dirname,
          `../../storage/${videoId}/original.${video.extension}`,
        ),
        'r',
      );
      mimeType = 'video/mp4'; // Not a good practice! Videos are not always MP4 - used for simplicity
      filename = `${video.name}.${video.extension}`;
      break;
  }

  try {
    const stat = await file.stat();

    const fileStream = file.createReadStream();

    if (type !== 'thumbnail') {
      // Set a header to prompt for download
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    }

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', stat.size);

    res.status(200);

    await pipeline(fileStream, res);
    file.close();
  } catch (e) {
    console.log(e);
  }
};

const controller = {
  getVideos,
  uploadVideo,
  extractAudio,
  resizeVideo,
  getVideoAsset,
};

module.exports = controller;
