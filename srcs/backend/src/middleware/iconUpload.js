const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
}).single('icon');

const iconUpload = (req, res, next) => {
  upload(req, res, (error) => {
    if (!error) return next();
    const tooLarge = error.code === 'LIMIT_FILE_SIZE';
    return res.status(tooLarge ? 413 : 400).json({
      error: tooLarge ? 'Icon must be at most 2 MiB' : 'Upload exactly one image in the icon field',
    });
  });
};

module.exports = { iconUpload };
