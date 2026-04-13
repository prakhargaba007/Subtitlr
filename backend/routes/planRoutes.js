const express = require("express");
const planCatalogController = require("../controllers/planCatalogController");

const router = express.Router();

router.get("/", planCatalogController.listPublicPlans);

module.exports = router;
