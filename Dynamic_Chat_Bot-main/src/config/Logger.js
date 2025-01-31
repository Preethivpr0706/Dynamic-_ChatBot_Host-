const winston = require('winston');
const moment = require('moment-timezone'); // Import moment-timezone

// Configure Winston logger
const logger = winston.createLogger({
    level: 'debug', // Default logging level
    format: winston.format.combine(
        winston.format.timestamp({
            format: () => moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss') // IST format
        }),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} [${level.toUpperCase()}]: ${message}`;
        }) // Custom format
    ),
    transports: [
        new winston.transports.File({ filename: 'app.log' }) // Log to file
    ],
});

module.exports = logger;