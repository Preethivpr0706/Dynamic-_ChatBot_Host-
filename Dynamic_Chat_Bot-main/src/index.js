const express = require("express");
const winston = require("winston");

const userView = require("./controllers/userView");
const pocView = require("./controllers/pocView");
const { getClientID, getPocDetails } = require("./controllers/dbController");

const pool = require("./config/db"); // Import connection pool
const { parseWebhookData, logMessageDetails } = require("./utils/utils");
const logger = require("./config/Logger");

const webhookRouter = require("./services/webhook");

const path = require("path");
const dotenv = require("dotenv");

// Explicitly set the path to the .env file in the project root
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();
const port = process.env.PORT || 9000;

app.use(express.json());

app.get("/", (req, res) => {
    logger.info("GET / endpoint hit - Server is running!");
    res.send("Server is running! Welcome to the Meister Solutions.");
});

app.get("/webhook", (req, res) => {
    const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "your_verify_token";
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
        logger.info("Webhook verified successfully.");
        res.status(200).send(challenge);
    } else {
        logger.warn("Webhook verification failed.");
        res.sendStatus(403);
    }
});

app.post("/webhook", async(req, res) => {
    console.log("Incoming webhook payload" + JSON.stringify(req.body));
    //logger.info("Incoming webhook payload:", JSON.stringify(req.body, null, 2));

    if (!req.body || Object.keys(req.body).length === 0) {
        logger.error("Empty webhook payload received.");
        return res.status(204).send();
    }

    try {
        const webhookData = await parseWebhookData(req.body);
        // logger.info("Parsed webhook data:", webhookData);

        if (!webhookData) {
            // logger.warn("Failed to parse webhook data.");
            return res.status(204).send();
        }

        const { from, messageBody, messageType, displayPhoneNumber, phoneNumberId } = webhookData;

        if (!from || !messageBody || !messageType || !displayPhoneNumber) {
            logger.warn("Missing required fields in webhook data.");
            return res.status(204).send();
        }

        logger.info("Message details:", { from, messageBody, messageType, displayPhoneNumber });

        process.env.PHONE_NUMBER_ID = phoneNumberId;

        const clientId = await getClientID(displayPhoneNumber, from);
        logger.info("Fetched client ID:", clientId);

        const pocDetails = await getPocDetails(clientId, from);
        logger.info("Fetched POC details:", pocDetails);

        if (pocDetails) {
            pocView.handlePocView(req, res, webhookData);
        } else {
            userView.handleUserView(req, res, webhookData);
        }
    } catch (error) {
        logger.error(`Error processing webhook: ${error.message}`);
        res.status(500).send("Internal Server Error");
    }
});

app.use("/api", webhookRouter);

app.listen(port, () => {
    logger.info(`Server is running on http://localhost:${port}`);
});