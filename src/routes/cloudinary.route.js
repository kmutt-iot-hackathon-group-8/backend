const express = require('express');
const multer = require('multer');
const { uploadImagePicController } = require('../controller/cloudinary.controller');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
router.post('/upload', upload.single('image'), uploadImagePicController);

module.exports = router;