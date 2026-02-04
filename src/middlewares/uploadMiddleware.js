const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'lights_inventory', // Folder name in your Cloudinary console
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
    transformation: [{ width: 500, height: 500, crop: 'limit' }], // Optimize size
  },
});

const upload = multer({ storage });

module.exports = upload;