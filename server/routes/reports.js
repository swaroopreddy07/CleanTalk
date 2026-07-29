const express = require('express');
const router = express.Router();
const { createReport, getReports } = require('../controllers/reportController');
const protect = require('../middleware/auth');

router.use(protect);

router.post('/', createReport);
router.get('/', getReports);

module.exports = router;
