const { randomUUID } = require('node:crypto');
const { pipeline } = require('node:stream/promises');
const sharp = require('sharp');
const { validateUuid } = require('../auth/validation');
const { resolvePermission, atLeast } = require('./permissions');
const { resolveModels, readId } = require('./helpers');
const defaultStorage = require('../../services/documentImageService');

const MAX_IMAGE_PIXELS = 16_000_000;
const MAX_IMAGE_EDGE = 1600;

const normalizeImage = async (buffer) => {
  try {
    const image = sharp(buffer, {
      limitInputPixels: MAX_IMAGE_PIXELS,
      failOn: 'warning',
    });
    const metadata = await image.metadata();
    if (
      !['jpeg', 'png', 'webp'].includes(metadata.format) ||
      (metadata.pages || 1) > 1
    ) {
      throw new Error('Unsupported image');
    }
    return await image
      .rotate()
      .resize(MAX_IMAGE_EDGE, MAX_IMAGE_EDGE, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    const error = new Error(
      'Upload a valid, non-animated JPEG, PNG or WebP image (maximum 16 million pixels)',
    );
    error.status = 400;
    throw error;
  }
};

const createDocumentImageController = ({
  storage = defaultStorage,
  documentModel,
  shareModel,
} = {}) => {
  const models = resolveModels({ documentModel, shareModel });

  const reportError = (res, error) => {
    console.error('[DOCUMENT IMAGES]', error.message);
    if (res.headersSent || res.destroyed) return res.destroy();
    return res.status(error.status || 503).json({
      error: error.status ? error.message : 'Image storage is temporarily unavailable',
    });
  };

  const uploadImage = async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'An image in the image field is required' });
    }

    try {
      const documentId = readId(req, res);
      if (!documentId) return undefined;

      const { document, permission } = await resolvePermission(req.user, documentId, {
        documentModel: models.documents(),
        shareModel: models.shares(),
      });
      if (!document || !atLeast(permission, 'editor')) {
        return res.status(404).json({ error: 'Document not found' });
      }

      const buffer = await normalizeImage(req.file.buffer);
      const imageId = randomUUID();
      const key = storage.documentImageKey(document.id, imageId);
      await storage.uploadDocumentImage(key, buffer);

      return res.status(201).json({
        image: {
          id: imageId,
          url: storage.documentImageUrl(document.id, imageId),
        },
      });
    } catch (error) {
      return reportError(res, error);
    }
  };

  const getImage = async (req, res) => {
    try {
      const documentId = readId(req, res);
      if (!documentId) return undefined;

      const imageCheck = validateUuid(req.params.imageId, 'image id');
      if (!imageCheck.ok) {
        return res.status(400).json({ error: imageCheck.error });
      }

      const { document, permission } = await resolvePermission(req.user, documentId, {
        documentModel: models.documents(),
        shareModel: models.shares(),
      });
      if (!document || !atLeast(permission, 'viewer')) {
        return res.status(404).json({ error: 'Image not found' });
      }

      const object = await storage.getDocumentImage(
        storage.documentImageKey(document.id, imageCheck.value),
      );
      res.set({
        'Content-Type': 'image/webp',
        'Cache-Control': 'private, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      });
      if (object.ETag) res.set('ETag', object.ETag);
      return await pipeline(object.Body, res);
    } catch (error) {
      if (storage.isMissingDocumentImage(error)) {
        return res.status(404).json({ error: 'Image not found' });
      }
      return reportError(res, error);
    }
  };

  return { uploadImage, getImage };
};

module.exports = { createDocumentImageController, normalizeImage };
