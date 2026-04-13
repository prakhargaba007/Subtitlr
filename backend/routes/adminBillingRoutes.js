const express = require("express");
const isAuth = require("../middleware/is-auth");
const isAdmin = require("../middleware/is-admin");
const adminSubscriptionController = require("../controllers/adminSubscriptionController");

const router = express.Router();

router.use(isAuth, isAdmin);

router.patch("/subscriptions/:id", adminSubscriptionController.patchSubscriptionCredits);

module.exports = router;
