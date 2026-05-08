const express = require('express');
const router = express.Router();
const { getVendorStorefront } = require('../controllers/vendorController');
const {
  getVendorCampaigns,
  createVendorCampaign,
  updateVendorCampaign,
  toggleVendorCampaignStatus,
} = require('../controllers/vendorCampaignController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.get('/campaigns', authMiddleware, roleMiddleware('vendor'), getVendorCampaigns);
router.post('/campaigns', authMiddleware, roleMiddleware('vendor'), createVendorCampaign);
router.put('/campaigns/:id', authMiddleware, roleMiddleware('vendor'), updateVendorCampaign);
router.put('/campaigns/:id/toggle-status', authMiddleware, roleMiddleware('vendor'), toggleVendorCampaignStatus);
router.get('/:id', getVendorStorefront);

module.exports = router;
