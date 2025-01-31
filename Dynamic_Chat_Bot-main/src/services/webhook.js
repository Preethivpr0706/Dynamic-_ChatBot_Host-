const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const path = require('path');
const dotenv = require('dotenv');

// Explicitly set the path to the .env file in the project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });


const db = require('../config/db');
const { sendWhatsAppMessage } = require('../utils/utils');



router.post('/razorpay/webhook', async(req, res) => {
    const webhookData = req.body;
    const eventType = webhookData.event;
    console.log(`Received webhook event: ${eventType}`);

    const notes = webhookData.payload.payment.entity.notes || {}; // Metadata
    const fromNumber = notes.from;

    const paymentId = webhookData.payload.payment.entity.id;
    console.log(paymentId);
    // console.log(webhookData);
    console.log(webhookData.payload);



    // Verify the webhook signature  
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const generatedSignature = crypto.createHmac('sha256', webhookSecret).update(JSON.stringify(webhookData)).digest('hex');
    if (generatedSignature !== req.header('X-Razorpay-Signature')) {
        console.log('Invalid webhook signature');
        return res.status(400).send('Invalid webhook signature');
    }

    switch (eventType) {
        case 'payment_link.paid':
            if (webhookData.payload && webhookData.payload.payment_link.entity) {
                const paymentLinkId = webhookData.payload.payment_link.entity.id;
                await updatePaymentId(paymentLinkId, { payment_id: paymentId });
                console.log(paymentLinkId);
            } else {
                console.error('Payload data not found');
            }
            console.log('Payment successful');
            await updateTransaction(paymentId, { status: 'paid' });
            console.log('From number: ' + fromNumber);
            await sendWhatsAppMessage(fromNumber, 'Payment received successfully');
            break;
        case 'payment_link.cancelled':
            console.log('Payment cancelled');
            await updateTransaction(paymentId, { status: 'cancelled' });
            await sendWhatsAppMessage(fromNumber, 'Payment cancelled!');
            break;
        default:
            console.log(`Unknown event type: ${eventType}`);
    }

    res.send('Webhook received!');
});

// Update transaction status using the transaction ID  
async function updatePaymentId(transactionId, data) {
    try {
        const connection = db.getConnection();
        const query = `UPDATE transactions SET ? WHERE transaction_id = ?`;
        const values = [data, transactionId];
        console.log(values);
        await connection.promise().query(query, values);
    } catch (error) {
        console.error(`Error updating transaction: ${error}`);
    }
}
async function updateTransaction(paymentId, data) {
    try {
        const connection = db.getConnection();
        const query = `UPDATE transactions SET ? WHERE payment_id = ?`;
        const values = [data, paymentId];
        console.log(values);
        await connection.promise().query(query, values);
    } catch (error) {
        console.error(`Error updating transaction: ${error}`);
    }
}





module.exports = router;