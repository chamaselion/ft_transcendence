const multer = require('multer');

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 0, parts: 1 },
}).single('image');

const documentImageUpload = (req, res, next) => {
  upload(req, res, (error) => {
    if (!error) return next();
    const tooLarge = error.code === 'LIMIT_FILE_SIZE';
    return res.status(tooLarge ? 413 : 400).json({
      error: tooLarge
        ? 'Image must be at most 10 MiB'
        : 'Upload exactly one image in the image field',
    });
  });
};

module.exports = { documentImageUpload, MAX_IMAGE_BYTES };
