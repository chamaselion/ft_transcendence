const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");

const { requireEnv } = require("../config");

// Resolve configuration lazily so a missing S3 setting does not break login.
let s3;
const getClient = () =>
  s3 ||
  (s3 = new S3Client({
    endpoint: requireEnv("S3_ENDPOINT"),
    region: requireEnv("S3_REGION"),
    forcePathStyle: true,
    credentials: {
      accessKeyId: requireEnv("S3_ACCESS_KEY"),
      secretAccessKey: requireEnv("S3_SECRET_KEY"),
    },
  }));

function uploadUserIcon(key, fileBuffer, contentType) {
  const command = new PutObjectCommand({
    Bucket: requireEnv("S3_BUCKET"),
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
  });
  return getClient().send(command);
}

function getUserIcon(key) {
  const command = new GetObjectCommand({
    Bucket: requireEnv("S3_BUCKET"),
    Key: key,
  });
  return getClient().send(command);
}

function deleteUserIcon(key) {
  const command = new DeleteObjectCommand({
    Bucket: requireEnv("S3_BUCKET"),
    Key: key,
  });
  return getClient().send(command);
}

const iconKey = (userId) => `${requireEnv("S3_BUCKET")}/${userId}.webp`;
const avatarUrl = (version) =>
  `/api/auth/me/icon?v=${encodeURIComponent(version)}`;
const isMissingIcon = (error) =>
  error.name === "NoSuchKey" || error.name === "NotFound";

function headUserIcon(key) {
  return getClient().send(
    new HeadObjectCommand({ Bucket: requireEnv("S3_BUCKET"), Key: key }),
  );
}

async function getUserIconUrl(userId) {
  try {
    const object = await headUserIcon(iconKey(userId));
    return avatarUrl(object.ETag || object.LastModified.toISOString());
  } catch (error) {
    if (isMissingIcon(error)) return null;
    throw error;
  }
}

module.exports = {
  uploadUserIcon,
  getUserIcon,
  deleteUserIcon,
  headUserIcon,
  iconKey,
  avatarUrl,
  isMissingIcon,
  getUserIconUrl,
};
