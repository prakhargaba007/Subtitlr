const express = require("express");
const dodoWebhookController = require("../controllers/dodoWebhookController");

const router = express.Router();

router.post("/", dodoWebhookController.handleDodoWebhook);

module.exports = router;
