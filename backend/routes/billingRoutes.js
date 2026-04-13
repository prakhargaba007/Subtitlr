const express = require("express");
const isAuth = require("../middleware/is-auth");
const billingController = require("../controllers/billingController");

const router = express.Router();

router.get("/subscription", isAuth, billingController.getMySubscription);
router.post("/dodo/checkout-session", isAuth, billingController.createDodoCheckoutSession);

module.exports = router;
