const express = require('express');
const multer = require('multer');
const { createEvent, getAllUserEvents } = require('../controller/event.controller');

const upload = multer();
const router = express.Router();
router.post('/event', upload.none(), createEvent);
router.get('/event/attended/:userId', upload.none(), getAllUserEvents)
module.exports = router;