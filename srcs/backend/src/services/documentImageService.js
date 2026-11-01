const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');

const { requireEnv } = require('../config');

// Resolve configuration lazily so missing object storage does not break routes
// that never touch images.
let s3;
const getClient = () =>
  s3 ||
  (s3 = new S3Client({
    endpoint: requireEnv('S3_ENDPOINT'),
    region: requireEnv('S3_REGION'),
    forcePathStyle: true,
    credentials: {
      accessKeyId: requireEnv('S3_ACCESS_KEY'),
      secretAccessKey: requireEnv('S3_SECRET_KEY'),
    },
  }));

const documentImageKey = (documentId, imageId) =>
  `documents/${documentId}/${imageId}.webp`;

const documentImageUrl = (documentId, imageId) =>
  `/api/documents/${documentId}/images/${imageId}`;

function uploadDocumentImage(key, fileBuffer) {
  return getClient().send(
    new PutObjectCommand({
      Bucket: requireEnv('S3_BUCKET'),
      Key: key,
      Body: fileBuffer,
      ContentType: 'image/webp',
    }),
  );
}

function getDocumentImage(key) {
  return getClient().send(
    new GetObjectCommand({
      Bucket: requireEnv('S3_BUCKET'),
      Key: key,
    }),
  );
}

function deleteDocumentImage(key) {
  return getClient().send(
    new DeleteObjectCommand({
      Bucket: requireEnv('S3_BUCKET'),
      Key: key,
    }),
  );
}

const isMissingDocumentImage = (error) =>
  error.name === 'NoSuchKey' || error.name === 'NotFound';

module.exports = {
  documentImageKey,
  documentImageUrl,
  uploadDocumentImage,
  getDocumentImage,
  deleteDocumentImage,
  isMissingDocumentImage,
};
