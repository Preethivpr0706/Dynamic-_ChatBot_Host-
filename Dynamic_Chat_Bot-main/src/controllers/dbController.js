const pool = require("../config/db");
const { sendWhatsAppMessage } = require("../utils/utils");
const logger = require("../config/Logger");

function getClientID(displayPhoneNumber, from) {
    return new Promise((resolve, reject) => {
        const query = `SELECT Client_ID FROM Client WHERE Contact_Number = ?`;

        logger.info(`Fetching Client ID for displayPhoneNumber: "${displayPhoneNumber}"`);

        pool.execute(query, [displayPhoneNumber], async(err, results) => {
            if (err) {
                logger.error("Database query error:", err);
                return reject(err);
            }

            if (results.length > 0) {
                const clientId = results[0].Client_ID;
                return resolve(clientId);
            }

            logger.warn(`No client found for displayPhoneNumber: "${displayPhoneNumber}"`);

            try {
                await sendWhatsAppMessage(
                    from,
                    `There is no client with the phone number ${displayPhoneNumber}`
                );
                return resolve(null);
            } catch (messageError) {
                logger.error("Error sending WhatsApp message:", messageError);
                return resolve(null);
            }
        });
    });
}

function getWelcomeMessage(clientId) {
    return new Promise((resolve, reject) => {
        const query = `SELECT Value_name FROM List WHERE Client_ID = ? AND Key_name = "GREETINGS"`;

        logger.debug(`Executing query for Client_ID: ${clientId}`);

        pool.execute(query, [clientId], (err, results) => {
            if (err) {
                logger.error("Error running query:", err);
                return reject(err);
            }

            if (results.length === 0) {
                logger.warn(`No welcome message found for Client_ID: ${clientId}`);
                return resolve(null);
            }

            resolve(results[0].Value_name);
        });
    });
}

function getMainMenu(clientId, parentMenuID) {
    return new Promise((resolve, reject) => {
        const query = `   
            SELECT   
                Client_ID as CLIENT_ID,   
                Menu_ID as MENU_ID,   
                Menu_Name AS MENU_NAME,   
                Header_Message AS HEADER_MESSAGE,   
                Action as ACTION   
            FROM menu   
            WHERE Client_ID = ? AND Language = 'ENG' AND Parent_Menu_ID = ?   
            ORDER BY Display_Order;   
        `;

        logger.debug(`Executing query for Client_ID: ${clientId}, Parent_Menu_ID: ${parentMenuID}`);

        pool.execute(query, [clientId, parentMenuID], (err, rows) => {
            if (err) {
                logger.error("Error running query:", err);
                return reject(err);
            }

            logger.info(`Query executed successfully. ${rows.length} row(s) returned.`);
            rows.forEach((row, index) => {
                logger.debug(`Row ${index + 1}: ${JSON.stringify(row)}`);
            });

            resolve(rows);
        });
    });
}



function getFromList(iClientId, iMenuId, iKey, iLang) {
    return new Promise((resolve, reject) => {
        logger.info(
            `getFromList: iClientId:${iClientId} , iMenuId:${iMenuId} ,iKey:${iKey} , iLang:${iLang}`
        );
        const query = `SELECT   
             Client_ID as CLIENT_ID,   
             ? MENU_ID,   
             Item_ID as ITEM_ID,   
             Value_name as MENU_NAME   
           FROM LIST   
           WHERE  Client_ID= ?   
             AND Key_name = ?   
             AND Lang = ?   
           ORDER BY Display_order   
           LIMIT 10`;

        logger.debug(`Executing query for Client_ID: ${iClientId}, Menu_ID: ${iMenuId}, Key_name: ${iKey}, Lang: ${iLang}`);
        pool.execute(
            query, [iMenuId, iClientId, iKey, iLang],
            (err, results) => {
                if (err) {
                    logger.error("Error running query:", err);
                    return reject(err);
                }
                logger.info("Query results:", results);
                resolve(results);
            }
        );
    });
}

function getPocFromPoc(iClientId, iMenuId, iKey) {
    return new Promise((resolve, reject) => {
        logger.info(
            `getFromPOC: iClientId:${iClientId} , iMenuId:${iMenuId} ,iKey:${iKey}`
        );
        let query;
        let params;

        if (iKey === null) {
            query = `SELECT    
             Client_ID as CLIENT_ID,    
             ? MENU_ID,    
             POC_ID as ITEM_ID,    
             POC_Name as MENU_NAME    
           FROM POC    
           WHERE  Client_ID= ?    
             LIMIT 10`;
            params = [iMenuId, iClientId];
        } else {
            query = `SELECT    
             Client_ID as CLIENT_ID,    
             ? MENU_ID,    
             POC_ID as ITEM_ID,    
             POC_Name as MENU_NAME    
           FROM POC    
           WHERE  Client_ID= ?    
             AND Specialization = ?    
             LIMIT 10`;
            params = [iMenuId, iClientId, iKey];
        }

        logger.debug(`Executing query for Client_ID: ${iClientId}, Menu_ID: ${iMenuId}, Specialization: ${iKey}`);
        pool.execute(query, params, (err, results) => {
            if (err) {
                logger.error("Error running query:", err);
                return reject(err);
            }
            logger.info("Query results:", results);
            resolve(results);
        });
    });
}

function getPocDetails(ClientId, from) {
    return new Promise((resolve, reject) => {
        logger.info(`getFromPOC: from:${from}`);
        const query = `SELECT   
             POC_ID as POC_ID,   
             POC_Name as POC_NAME   
           FROM POC   
           WHERE  Client_ID= ?   
             AND Contact_Number = ?`;

        logger.debug(`Executing query for Client_ID: ${ClientId}, Contact_Number: ${from}`);
        pool.execute(query, [ClientId, from], (err, results) => {
            if (err) {
                logger.error("Error running query:", err);
                return reject(err);
            }
            logger.info("Query results:", results);
            resolve(results[0]);
        });
    });
}

const getAvailableDates = (clientId, menuId, pocIdOrAppointmentType, Appointment_ID) => {
    return new Promise((resolve, reject) => {
        // Check if pocIdOrAppointmentType is an appointment type    
        const query = `SELECT * FROM POC WHERE CLIENT_ID = ? AND Specialization = ?`;
        logger.debug(`Executing query for Client_ID: ${clientId}, Specialization: ${pocIdOrAppointmentType}`);

        pool.query(query, [clientId, pocIdOrAppointmentType], (err, results) => {
            if (err) {
                logger.error("Error fetching POC details:", err);
                return reject(err);
            }

            if (results.length > 0) {
                const pocId = results[0].POC_ID;
                // Update the POC ID in the Appointments table    
                updateAppointment("POC_ID", pocId, Appointment_ID);
                updateAppointmentJsonData(Appointment_ID, "Poc_ID", pocId);

                // Retrieve the available dates    
                const availableDatesQuery = `
                    SELECT DISTINCT    
                        ? AS CLIENT_ID,    
                        ? AS MENU_ID,    
                        CONCAT(POC_ID, '-', DATE_FORMAT(Schedule_Date, '%Y-%m-%d')) AS ITEM_ID,    
                        DATE_FORMAT(Schedule_Date, '%Y-%m-%d') AS MENU_NAME,    
                        Schedule_Date    
                    FROM poc_available_slots    
                    WHERE POC_ID = ?    
                        AND Schedule_Date >= CURDATE()    
                        AND appointments_per_slot > 0  
                        AND Active_Status = 'unblocked'  
                        AND EXISTS (    
                            SELECT 1    
                            FROM poc_available_slots AS slots    
                            WHERE slots.POC_ID = poc_available_slots.POC_ID    
                                AND slots.Schedule_Date = poc_available_slots.Schedule_Date    
                                AND (slots.Schedule_Date > CURDATE() OR (slots.Schedule_Date = CURDATE() AND slots.Start_Time >= CURTIME()))    
                        )    
                    ORDER BY Schedule_Date    
                    LIMIT 10    
                `;
                logger.debug(`Executing query for Client_ID: ${clientId}, Menu_ID: ${menuId}, POC_ID: ${pocId}`);

                pool.query(availableDatesQuery, [clientId, menuId, pocId], (err, availableDates) => {
                    if (err) {
                        logger.error("Error fetching available dates:", err);
                        return reject(err);
                    }

                    const formattedResults = availableDates.map(({ CLIENT_ID, MENU_ID, ITEM_ID, MENU_NAME }) => ({
                        CLIENT_ID,
                        MENU_ID,
                        ITEM_ID,
                        MENU_NAME,
                    }));
                    resolve(formattedResults);
                });
            } else {
                // If pocIdOrAppointmentType is not an appointment type, assume it's a POC ID    
                const availableDatesQuery = `
                    SELECT DISTINCT    
                        ? AS CLIENT_ID,    
                        ? AS MENU_ID,    
                        CONCAT(POC_ID, '-', DATE_FORMAT(Schedule_Date, '%Y-%m-%d')) AS ITEM_ID,    
                        DATE_FORMAT(Schedule_Date, '%Y-%m-%d') AS MENU_NAME,    
                        Schedule_Date    
                    FROM poc_available_slots    
                    WHERE POC_ID = ?    
                        AND Schedule_Date >= CURDATE()    
                        AND appointments_per_slot > 0   
                        AND Active_Status = 'unblocked' 
                        AND EXISTS (    
                            SELECT 1    
                            FROM poc_available_slots AS slots    
                            WHERE slots.POC_ID = poc_available_slots.POC_ID    
                                AND slots.Schedule_Date = poc_available_slots.Schedule_Date    
                                AND (slots.Schedule_Date > CURDATE() OR (slots.Schedule_Date = CURDATE() AND slots.Start_Time >= CURTIME()))    
                        )    
                    ORDER BY Schedule_Date    
                    LIMIT 10    
                `;
                logger.debug(`Executing query for Client_ID: ${clientId}, Menu_ID: ${menuId}, POC_ID: ${pocIdOrAppointmentType}`);

                pool.query(availableDatesQuery, [clientId, menuId, pocIdOrAppointmentType], (err, availableDates) => {
                    if (err) {
                        logger.error("Error fetching available dates:", err);
                        return reject(err);
                    }

                    const formattedResults = availableDates.map(({ CLIENT_ID, MENU_ID, ITEM_ID, MENU_NAME }) => ({
                        CLIENT_ID,
                        MENU_ID,
                        ITEM_ID,
                        MENU_NAME,
                    }));
                    resolve(formattedResults);
                });
            }
        });
    });
};


function getAvailableTimes(iClientId, iMenuId, iKey, iValue) {
    return new Promise((resolve, reject) => {
        logger.info(
            `getAvailableTimes: iClientId:${iClientId} ,iMenuId: ${iMenuId}, iKey: ${iKey}, iValue: ${iValue}`
        );
        const query = `   
        SELECT DISTINCT   
            ? AS CLIENT_ID,   
            ? AS MENU_ID,   
            CONCAT(POC_ID, '-', DATE_FORMAT(Schedule_Date, '%Y-%m-%d'), '-', Start_Time) AS ITEM_ID,   
            Start_Time AS MENU_NAME   
        FROM poc_available_slots   
        WHERE POC_ID = ?   
            AND Schedule_Date = STR_TO_DATE(?, '%Y-%m-%d')   
            AND appointments_per_slot > 0   
            AND Active_Status = 'unblocked'
            AND (Schedule_Date > CURDATE() OR (Schedule_Date = CURDATE() AND Start_Time >= CURTIME()))   
        ORDER BY Start_Time   
        LIMIT 10   
        `;

        logger.debug(`Executing query for Client_ID: ${iClientId}, Menu_ID: ${iMenuId}, POC_ID: ${iKey}, Schedule_Date: ${iValue}`);

        pool.execute(query, [iClientId, iMenuId, iKey, iValue], (err, results) => {
            if (err) {
                logger.error("Error fetching available times:", err);
                reject(err);
            } else {
                resolve(results); // Return only available times
            }
        });
    });
}

// Get user data by contact number   
function getUserData(userContact) {
    return new Promise((resolve, reject) => {
        const query = `SELECT * 
        FROM Users
        WHERE User_Contact = ?`;
        logger.debug(`Executing query for User_Contact: ${userContact}`);

        pool.execute(query, [userContact], (err, results) => {
            if (err) {
                logger.error("Error fetching user data:", err);
                reject(err);
            } else {
                // Check if results contain any rows, if not, resolve with null
                resolve(results.length > 0 ? results[0] : null);
            }
        });
    });
}
async function insertUserData(userContact, clientId) {
    const query = "INSERT IGNORE INTO Users (User_Contact, Client_ID) VALUES (?,?)";
    logger.debug(`Executing query for User_Contact: ${userContact}`);

    try {
        const [result] = await pool.execute(query, [userContact, clientId]);
        return result;
    } catch (err) {
        logger.error("Error inserting user data:", err);
        throw err;
    }
}
async function updateUserField(userContact, field, value) {
    const query = `UPDATE Users 
    SET ${field} = ? 
    WHERE User_Contact = ?`;
    logger.debug(`Executing query for User_Contact: ${userContact}, Field: ${field}`);

    try {
        const [result] = await pool.execute(query, [value, userContact]);
        return result;
    } catch (err) {
        logger.error("Error updating user field:", err);
        throw err;
    }
}


// Insert a new appointment into the Appointments table
async function insertAppointment(clientId, userId) {
    const query = `
        INSERT INTO Appointments (Client_ID, User_ID, POC_ID, Appointment_Date, Appointment_Time, Appointment_Type, Status, Is_Active, JSON_DATA)
        VALUES(?,?,?,?,?,?,?,?,?)
    `;
    logger.debug(`Executing query for Client_ID: ${clientId}, User_ID: ${userId}`);

    try {
        const [result] = await pool.promise().execute(query, [
            clientId,
            userId,
            null,
            null,
            null,
            null,
            "Pending",
            false,
            JSON.stringify({}),
        ]);
        return result.insertId;
    } catch (err) {
        logger.error("Error inserting appointment:", err);
        throw err;
    }
}

// Fetch appointment details using userId for cancel and reschedule
async function getAppointmentDetailsByUserID(userId) {
    const query = `
        SELECT 
            Appointment_Type,
            POC_ID,
            Appointment_ID,
            DATE_FORMAT(Appointment_Date, '%Y-%m-%d') as Appointment_Date,
            Appointment_Time
        FROM appointments
        WHERE User_ID = ? AND Appointment_Type <> "Emergency"
        AND Is_Active=1
        AND (Appointment_Date > CURDATE() OR (Appointment_Date = CURDATE() AND Appointment_Time >= CURTIME()))
    `;
    logger.debug(`Executing query for User_ID: ${userId}`);

    try {
        const [rows] = await pool.promise().execute(query, [userId]);
        logger.info(rows);
        return rows;
    } catch (err) {
        logger.error("Error fetching appointment details:", err);
        throw err;
    }
}

// Fetch appointment details using Appointment_ID
async function getAppointmentDetailsByAppointmentId(appointmentId) {
    const query = `
        SELECT 
            Appointment_Type,
            POC_ID,
            DATE_FORMAT(Appointment_Date, '%Y-%m-%d') as Appointment_Date,
            Appointment_Time,
            Payment_Status
        FROM appointments
        WHERE Appointment_ID = ?
    `;
    logger.debug(`Executing query for Appointment_ID: ${appointmentId}`);

    try {
        const [rows] = await pool.promise().execute(query, [appointmentId]);
        if (rows.length > 0) {
            logger.info(rows);
            return rows;
        } else {
            logger.error(`Error in fetching appointment ${appointmentId}`);
            throw new Error(`Error in fetching appointment`);
        }
    } catch (err) {
        logger.error("Error fetching appointment details:", err);
        throw err;
    }
}

// Fetch template message by clientId and templateName
async function getTemplateMessage(clientId, templateName) {
    const query = `
        SELECT TEMPLATE_TEXT
        FROM Templates
        WHERE CLIENT_ID = ? AND TEMPLATE_NAME = ?
    `;
    logger.debug(`Executing query for Client_ID: ${clientId}, Template_Name: ${templateName}`);

    try {
        const [rows] = await pool.promise().execute(query, [clientId, templateName]);
        if (rows.length > 0) {
            return rows[0].TEMPLATE_TEXT; // Return the template text
        } else {
            logger.error(`Template for ${templateName} not found for client ${clientId}`);
            throw new Error(`Template for ${templateName} not found for client ${clientId}`);
        }
    } catch (err) {
        logger.error("Error fetching template message:", err);
        throw err;
    }
}
// Get Meet Link for a given POC_ID
async function getMeetLink(pocId) {
    if (pocId === null || pocId === undefined) {
        return null; // Return null immediately if pocId is null or undefined   
    }
    const query = `SELECT Meet_Link FROM POC WHERE POC_ID = ?`;
    logger.debug(`Executing query for POC_ID: ${pocId}`);

    try {
        const [results] = await pool.promise().execute(query, [pocId]);
        return results.length > 0 ? results[0].Meet_Link : null;
    } catch (err) {
        logger.error("Error fetching Meet_Link:", err);
        throw err;
    }
}

// Update JSON data for an appointment
const updateAppointmentJsonData = async(appointmentId, key, value) => {
    const updateQuery = `
        UPDATE Appointments 
        SET JSON_DATA = JSON_SET(JSON_DATA, '$.${key}', ?) 
        WHERE Appointment_ID = ?
    `;
    logger.debug(`Executing query for Appointment_ID: ${appointmentId}, Key: ${key}`);

    try {
        await pool.promise().execute(updateQuery, [value, appointmentId]);
        logger.info("JSON data updated successfully");
    } catch (err) {
        logger.error("Error updating JSON data:", err);
        throw err;
    }
};

// Update an appointment's column value
const updateAppointment = async(column_name, value, appointmentId, iSelectId) => {
    const nonColumns = ["Department", "Confirm_Status", "Emergency_Reason", "Appointment_Function", "Finalize_Status"];

    if (nonColumns.includes(column_name)) {
        try {
            await updateAppointmentJsonData(appointmentId, column_name, value);
            logger.info("JSON data updated successfully");
        } catch (err) {
            logger.error("Error updating JSON data:", err);
            throw err;
        }
    } else if (column_name === "Poc_name") {
        const updateQuery = `
            UPDATE Appointments 
            SET POC_ID = ?, JSON_DATA = JSON_SET(JSON_DATA, '$.Poc_ID', ?), JSON_DATA = JSON_SET(JSON_DATA, '$.Poc_name', ?)
            WHERE Appointment_ID = ?
        `;
        logger.debug(`Executing query for Appointment_ID: ${appointmentId}, POC_ID: ${iSelectId}, Poc_name: ${value}`);

        try {
            await pool.promise().execute(updateQuery, [iSelectId, iSelectId, value, appointmentId]);
            logger.info("POC ID and JSON data updated successfully");
        } catch (err) {
            logger.error("Error updating POC ID and JSON data:", err);
            throw err;
        }
    } else {
        const updateQuery = `
            UPDATE Appointments 
            SET ${column_name} = ?, JSON_DATA = JSON_SET(JSON_DATA, '$.${column_name}', ?) 
            WHERE Appointment_ID = ? AND Status <> "Rescheduled"
        `;
        logger.debug(`Executing query for Appointment_ID: ${appointmentId}, Column: ${column_name}, Value: ${value}`);

        try {
            await pool.promise().execute(updateQuery, [value, value, appointmentId]);
            logger.info("Appointment updated successfully");
        } catch (err) {
            logger.error("Error updating appointment:", err);
            throw err;
        }
    }
};

// Get a specific value from the JSON data of an appointment
const getAppointmentJsonDataByKey = async(appointmentId, key) => {
    const query = `
        SELECT JSON_EXTRACT(JSON_DATA, '$.${key}') AS value    
        FROM Appointments    
        WHERE Appointment_ID = ?
    `;
    logger.debug(`Executing query for Appointment_ID: ${appointmentId}, Key: ${key}`);

    try {
        const [results] = await pool.promise().execute(query, [appointmentId]);
        const value = results[0].value;
        return value;
    } catch (err) {
        logger.error("Error retrieving JSON data:", err);
        throw err;
    }
};
// Get JSON data for a specific appointment
const getAppointmentJsonData = async(appointmentId) => {
    const query = `
        SELECT JSON_DATA    
        FROM Appointments    
        WHERE Appointment_ID = ?    
    `;
    logger.debug(`Executing query for Appointment_ID: ${appointmentId}`);

    try {
        const [results] = await pool.promise().execute(query, [appointmentId]);
        if (results.length === 0) {
            logger.warn(`No data found for Appointment_ID: ${appointmentId}`);
            return null;
        }
        return results[0]; // Return the JSON data
    } catch (err) {
        logger.error("Error retrieving JSON data:", err);
        throw err;
    }
};

// Update available slots after appointment booking
const updateAvailableSlots = async(jsonData) => {
    logger.info(`updateAvailableSlots: ${JSON.stringify(jsonData["JSON_DATA"], null, 2)}`);

    if (!jsonData) {
        logger.info("No appointment found");
        return;
    }

    const query = `
        UPDATE POC_Available_Slots    
        SET appointments_per_slot = appointments_per_slot - 1    
        WHERE POC_ID = ? AND Schedule_Date = ? AND Start_Time = ? 
        AND appointments_per_slot > 0 AND Active_Status = 'unblocked';    
    `;

    // Access the nested `JSON_DATA` object   
    const data = jsonData.JSON_DATA;
    const doctorId = data.Poc_ID;
    const appointmentDate = data.Appointment_Date;
    const appointmentTime = data.Appointment_Time;

    logger.debug(`Executing query for POC_ID: ${doctorId}, Schedule_Date: ${appointmentDate}, Start_Time: ${appointmentTime}`);

    try {
        await pool.promise().execute(query, [doctorId, appointmentDate, appointmentTime]);
    } catch (err) {
        logger.error("Error updating available slots:", err);
    }
};

// Increase available slots when an appointment is canceled or modified
const increaseAvailableSlots = async(jsonData) => {
    logger.info(`increaseAvailableSlots: ${JSON.stringify(jsonData["JSON_DATA"], null, 2)}`);

    if (!jsonData) {
        logger.info("No appointment found");
        return;
    }

    // Access the nested `JSON_DATA` object   
    const data = jsonData.JSON_DATA;
    const pocId = data.Poc_ID;
    const appointmentDate = data.Appointment_Date;
    const appointmentTime = data.Appointment_Time;

    const query = `
        UPDATE POC_Available_Slots 
        SET appointments_per_slot = appointments_per_slot + 1
        WHERE POC_ID = ? AND Schedule_Date = ? AND Start_Time = ?;
    `;

    logger.debug(`Executing query for POC_ID: ${pocId}, Schedule_Date: ${appointmentDate}, Start_Time: ${appointmentTime}`);

    try {
        await pool.promise().execute(query, [pocId, appointmentDate, appointmentTime]);
    } catch (err) {
        logger.error("Error increasing available slots:", err);
    }
};

const moment = require("moment-timezone");

// Function to get appointment details for POC view with pagination
async function getAppointmentDetailsForPocView(pocId, pageNumber, batchSize) {
    const query1 = `
        SELECT * 
        FROM poc_available_slots
        WHERE POC_ID = ? AND Schedule_Date >= CURDATE()
        ORDER BY Schedule_Date, Start_Time
    `;
    const query2 = `
        SELECT * 
        FROM poc_schedules
        WHERE POC_ID = ?
    `;
    logger.debug(`Executing query for POC_ID: ${pocId}`);

    try {
        // Fetch available slots
        const [availableSlots] = await pool.promise().execute(query1, [pocId]);
        // Fetch schedules
        const [schedules] = await pool.promise().execute(query2, [pocId]);

        const appointmentDetails = [];

        availableSlots.forEach((slot) => {
            const schedule = schedules.find(
                (schedule) =>
                schedule.Day_of_Week === getDayOfWeek(slot.Schedule_Date) &&
                schedule.Start_Time <= slot.Start_Time &&
                schedule.End_Time >= slot.End_Time
            );
            if (schedule) {
                const appointmentsCount =
                    schedule.appointments_per_slot - slot.appointments_per_slot;
                const date = moment.tz(
                    slot.Schedule_Date,
                    "YYYY-MM-DD",
                    "Asia/Kolkata"
                ); // Asia/Kolkata is the time zone for India Standard Time   
                const time = moment.tz(
                    `1970-01-01T${slot.Start_Time}Z`,
                    "YYYY-MM-DDTHH:mm:ssZ",
                    "Asia/Kolkata"
                );
                const currentTime = moment.tz("Asia/Kolkata");
                const appointmentTime = moment.tz(
                    `${date.format("YYYY-MM-DD")}T${time.format("HH:mm:ss")}Z`,
                    "YYYY-MM-DDTHH:mm:ssZ",
                    "Asia/Kolkata"
                );
                if (
                    appointmentsCount > 0 &&
                    appointmentTime.isSameOrAfter(currentTime)
                ) {
                    appointmentDetails.push({
                        date: date.format("YYYY-MM-DD"),
                        day: date.format("dddd"),
                        time: time.format("HH:mm:ss"),
                        noOfAppointments: appointmentsCount,
                    });
                }
            }
        });

        // Paginate the results   
        const start = (pageNumber - 1) * batchSize;
        const end = start + batchSize;
        if (start >= appointmentDetails.length) {
            return { message: "You have reached the end of the list." };
        } else {
            return appointmentDetails.slice(start, end);
        }
    } catch (err) {
        logger.error("Error fetching appointment details for POC:", err);
        throw err;
    }
}

// Helper function to get the day of the week from a date   
function getDayOfWeek(date) {
    const dayOfWeek = new Date(date).getDay();
    switch (dayOfWeek) {
        case 0:
            return "Sunday";
        case 1:
            return "Monday";
        case 2:
            return "Tuesday";
        case 3:
            return "Wednesday";
        case 4:
            return "Thursday";
        case 5:
            return "Friday";
        case 6:
            return "Saturday";
    }
}

// Function to retrieve the POC's details by POC ID
async function getPocDetailsByPocId(pocId) {
    const query = `SELECT * FROM POC WHERE POC_ID = ?`;
    logger.debug(`Executing query for POC_ID: ${pocId}`);

    try {
        const [results] = await pool.promise().execute(query, [pocId]);
        return results[0];
    } catch (err) {
        logger.error("Error fetching POC details:", err);
        throw err;
    }
}

// Function to fetch upcoming appointments
async function fetchUpcomingAppointments() {
    const query = `
        SELECT
            u.User_Name AS customer_name, 
            u.User_Contact AS phone_number, 
            a.Appointment_Date, 
            a.Appointment_Time, 
            a.Appointment_Type, 
            a.Appointment_ID, 
            p.POC_Name AS doctor_name, 
            p.Contact_Number AS poc_phone, 
            c.Client_Name AS client_name, 
            c.Email AS client_email,
            c.Client_ID AS client_id
        FROM appointments a
        JOIN users u 
            ON a.User_ID = u.User_ID
        JOIN poc p 
            ON a.POC_ID = p.POC_ID
        JOIN client c 
            ON p.Client_ID = c.Client_ID
        WHERE
            a.Status = 'Confirmed' 
            AND a.Is_Active = 1 
            AND TIMESTAMPDIFF(MINUTE, NOW(), CONCAT(a.Appointment_Date, ' ', a.Appointment_Time)) = 120;
    `;

    try {
        const [rows] = await pool.promise().execute(query);
        return rows;
    } catch (err) {
        logger.error("Error fetching upcoming appointments:", err);
        throw err;
    }
}

// Function to retrieve client details by Client_ID
async function getClientDetails(clientId) {
    const query = `SELECT * FROM Client WHERE Client_ID = ?`;
    logger.debug(`Executing query for Client_ID: ${clientId}`);

    try {
        const [results] = await pool.promise().execute(query, [clientId]);
        return results[0];
    } catch (err) {
        logger.error("Error fetching Client details:", err);
        throw err;
    }
}


module.exports = {
    fetchUpcomingAppointments,
    getClientDetails,
    getPocDetails,
    getPocDetailsByPocId,
    getAppointmentDetailsForPocView,
    getAppointmentDetailsByAppointmentId,
    getAppointmentDetailsByUserID,
    increaseAvailableSlots,
    getMeetLink,
    getTemplateMessage,
    insertAppointment,
    updateAppointment,
    updateAvailableSlots,
    insertUserData,
    getUserData,
    updateUserField,
    getClientID,
    getWelcomeMessage,
    getMainMenu,
    getFromList,
    getPocFromPoc,
    getAvailableDates,
    getAvailableTimes,
    getAppointmentJsonDataByKey,
    getAppointmentJsonData,
    updateAppointmentJsonData,
};