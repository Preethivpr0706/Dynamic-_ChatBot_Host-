const mysql = require("mysql2");
const logger = require("./Logger");
const path = require("path");
const dotenv = require("dotenv");

// Explicitly set the path to the .env file in the project root
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Create a MySQL connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10, // Maximum number of connections
    queueLimit: 0
});

// Log successful connection
pool.getConnection((err, connection) => {
    if (err) {
        logger.error("Error connecting to MySQL:", err);
    } else {
        logger.info("Connected to MySQL database.");
        connection.release(); // Release the initial test connection
    }
});

// Export the connection pool
module.exports = pool;