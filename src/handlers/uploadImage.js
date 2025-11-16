const { S3Client } = require("@aws-sdk/client-s3");
const multer = require("multer");
const multerS3 = require("multer-s3");
const { DeleteObjectsCommand } = require("@aws-sdk/client-s3");

// const S3Client = require("@aws-sdk/client-s3");
// config();

const s3 = new S3Client({
  credentials: {
    secretAccessKey: process.env.AWS_KEY,
    accessKeyId: process.env.AWS_ID,
  },
  region: process.env.AWS_REGION,
});

const s3Storage = multerS3({
  s3: s3, // s3 instance
  bucket: process.env.AWS_S3_BUCKET_NAME, // change it as per your project requirement
  // acl: "public-read", // storage access type
  metadata: (req, file, cb) => {
    cb(null, { fieldname: file.fieldname });
  },
  key: (req, file, cb) => {
    let bucketName = req.baseUrl.split("/api/")[1];
    const fileName =
      `${bucketName == null ? "" : bucketName + "/"}` +
      Date.now() +
      "_" +
      file.originalname;
    cb(null, fileName);
  },
});

const uploadImage = multer({
  storage: s3Storage,
  fileFilter: (req, file, callback) => {
    if (req.body.image_updated && req.body.image_updated === "false")
      return callback(null, false);
    return callback(null, true);
  },
  limits: {
    fileSize: 1024 * 1024 * 100, // 100mb file size
  },
});

const deleteImage = async (url) =>
  new Promise(async (resolve, reject) => {
    let key = url.split(process.env.AWS_S3_BUCKET_URL)[1];
    const command = new DeleteObjectsCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Delete: {
        Objects: [
          {
            Key: key,
          },
        ],
      },
    });
    try {
      let response = await s3.send(command);
    } catch (e) {
      console.error(e);
    }
    resolve();
  });

module.exports = { s3, uploadImage, deleteImage };
