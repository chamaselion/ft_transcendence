const { randomUUID } = require("node:crypto");
const { pipeline } = require("node:stream/promises");
const sharp = require("sharp");
const sequelize = require("../../db");
const defaultStorage = require("../../services/userIconService");

const { iconKey, avatarUrl, isMissingIcon } = defaultStorage;

// Normalize the uploaded image to a 256x256 WebP image, 
// preserving aspect ratio and cropping if necessary. Rejects animated images and images larger than 16 million pixels.
// Also rejects unsupported formats (only JPEG, PNG, and WebP are allowed).
const normalizeIcon = async (buffer) => {
  try {
    const image = sharp(buffer, {
      limitInputPixels: 16_000_000,
      failOn: "warning",
    });
    const metadata = await image.metadata();
    if (
      !["jpeg", "png", "webp"].includes(metadata.format) ||
      (metadata.pages || 1) > 1
    ) {
      throw new Error("Unsupported image");
    }
    return await image
      .resize(256, 256, { fit: "cover", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    const error = new Error(
      "Upload a valid, non-animated JPEG, PNG or WebP image (maximum 16 million pixels)",
    );
    error.status = 400;
    throw error;
  }
};

const createUserIconController = ({
  db = sequelize,
  storage = defaultStorage,
} = {}) => {
  const reportError = (res, error) => {
    console.error("[ICONS]", error.message);
    if (res.headersSent || res.destroyed) return res.destroy();
    return res.status(error.status || 503).json({
      error: error.status
        ? error.message
        : "Icon storage is temporarily unavailable",
    });
  };

  const lockUser = async (userId, transaction) => {
    const user = await db.models.user.findByPk(userId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!user) {
      const error = new Error("Not authenticated");
      error.status = 401;
      throw error;
    }
  };

  const replaceIcon = async (req, res) => {
    if (!req.file)
      return res
        .status(400)
        .json({ error: "An image in the icon field is required" });
    try {
      const buffer = await normalizeIcon(req.file.buffer);
      // Lock the existing user row so account deletion cannot race an upload.
      const object = await db.transaction(async (transaction) => {
        await lockUser(req.user.id, transaction);
        return storage.uploadUserIcon(iconKey(req.user.id), buffer, 'image/webp');
      });
      return res.json({ avatarUrl: avatarUrl(object.ETag || randomUUID()) });
    } catch (error) {
      return reportError(res, error);
    }
  };

  const getIcon = async (req, res) => {
    try {
      const object = await storage.getUserIcon(iconKey(req.user.id));
      res.set({
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      });
      await pipeline(object.Body, res);
    } catch (error) {
      if (isMissingIcon(error)) {
        return res.status(404).json({ error: "Icon not found" });
      }
      return reportError(res, error);
    }
  };

  const deleteIcon = async (req, res) => {
    try {
      await db.transaction(async (transaction) => {
        await lockUser(req.user.id, transaction);
        await storage.deleteUserIcon(iconKey(req.user.id));
      });
      return res.status(204).send();
    } catch (error) {
      return reportError(res, error);
    }
  };

  return { replaceIcon, getIcon, deleteIcon };
};

module.exports = { createUserIconController, normalizeIcon };
