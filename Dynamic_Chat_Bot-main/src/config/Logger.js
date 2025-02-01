const winston = require('winston');
const moment = require('moment-timezone'); // Import moment-timezone
const path = require('path');

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
        new winston.transports.File({
            filename: path.resolve(__dirname, '../../logs/app.log') // Correct log file path
        }) // Log to file
    ],
});

module.exports = logger;