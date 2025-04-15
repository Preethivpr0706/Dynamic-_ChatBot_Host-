const pool = require("../config/db");
const { sendWhatsAppMessage } = require("../utils/utils");
const logger = require("../config/Logger");
const moment = require("moment");

// Helper function to format date for display (04 - Apr (Fri))
function formatDisplayDate(dateStr) {
    return moment(dateStr, 'YYYY-MM-DD').format('DD - MMM (ddd)');
}

// Helper function to parse display date back to database format
function parseDisplayDate(displayDate) {
    return moment(displayDate, 'DD - MMM (ddd)').format('YYYY-MM-DD');
}

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

async function getFromList(iClientId, iMenuId, iKey, iLang, appointmentId) {
    logger.info(`getFromList: iClientId:${iClientId}, iMenuId:${iMenuId}, iKey:${iKey}, iLang:${iLang}`);

    const query = `SELECT
        Client_ID as CLIENT_ID,
        ? as MENU_ID,
        Item_ID as ITEM_ID,
        Value_name as MENU_NAME,
        Branch_ID as branchID
    FROM LIST
    WHERE Client_ID = ? AND Key_name = ? AND Lang = ?
    ORDER BY Display_order
    LIMIT 10`;

    logger.debug(`Executing query: ${query} with params: ${[iMenuId, iClientId, iKey, iLang]}`);

    try {
        const [results] = await pool.promise().execute(query, [iMenuId, iClientId, iKey, iLang]);
        logger.info("Query results:", results);
        return results;
    } catch (err) {
        logger.error("Error in getFromList:", err);
        throw err;
    }
}

async function getPocFromPoc(iClientId, iMenuId, iKey, appointmentId) {
    try {
        if (!iClientId || !iMenuId) {
            throw new Error('Missing required parameters: iClientId and iMenuId must be provided');
        }

        let branchId = 0;
        if (appointmentId) {
            try {
                const branchData = await getAppointmentJsonDataByKey(appointmentId, "Branch_ID");
                branchId = branchData ? parseInt(branchData) : 0;
            } catch (error) {
                logger.error(`Error fetching branch data for appointment ${appointmentId}:`, error);
            }
        }

        logger.info(`getPocFromPoc: iClientId:${iClientId}, iMenuId:${iMenuId}, iKey:${iKey}, branchId:${branchId}`);

        let query = `
            SELECT
                p.Client_ID as CLIENT_ID,
                ? as MENU_ID,
                p.POC_ID as ITEM_ID,
                p.POC_Name as MENU_NAME,
                p.Specialization
            FROM POC p
            WHERE p.Client_ID = ?`;

        let params = [iMenuId, iClientId];

        if (iKey && iKey !== 'null') {
            query += ` AND (
                FIND_IN_SET(?, p.Specialization) > 0
                OR p.Department_ID = ?
            )`;
            params.push(iKey, iKey);
        }

        if (branchId > 0) {
            query += ` AND EXISTS (
                SELECT 1 FROM POC_Schedules s
                WHERE s.POC_ID = p.POC_ID
                AND (s.Branch_ID = ? OR s.Branch_ID = 0)
            )`;
            params.push(branchId);
        }

        query += ` LIMIT 10`;

        logger.debug(`Executing query: ${query} with params: ${params}`);

        const [results] = await pool.promise().execute(query, params);

        if (!results || results.length === 0) {
            logger.warn(`No POCs found for client ${iClientId} with the given criteria`);
            return [];
        }

        logger.info(`Found ${results.length} POCs matching the criteria`);
        return results;
    } catch (err) {
        logger.error("Error in getPocFromPoc:", err);
        throw err;
    }
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
    return new Promise(async(resolve, reject) => {
        try {
            let branchId = 0;
            if (Appointment_ID) {
                const branchData = await getAppointmentJsonDataByKey(Appointment_ID, "Branch_ID");
                branchId = branchData ? parseInt(branchData) : 0;
            }

            const query = `SELECT * FROM POC WHERE CLIENT_ID = ? AND Specialization LIKE ?`;
            logger.debug(`Executing query for Client_ID: ${clientId}, Specialization: ${pocIdOrAppointmentType}`);

            pool.query(query, [clientId, `%${pocIdOrAppointmentType}%`], async(err, results) => {
                if (err) {
                    logger.error("Error fetching POC details:", err);
                    return reject(err);
                }

                let pocId = pocIdOrAppointmentType;
                let isPocIdDirect = false;

                if (results.length > 0) {
                    pocId = results[0].POC_ID;
                    await updateAppointment("POC_ID", pocId, Appointment_ID);
                    await updateAppointmentJsonData(Appointment_ID, "Poc_ID", pocId);
                } else {
                    isPocIdDirect = true;
                }

                const availableDatesQuery = `
                    SELECT DISTINCT
                        ? AS CLIENT_ID,
                        ? AS MENU_ID,
                        CONCAT(POC_ID, '-', DATE_FORMAT(Schedule_Date, '%Y-%m-%d')) AS ITEM_ID,
                        DATE_FORMAT(Schedule_Date, '%Y-%m-%d') AS MENU_NAME,
                        Schedule_Date
                    FROM poc_available_slots
                    WHERE POC_ID = ?
                    ${branchId > 0 ? 'AND (Branch_ID = ? OR Branch_ID = 0)' : ''}
                    AND Schedule_Date >= CURDATE()
                    AND appointments_per_slot > 0
                    AND Active_Status = 'unblocked'
                    AND EXISTS (
                        SELECT 1
                        FROM poc_available_slots AS slots
                        WHERE slots.POC_ID = poc_available_slots.POC_ID
                            AND slots.Schedule_Date = poc_available_slots.Schedule_Date
                            AND (slots.Schedule_Date > CURDATE() OR
                                (slots.Schedule_Date = CURDATE() AND slots.Start_Time >= CURTIME()))
                    )
                    ORDER BY Schedule_Date
                    LIMIT 10
                `;

                const queryParams = [clientId, menuId, pocId];
                if (branchId > 0) queryParams.push(branchId);

                logger.debug(`Executing query: ${availableDatesQuery} with params: ${queryParams}`);

                pool.query(availableDatesQuery, queryParams, (err, availableDates) => {
                    if (err) {
                        logger.error("Error fetching available dates:", err);
                        return reject(err);
                    }

                    const formattedResults = availableDates.map(({ CLIENT_ID, MENU_ID, ITEM_ID, MENU_NAME }) => ({
                        CLIENT_ID,
                        MENU_ID,
                        ITEM_ID,
                        MENU_NAME: formatDisplayDate(MENU_NAME) // Format date for display
                    }));

                    if (isPocIdDirect && Appointment_ID) {
                        pool.query(`SELECT POC_Name FROM POC WHERE POC_ID = ?`, [pocId], (err, pocResults) => {
                            if (!err && pocResults.length > 0) {
                                updateAppointment("Poc_name", pocResults[0].POC_Name, Appointment_ID, pocId);
                            }
                            resolve(formattedResults);
                        });
                    } else {
                        resolve(formattedResults);
                    }
                });
            });
        } catch (error) {
            logger.error("Error in getAvailableDates:", error);
            reject(error);
        }
    });
};

function getAvailableTimes(iClientId, iMenuId, iKey, iValue) {
    return new Promise(async(resolve, reject) => {
        try {
            logger.info(
                `getAvailableTimes: iClientId:${iClientId}, iMenuId:${iMenuId}, iKey:${iKey}, iValue:${iValue}`
            );

            // Parse the display date back to database format
            const dbDate = parseDisplayDate(iValue);

            let pocId = iKey;
            let appointmentId = null;

            if (iKey.includes('~')) {
                [pocId, appointmentId] = iKey.split('~');
            }

            let branchId = 0;
            if (appointmentId) {
                const branchData = await getAppointmentJsonDataByKey(appointmentId, "Branch_ID");
                branchId = branchData ? parseInt(branchData) : 0;
            }

            const query = `
                SELECT DISTINCT
                    ? AS CLIENT_ID,
                    ? AS MENU_ID,
                    CONCAT(POC_ID, '-', DATE_FORMAT(Schedule_Date, '%Y-%m-%d'), '-', Start_Time) AS ITEM_ID,
                    Start_Time AS MENU_NAME
                FROM poc_available_slots
                WHERE POC_ID = ?
                AND Schedule_Date = ?
                ${branchId > 0 ? 'AND (Branch_ID = ? OR Branch_ID = 0)' : ''}
                AND appointments_per_slot > 0
                AND Active_Status = 'unblocked'
                AND (Schedule_Date > CURDATE() OR (Schedule_Date = CURDATE() AND Start_Time >= CURTIME()))
                ORDER BY Start_Time
                LIMIT 10
            `;

            const queryParams = [iClientId, iMenuId, pocId, dbDate];
            if (branchId > 0) queryParams.push(branchId);

            logger.debug(`Executing query: ${query} with params: ${queryParams}`);

            pool.execute(query, queryParams, (err, results) => {
                if (err) {
                    logger.error("Error fetching available times:", err);
                    reject(err);
                } else {
                    resolve(results);
                }
            });
        } catch (error) {
            logger.error("Error in getAvailableTimes:", error);
            reject(error);
        }
    });
}

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
                resolve(results.length > 0 ? results[0] : null);
            }
        });
    });
}

async function insertUserData(userContact, clientId) {
    const query = "INSERT IGNORE INTO Users (User_Contact, Client_ID) VALUES (?,?)";
    logger.debug(`Executing query for User_Contact: ${userContact}`);

    try {
        const result = await pool.execute(query, [userContact, clientId]);
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
        const result = await pool.execute(query, [value, userContact]);
        return result;
    } catch (err) {
        logger.error("Error updating user field:", err);
        throw err;
    }
}

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
        // Format dates for display
        const formattedRows = rows.map(row => ({
            ...row,
            Appointment_Date: row.Appointment_Date ? formatDisplayDate(row.Appointment_Date) : null
        }));
        logger.info(formattedRows);
        return formattedRows;
    } catch (err) {
        logger.error("Error fetching appointment details:", err);
        throw err;
    }
}

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
            return rows[0].TEMPLATE_TEXT;
        } else {
            logger.error(`Template for ${templateName} not found for client ${clientId}`);
            throw new Error(`Template for ${templateName} not found for client ${clientId}`);
        }
    } catch (err) {
        logger.error("Error fetching template message:", err);
        throw err;
    }
}

async function getMeetLink(pocId) {
    if (pocId === null || pocId === undefined) {
        return null;
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

async function updateAppointment(column_name, value, appointmentId, iSelectId, branchID) {
    const nonColumns = ["Department", "Confirm_Status", "Emergency_Reason", "Appointment_Function", "Finalize_Status", "Branch"];

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
            SET POC_ID = ?, JSON_DATA = JSON_SET(JSON_DATA, '$.Poc_ID', ?),
                JSON_DATA = JSON_SET(JSON_DATA, '$.Poc_name', ?)
            WHERE Appointment_ID = ?
        `;

        logger.debug(`Executing query: ${updateQuery} with params: ${[iSelectId, iSelectId, value, appointmentId]}`);

        try {
            await pool.promise().execute(updateQuery, [iSelectId, iSelectId, value, appointmentId]);
            logger.info("POC ID and JSON data updated successfully");
        } catch (err) {
            logger.error("Error updating POC ID and JSON data:", err);
            throw err;
        }
    } else if (column_name == "Branch_ID") {
        await updateAppointmentJsonData(appointmentId, "Branch", value);

        const updateQuery = `
        UPDATE Appointments
        SET ${column_name} = ?, JSON_DATA = JSON_SET(JSON_DATA, '$.${column_name}', ?)
        WHERE Appointment_ID = ? AND Status <> "Rescheduled"
        `;

        logger.debug(`Executing query: ${updateQuery} with params: ${branchID, branchID, appointmentId}`);

        try {
            await pool.promise().execute(updateQuery, [branchID, branchID, appointmentId]);
            logger.info("Appointment updated successfully");
        } catch (err) {
            logger.error("Error updating appointment:", err);
            throw err;
        }
    } else if (column_name === "Appointment_Date") {
        // Parse display date back to database format before storing
        const dbDate = parseDisplayDate(value);
        const updateQuery = `
            UPDATE Appointments
            SET ${column_name} = ?, JSON_DATA = JSON_SET(JSON_DATA, '$.${column_name}', ?)
            WHERE Appointment_ID = ? AND Status <> "Rescheduled"
        `;

        logger.debug(`Executing query: ${updateQuery} with params: ${[dbDate, dbDate, appointmentId]}`);

        try {
            await pool.promise().execute(updateQuery, [dbDate, dbDate, appointmentId]);
            logger.info("Appointment updated successfully");
        } catch (err) {
            logger.error("Error updating appointment:", err);
            throw err;
        }
    } else {
        const updateQuery = `
            UPDATE Appointments
            SET ${column_name} = ?, JSON_DATA = JSON_SET(JSON_DATA, '$.${column_name}', ?)
            WHERE Appointment_ID = ? AND Status <> "Rescheduled"
        `;

        logger.debug(`Executing query: ${updateQuery} with params: ${[value, value, appointmentId]}`);

        try {
            await pool.promise().execute(updateQuery, [value, value, appointmentId]);
            logger.info("Appointment updated successfully");
        } catch (err) {
            logger.error("Error updating appointment:", err);
            throw err;
        }
    }
}

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
        // If this is a date field, format it for display
        if (key === "Appointment_Date" && value) {
            return formatDisplayDate(value.replace(/"/g, ''));
        }
        return value;
    } catch (err) {
        logger.error("Error retrieving JSON data:", err);
        throw err;
    }
};

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
        // Format any date fields in the JSON data
        const jsonData = results[0];
        // Format any date fields in the JSON data

        if (jsonData && jsonData.Appointment_Date) {
            jsonData.Appointment_Date = formatDisplayDate(jsonData.Appointment_Date);
        }
        return jsonData;
        return jsonData;
    } catch (err) {
        logger.error("Error retrieving JSON data:", err);
        throw err;
    }
};

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

    const data = jsonData.JSON_DATA;
    const doctorId = data.Poc_ID;
    // Parse display date back to database format if needed
    const appointmentDate = data.Appointment_Date ? parseDisplayDate(data.Appointment_Date) : data.Appointment_Date;
    const appointmentTime = data.Appointment_Time;

    logger.debug(`Executing query for POC_ID: ${doctorId}, Schedule_Date: ${appointmentDate}, Start_Time: ${appointmentTime}`);

    try {
        await pool.promise().execute(query, [doctorId, appointmentDate, appointmentTime]);
    } catch (err) {
        logger.error("Error updating available slots:", err);
    }
};

const increaseAvailableSlots = async(jsonData) => {
    logger.info(`increaseAvailableSlots: ${JSON.stringify(jsonData["JSON_DATA"], null, 2)}`);

    if (!jsonData) {
        logger.info("No appointment found");
        return;
    }

    const data = jsonData.JSON_DATA;
    const pocId = data.Poc_ID;
    // Parse display date back to database format if needed
    const appointmentDate = data.Appointment_Date ? parseDisplayDate(data.Appointment_Date) : data.Appointment_Date;
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
        const [availableSlots] = await pool.promise().execute(query1, [pocId]);
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
                );
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
                        date: formatDisplayDate(date.format("YYYY-MM-DD")), // Format for display
                        day: date.format("dddd"),
                        time: time.format("HH:mm:ss"),
                        noOfAppointments: appointmentsCount,
                    });
                }
            }
        });

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
        throw  err;    
    }
}

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


async function getTransactionIdByAppointmentId(appointmentId) {
    const query = `SELECT transaction_id FROM transactions WHERE appointment_id = ?`;
    logger.debug(`Executing query for Appointment_ID: ${appointmentId}`);

    try {
        const [results] = await pool.promise().execute(query, [appointmentId]);
        return results[0].transaction_id;
    } catch (err) {
        logger.error("Error fetching Transaction ID:", err);
        throw err;
    }
}

async function updateAppointmentIdByTransactionId(transaction_id, appointmentId) {
    const query = `UPDATE transactions SET appointment_id =? WHERE transaction_id =?;`;
    logger.debug(`Executing query for Transaction_ID: ${transaction_id} and Appointment_ID: ${appointmentId}`);

    try {
        await pool.promise().execute(query, [appointmentId, transaction_id]);
    } catch (err) {
        logger.error("Error updating Appointment ID:", err);
        throw err;
    }
}

async function fetchCompletedAppointments() {
    try {
        const query = `
            SELECT a.Appointment_ID as Appointment_ID, u.User_Name as customer_name, u.User_Contact as phone_number,
                   a.Appointment_Date, a.Appointment_Time, a.Status,
                   c.Client_Name as client_name, a.Client_ID as client_id, c.Email as Client_Email
            FROM appointments a
            JOIN client c ON a.Client_ID = c.Client_ID
            JOIN users u ON a.User_ID = u.User_ID
            WHERE a.Status = 'Availed'
            AND (a.feedback_sent = 0 OR a.feedback_sent IS NULL)
            AND a.Appointment_Date <= CURDATE()
            ORDER BY a.Appointment_Date DESC, a.Appointment_Time DESC
            LIMIT 50
        `;

        const [appointments] = await pool.promise().execute(query);
        console.log(`Found ${appointments.length} completed appointments that need feedback requests`);
        return appointments;
    } catch (error) {
        console.error("Error fetching completed appointments:", error);
        return [];
    }
}

async function updateFeedbackSentStatus(appointmentId) {
    try {
        const query = `
            UPDATE appointments
            SET feedback_sent = 1,
                feedback_sent_date = NOW()
            WHERE Appointment_ID = ?
        `;

        const [result] = await pool.promise().execute(query, [appointmentId]);

        if (result.affectedRows > 0) {
            console.log(`Updated feedback_sent status for appointment ${appointmentId}`);
            return true;
        } else {
            console.error(`No appointment found with ID ${appointmentId}`);
            return false;
        }
    } catch (error) {
        console.error(`Error updating feedback_sent status for appointment ${appointmentId}:`, error);
        return false;
    }
}



module.exports = {
    fetchCompletedAppointments,
    updateFeedbackSentStatus,
    getTransactionIdByAppointmentId,
    updateAppointmentIdByTransactionId,
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
    formatDisplayDate,
    parseDisplayDate
};