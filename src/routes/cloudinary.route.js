import express from 'express';
import multer from 'multer';
import { uploadImagePicController } from './controller/cloudinary.controller.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
router.post('/upload', upload.single('image'), uploadImagePicController);
export default router;