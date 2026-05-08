const express = require('express');
const router = express.Router();
const { previewCampaignPricing } = require('../controllers/campaignController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.post('/preview', authMiddleware, roleMiddleware('customer'), previewCampaignPricing);

module.exports = router;
