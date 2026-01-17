const express = require('express');
const multer = require('multer');
const { createEvent, getAllUserEvents, updateEvent, deleteEvent, getEventById } = require('../controller/event.controller');

const upload = multer();
const router = express.Router();
router.post('/event', upload.none(), createEvent);
router.put('/event/:eventId', upload.none(), updateEvent);
router.delete('/event/:eventid', upload.none(), deleteEvent);
router.get('/event/:eventId', upload.none(), getEventById);
router.get('/event/attended/:userId', upload.none(), getAllUserEvents);
module.exports = router;