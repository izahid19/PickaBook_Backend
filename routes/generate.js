const express = require('express');
const multer = require('multer');
const authMiddleware = require('../middleware/auth');
const { generateImage } = require('../controllers/generateController');

const router = express.Router();

// Multer setup for file uploads
const upload = multer({ dest: 'uploads/' });

// Generate image route (requires auth + credits)
router.post('/', authMiddleware, upload.single('image'), generateImage);

module.exports = router;
