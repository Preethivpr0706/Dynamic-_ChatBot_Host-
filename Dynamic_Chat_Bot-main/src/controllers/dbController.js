const { getConnection, connectDB } = require("../config/db");
const { sendWhatsAppMessage } = require("../utils/utils");
const logger = require('../config/Logger');

function getClientID(displayPhoneNumber, from) {
    return new Promise((resolve, reject) => {
        const query = `SELECT 
            Client_ID 
        FROM Client
        WHERE Contact_Number = ? `;
        const connection = getConnection();

        logger.info(`Fetching Client ID for displayPhoneNumber: "${displayPhoneNumber}"`);

        connection.execute(query, [displayPhoneNumber], async(err, results) => {
            if (err) {
                logger.error("Database query error:", err);
                return reject(err); // Allow the caller to handle this error   
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
                // Resolve with a null value to indicate "no client found" gracefully   
                return resolve(null);
            } catch (messageError) {
                logger.error("Error sending WhatsApp message:", messageError);
                // Still resolve null to avoid stopping the process   
                return resolve(null);
            }
        });
    });
}

function getWelcomeMessage(clientId) {
    return new Promise((resolve, reject) => {
        const query =
            `SELECT 
                Value_name
            FROM List
            WHERE Client_ID =? AND Key_name = "GREETINGS"`;
        const connection = getConnection();
        logger.debug(`Executing query for Client_ID: ${clientId}`);
        connection.execute(query, [clientId], (err, results) => {
            if (err) {
                logger.error("error running query:", err);
                return;
            }
            const welcomeMessage = results[0].Value_name;
            resolve(welcomeMessage);
        });
    });
}

async function getMainMenu(clientId, parentMenuID) {
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

        const connection = getConnection();

        // Log query parameters for better traceability, without showing the full query.  
        logger.debug(`Executing query for Client_ID: ${clientId}, Parent_Menu_ID: ${parentMenuID}`);

        connection.execute(query, [clientId, parentMenuID], (err, rows) => {
            if (err) {
                logger.error('Error running query:', err);
                reject(err); // Reject the promise to handle errors properly  
                return;
            }

            // Log the number of rows returned to indicate query success.  
            logger.info(`Query executed successfully. ${rows.length} row(s) returned.`);

            // Log each row as a separate line for better readability  
            rows.forEach((row, index) => {
                logger.debug(`Row ${index + 1}: ${JSON.stringify(row)}`);
            });

            resolve(rows); // Resolve the promise with the query results  
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
        const connection = getConnection();
        logger.debug(`Executing query for Client_ID: ${iClientId}, Menu_ID: ${iMenuId}, Key_name: ${iKey}, Lang: ${iLang}`);
        connection.execute(
            query, [iMenuId, iClientId, iKey, iLang],
            (err, results) => {
                if (err) {
                    logger.error("error running query:", err);
                    return;
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

        const connection = getConnection();
        logger.debug(`Executing query for Client_ID: ${iClientId}, Menu_ID: ${iMenuId}, Specialization: ${iKey}`);
        connection.execute(query, params, (err, results) => {
            if (err) {
                logger.error("error running query:", err);
                reject(err);
            } else {
                logger.info("Query results:", results);
                resolve(results);
            }
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
        const connection = getConnection();
        logger.debug(`Executing query for Client_ID: ${ClientId}, Contact_Number: ${from}`);
        connection.execute(query, [ClientId, from], (err, results) => {
            if (err) {
                logger.error("error running query:", err);
                return;
            }
            logger.info("Query results:", results);

            resolve(results[0]);
        });
    });
}

const getAvailableDates = (clientId, menuId, pocIdOrAppointmentType, Appointment_ID) => {
    return new Promise((resolve, reject) => {
        const connection = getConnection();

        // Check if pocIdOrAppointmentType is an appointment type    
        const query = `SELECT * FROM POC WHERE CLIENT_ID = ? AND Specialization = ?`;
        logger.debug(`Executing query for Client_ID: ${clientId}, Specialization: ${pocIdOrAppointmentType}`);
        connection.execute(query, [clientId, pocIdOrAppointmentType], (err, results) => {
            if (err) {
                logger.error("Error fetching POC details:", err);
                reject(err);
            } else {
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
                    connection.execute(availableDatesQuery, [clientId, menuId, pocId], (err, availableDates) => {
                        if (err) {
                            logger.error("Error fetching available dates:", err);
                            reject(err);
                        } else {
                            // Return only available dates, excluding Schedule_Date from the final output if needed    
                            const formattedResults = availableDates.map(
                                ({ CLIENT_ID, MENU_ID, ITEM_ID, MENU_NAME }) => ({
                                    CLIENT_ID,
                                    MENU_ID,
                                    ITEM_ID,
                                    MENU_NAME,
                                })
                            );
                            resolve(formattedResults);
                        }
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
                    connection.execute(availableDatesQuery, [clientId, menuId, pocIdOrAppointmentType], (err, availableDates) => {
                        if (err) {
                            logger.error("Error fetching available dates:", err);
                            reject(err);
                        } else {
                            // Return only available dates, excluding Schedule_Date from the final output if needed    
                            const formattedResults = availableDates.map(
                                ({ CLIENT_ID, MENU_ID, ITEM_ID, MENU_NAME }) => ({
                                    CLIENT_ID,
                                    MENU_ID,
                                    ITEM_ID,
                                    MENU_NAME,
                                })
                            );
                            resolve(formattedResults);
                        }
                    });
                }
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

        const connection = getConnection();
        logger.debug(`Executing query for Client_ID: ${iClientId}, Menu_ID: ${iMenuId}, POC_ID: ${iKey}, Schedule_Date: ${iValue}`);

        connection.execute(
            query, [iClientId, iMenuId, iKey, iValue],
            (err, results) => {
                if (err) {
                    logger.error("Error fetching available times:", err);
                    reject(err);
                } else {
                    resolve(results); // Return only available times   
                }
            }
        );
    });
}

// Get user data by contact number   
function getUserData(userContact) {
    return new Promise(async(resolve, reject) => {
        const query = `SELECT * 
        FROM Users
        WHERE User_Contact = ?`;
        const connection = getConnection();
        logger.debug(`Executing query for User_Contact: ${userContact}`);

        connection.execute(query, [userContact], (err, results) => {
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

// Insert a new user into the Users table   
async function insertUserData(userContact, clientId) {
    const query = "INSERT IGNORE INTO Users (User_Contact, Client_ID) VALUES (?,?)";
    logger.debug(`Executing query for User_Contact: ${userContact}`);
    await getConnection().execute(query, [userContact, clientId]);
    return new Promise((resolve, reject) => {
        getConnection().execute(query, [userContact, clientId], (err, result) => {
            if (err) {
                logger.error("Error inserting user data:", err);
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}
// Update specific user field (name, email, or location)   
async function updateUserField(userContact, field, value) {
    const query = `UPDATE Users 
    SET ${field} = ? 
    WHERE User_Contact = ?`;
    logger.debug(`Executing query for User_Contact: ${userContact}, Field: ${field}`);
    await getConnection().execute(query, [value, userContact]);
    return new Promise((resolve, reject) => {
        getConnection().execute(query, [value, userContact], (err, result) => {
            if (err) {
                logger.error("Error updating user field:", err);
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

async function insertAppointment(clientId, userId) {
    const query =
        `INSERT INTO Appointments (Client_ID, User_ID, POC_ID, Appointment_Date, Appointment_Time, Appointment_Type, Status, Is_Active, JSON_DATA) 
    VALUES(?,?,?,?,?,?,?,?,?)`;
    const connection = getConnection();
    logger.debug(`Executing query for Client_ID: ${clientId}, User_ID: ${userId}`);
    return new Promise((resolve, reject) => {
        connection.execute(
            query, [
                clientId,
                userId,
                null,
                null,
                null,
                null,
                "Pending",
                false,
                JSON.stringify({}),
            ],
            (err, result) => {
                if (err) {
                    logger.error("Error inserting appointment:", err);
                    reject(err);
                } else {
                    const appointmentId = result.insertId;
                    resolve(appointmentId);
                }
            }
        );
    });
}

// fetch appointment details using userId for cancel and reschedule   
function getAppointmentDetailsByUserID(userId) {
    return new Promise((resolve, reject) => {
        const query = `SELECT 
            Appointment_Type,
            POC_ID,
            Appointment_ID,
            DATE_FORMAT(Appointment_Date, '%Y-%m-%d') as Appointment_Date,
            Appointment_Time
        FROM appointments
        WHERE User_ID = ? AND Appointment_Type <> "Emergency"
        AND Is_Active=1
        AND(Appointment_Date > CURDATE() OR (Appointment_Date = CURDATE() AND Appointment_Time >= CURTIME()))`;
        const connection = getConnection();
        logger.debug(`Executing query for User_ID: ${userId}`);
        connection.execute(query, [userId], (err, rows) => {
            if (err) {
                logger.error("Error fetching appointment details:", err);
                reject(err); // Reject the Promise if there is an error   
            } else {
                logger.info(rows);
                resolve(rows);
            }
        });
    });
}

function getAppointmentDetailsByAppointmentId(appointmentId) {
    return new Promise((resolve, reject) => {
        const query = `SELECT 
            Appointment_Type,
            POC_ID,
            DATE_FORMAT(Appointment_Date, '%Y-%m-%d') as Appointment_Date,
            Appointment_Time,
            Payment_Status
        FROM appointments
        WHERE Appointment_ID = ?`;
        const connection = getConnection();
        logger.debug(`Executing query for Appointment_ID: ${appointmentId}`);
        connection.execute(query, [appointmentId], (err, rows) => {
            if (err) {
                logger.error("Error fetching appointment details:", err);
                reject(err); // Reject the Promise if there is an error   
            } else {
                if (rows.length > 0) {
                    logger.info(rows);
                    resolve(rows);
                } else {
                    logger.error(`Error in fetching appointment ${appointmentId}`);
                    reject(new Error(`Error in fetching appointment`));
                }
            }
        });
    });
}

function getTemplateMessage(clientId, templateName) {
    return new Promise((resolve, reject) => {
        // Fetch the template text based on CLIENT_ID and TEMPLATE_NAME   
        const query = `SELECT 
            TEMPLATE_TEXT
        FROM Templates
        WHERE CLIENT_ID = ? AND TEMPLATE_NAME = ?`;
        const connection = getConnection();
        logger.debug(`Executing query for Client_ID: ${clientId}, Template_Name: ${templateName}`);
        connection.execute(query, [clientId, templateName], (err, rows) => {
            if (err) {
                logger.error("Error fetching template message:", err);
                reject(err); // Reject the Promise if there is an error   
            } else {
                if (rows.length > 0) {
                    resolve(rows[0].TEMPLATE_TEXT); // Resolve the Promise with the template text   
                } else {
                    logger.error(`Template for ${templateName} not found for client ${clientId}`);
                    reject(
                        new Error(
                            `Template for ${templateName} not found for client ${clientId}`
                        )
                    ); // Reject the Promise if the template is not found   
                }
            }
        });
    });
}

async function getMeetLink(pocId) {
    return new Promise((resolve, reject) => {
        if (pocId === null || pocId === undefined) {
            resolve(null); // Return null immediately if pocId is null or undefined   
            return;
        }
        const query = `SELECT 
            Meet_Link
        FROM POC
        WHERE POC_ID = ?`;
        const connection = getConnection();
        logger.debug(`Executing query for POC_ID: ${pocId}`);

        connection.execute(query, [pocId], (err, results) => {
            if (err) {
                logger.error("Error fetching Meet_Link:", err);
                reject(err);
            } else {
                // Check if results contain any rows, if not, resolve with null   
                resolve(results.length > 0 ? results[0].Meet_Link : null);
            }
        });
    });
}

const updateAppointmentJsonData = (appointmentId, key, value) => {
    return new Promise((resolve, reject) => {
        const connection = getConnection();

        const updateQuery = `UPDATE Appointments 
        SET JSON_DATA = JSON_SET(JSON_DATA, '$.${key}', ?) 
        WHERE Appointment_ID = ?`;

        logger.debug(`Executing query for Appointment_ID: ${appointmentId}, Key: ${key}`);

        connection.execute(updateQuery, [value, appointmentId], (err) => {
            if (err) {
                logger.error("Error updating JSON data:", err);
                reject(err);
            } else {
                logger.info("JSON data updated successfully");
                resolve();
            }
        });
    });
};

const updateAppointment = (column_name, value, appointmentId, iSelectId) => {
    return new Promise((resolve, reject) => {
        const connection = getConnection();

        const nonColumns = ["Department", "Confirm_Status", "Emergency_Reason", "Appointment_Function", "Finalize_Status"];

        if (nonColumns.includes(column_name)) {
            updateAppointmentJsonData(appointmentId, column_name, value)
                .then(() => {
                    logger.info("JSON data updated successfully");
                    resolve();
                })
                .catch((err) => {
                    logger.error("Error updating JSON data:", err);
                    reject(err);
                });
        } else if (column_name === "Poc_name") {
            // Update the POC_ID column with the iSelectId    
            const updateQuery = `UPDATE Appointments 
            SET POC_ID = ?, JSON_DATA = JSON_SET(JSON_DATA, '$.Poc_ID', ?), JSON_DATA = JSON_SET(JSON_DATA, '$.Poc_name', ?)
            WHERE Appointment_ID = ?`;
            logger.debug(`Executing query for Appointment_ID: ${appointmentId}, POC_ID: ${iSelectId}, Poc_name: ${value}`);
            connection.execute(updateQuery, [iSelectId, iSelectId, value, appointmentId], (err) => {
                if (err) {
                    logger.error("Error updating POC ID and JSON data:", err);
                    reject(err);
                } else {
                    logger.info("POC ID and JSON data updated successfully");
                    resolve();
                }
            });
        } else {
            const updateQuery = `UPDATE Appointments 
            SET ${column_name} = ?, JSON_DATA = JSON_SET(JSON_DATA, '$.${column_name}', ?) 
            WHERE Appointment_ID = ? AND Status <> "Rescheduled"`;
            logger.debug(`Executing query for Appointment_ID: ${appointmentId}, Column: ${column_name}, Value: ${value}`);
            connection.execute(updateQuery, [value, value, appointmentId], (err) => {
                if (err) {
                    logger.error("Error updating appointment:", err);
                    reject(err);
                } else {
                    logger.info("Appointment updated successfully");
                    resolve();
                }
            });
        }
    });
};

const getAppointmentJsonDataByKey = (appointmentId, key) => {
    return new Promise((resolve, reject) => {
        const connection = getConnection();

        // MySQL query to retrieve a specific value from the JSON data   
        const query = `    
    SELECT JSON_EXTRACT(JSON_DATA, '$.${key}') AS value    
    FROM Appointments    
    WHERE Appointment_ID = ?    
    `;

        logger.debug(`Executing query for Appointment_ID: ${appointmentId}, Key: ${key}`);

        // Execute the query   
        connection.execute(query, [appointmentId], (err, results) => {
            if (err) {
                logger.error("Error retrieving JSON data:", err);
                reject(err);
            } else {
                const value = results[0].value;
                resolve(value);
            }
        });
    });
};

const getAppointmentJsonData = (appointmentId) => {
    return new Promise((resolve, reject) => {
        const connection = getConnection();

        // MySQL query to retrieve the JSON data   
        const query = `    
            SELECT JSON_DATA    
            FROM Appointments    
            WHERE Appointment_ID = ?    
        `;

        logger.debug(`Executing query for Appointment_ID: ${appointmentId}`);

        // Execute the query   
        connection.execute(query, [appointmentId], (err, results) => {
            if (err) {
                logger.error("Error retrieving JSON data:", err);
                reject(err);
            } else if (results.length === 0) {
                logger.warn(`No data found for Appointment_ID: ${appointmentId}`);
                resolve(null);
            } else {
                resolve(results[0]); // Return the data without logging it here
            }
        });
    });
};


const updateAvailableSlots = async(jsonData) => {
    logger.info(`updateAvailableSlots: ${JSON.stringify(jsonData["JSON_DATA"], null, 2)}`);

    if (jsonData === null || jsonData === undefined) {
        logger.info("No appointment found");
        return;
    }

    const query = `    
   UPDATE POC_Available_Slots    
   SET appointments_per_slot = appointments_per_slot - 1    
   WHERE POC_ID = ? AND Schedule_Date = ? AND Start_Time = ? AND appointments_per_slot > 0 AND Active_Status = 'unblocked';    
  `;

    // Access the nested `JSON_DATA` object   
    const data = jsonData.JSON_DATA;

    // Access specific properties inside `JSON_DATA`   
    const doctorId = data.Poc_ID;
    const appointmentDate = data.Appointment_Date;
    const appointmentTime = data.Appointment_Time;

    const connection = getConnection();
    logger.debug(`Executing query for POC_ID: ${doctorId}, Schedule_Date: ${appointmentDate}, Start_Time: ${appointmentTime}`);
    try {
        await connection.execute(query, [
            doctorId,
            appointmentDate,
            appointmentTime,
        ]);
    } catch (err) {
        logger.error("Error updating available slots:", err);
    }
};

const increaseAvailableSlots = async(jsonData) => {
    logger.info(`updateAvailableSlots: ${JSON.stringify(jsonData["JSON_DATA"], null, 2)}`);
    if (jsonData === null || jsonData === undefined) {
        logger.info("No appointment found");
        return;
    }
    // Access the nested `JSON_DATA` object   
    const data = jsonData.JSON_DATA;

    // Access specific properties inside `JSON_DATA`   
    const pocId = data.Poc_ID;
    const appointmentDate = data.Appointment_Date;
    const appointmentTime = data.Appointment_Time;
    const query = `UPDATE POC_Available_Slots 
    SET appointments_per_slot = appointments_per_slot + 1
    WHERE POC_ID = ? AND Schedule_Date = ? AND Start_Time = ?`;
    const connection = getConnection();
    logger.debug(`Executing query for POC_ID: ${pocId}, Schedule_Date: ${appointmentDate}, Start_Time: ${appointmentTime}`);
    try {
        await connection.execute(query, [pocId, appointmentDate, appointmentTime]);
    } catch (err) {
        logger.error("Error increasing available slots:", err);
    }
};

const moment = require("moment-timezone");

async function getAppointmentDetailsForPocView(pocId, pageNumber, batchSize) {
    return new Promise((resolve, reject) => {
        const query1 = `SELECT * 
        FROM poc_available_slots
        WHERE POC_ID = ? AND Schedule_Date >= CURDATE()
        ORDER BY Schedule_Date, Start_Time`;
        const query2 = `SELECT * 
        FROM poc_schedules
        WHERE POC_ID = ?`;
        const connection = getConnection();

        logger.debug(`Executing query for POC_ID: ${pocId}`);
        connection.execute(query1, [pocId], (err, availableSlots) => {
            if (err) {
                logger.error("Error fetching available slots:", err);
                reject(err);
            } else {
                logger.debug(`Executing query for POC_ID: ${pocId}`);
                connection.execute(query2, [pocId], (err, schedules) => {
                    if (err) {
                        logger.error("Error fetching schedules:", err);
                        reject(err);
                    } else {
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
                            resolve({ message: "You have reached the end of the list." });
                        } else {
                            resolve(appointmentDetails.slice(start, end));
                        }
                    }
                });
            }
        });
    });
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
    return new Promise((resolve, reject) => {
        const query = `SELECT * FROM POC WHERE POC_ID = ?`;
        const connection = getConnection();
        logger.debug(`Executing query for POC_ID: ${pocId}`);
        connection.execute(query, [pocId], (err, results) => {
            if (err) {
                logger.error("Error fetching POC details:", err);
                reject(err);
            } else {
                resolve(results[0]);
            }
        });
    });
}


async function fetchUpcomingAppointments() {
    return new Promise((resolve, reject) => {
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

        const connection = getConnection();
        connection.execute(query, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}


async function getClientDetails(clientId) {
    return new Promise((resolve, reject) => {
        const query = `SELECT * FROM Client WHERE Client_ID = ?`;
        const connection = getConnection();
        logger.debug(`Executing query for Client_ID: ${clientId}`);
        connection.execute(query, [clientId], (err, results) => {
            if (err) {
                logger.error("Error fetching Client details:", err);
                reject(err);
            } else {
                resolve(results[0]);
            }
        });
    });
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