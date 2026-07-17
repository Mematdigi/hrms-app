const multer = require("multer");
const multerS3 = require("multer-s3");
const s3 = require("../s3");

const bucketName = process.env.S3_BUCKET_NAME || "excelupload-bucket";

if(!bucketName){
	throw new Error("S3_BUCKET_NAME environment variable is not defined");
}

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: bucketName,
    acl: "public-read", // optional: public access for images
    key: function (req, file, cb) {
      // e.g., "uploads/filename-timestamp.jpg"
      const fileName = `uploads/${Date.now()}-${file.originalname}`;
      cb(null, fileName);
    }
  }),
});

module.exports = upload;
