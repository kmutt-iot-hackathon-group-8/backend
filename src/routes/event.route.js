const express = require('express');
const multer = require('multer');
const { createEvent } = require('../controller/event.controller');

const upload = multer();
const router = express.Router();
router.post('/event', upload.none(), createEvent);

module.exports = router;