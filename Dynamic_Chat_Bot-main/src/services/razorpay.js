const axios = require('axios');

const apiEndpoint = 'https://api.razorpay.com/v1/payment_links';
const apiKey = process.env.RAZORPAY_KEY_ID;
const apiSecret = process.env.RAZORPAY_KEY_SECRET;

const auth = {
    username: apiKey,
    password: apiSecret,
};

const instance = axios.create({
    baseURL: apiEndpoint,
    auth,
});

module.exports = instance;