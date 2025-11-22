const express = require('express');
const router = express.Router();
const mailController = require('../controllers/mailController');
const { authenticate } = require('../middleware/auth');

const {
  getInboxMails,
  getUnreadMails,
  getStarredMails,
  getArchivedMails,
  getSentMails,
  getMailById,
  sendMail,
  updateMail,
  deleteMail,
  getSentEmails
} = mailController();

// All routes require authentication
router.use(authenticate);

// Mail routes - specific endpoints for each filter
router.get('/inbox', getInboxMails);
router.get('/unread', getUnreadMails);
router.get('/starred', getStarredMails);
router.get('/archived', getArchivedMails);
router.get('/sent', getSentMails);
router.get('/:mailId', getMailById);
router.post('/', sendMail); // sendMail uses req.body for params
router.put('/:mailId', updateMail);
router.delete('/:mailId', deleteMail);
// list of sent emails
router.get('/sent-emails', getSentEmails);

module.exports = router;

