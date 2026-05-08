const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  listTickets,
  createTicket,
  getTicket,
  sendTicketMessage,
  updateTicketManagement,
} = require('../controllers/supportController');

router.use(authMiddleware);

router.get('/tickets', listTickets);
router.post('/tickets', createTicket);
router.get('/tickets/:id', getTicket);
router.post('/tickets/:id/messages', sendTicketMessage);
router.put('/tickets/:id', updateTicketManagement);

module.exports = router;
