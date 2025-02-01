// userView.js  
const {
    getPocDetails,
    getPocDetailsByPocId,
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
    getClientDetails,
} = require('../controllers/dbController');

const {
    sendWhatsAppMessage,
    sendInteractiveMessage,
    sendInteractiveMessageWithImage,
    sendRadioButtonMessage,
    sendBackButtonMessage,
    getImagePath
} = require('../utils/utils');

const { isValidEmail, isValidPhoneNumber } = require('../utils/validate');
const logger = require('../config/Logger');
const db = require('../config/db');

db.connectDB();

const path = require('path');
const dotenv = require('dotenv');

// Explicitly set the path to the .env file in the project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });




exports.handleUserView = async(req, res, webhookData) => {
    const { from, messageBody, messageType, displayPhoneNumber } = webhookData;
    logger.info(`Handling user view for: ${from}`);


    let userData;
    if (messageType === "text") {
        // Get client ID based on the display phone number  
        const clientId = await getClientID(displayPhoneNumber, from);
        if (clientId) {
            // Check user status (new or returning)  
            userData = await getUserData(from);

            //Ashok:moved else to main if to give good understaning  
            if (!userData) {
                // New user - insert user record and ask for name  
                await insertUserData(from, clientId);
                await sendWhatsAppMessage(from, "Welcome! Please enter your name:");
                logger.info("New user registered");
            } else {
                // User exists - check for missing fields and prompt accordingly  
                if (!userData.User_Name) {
                    await updateUserField(from, "User_Name", messageBody);
                    await sendWhatsAppMessage(from, "Thank you! Please enter your email:");
                    logger.info("User name updated");
                } else if (!userData.User_Email) {
                    // Validate the email before updating  
                    if (isValidEmail(messageBody)) {
                        await updateUserField(from, "User_Email", messageBody);
                        await sendWhatsAppMessage(from, "Thank you! Please share your location:");
                        logger.info("User email updated");
                    } else {
                        // Invalid email format - prompt user to enter a valid email  
                        await sendWhatsAppMessage(from, "The email you entered is invalid. Please enter a valid email address:");
                        logger.error("Invalid email format");
                    }
                } else if (!userData.User_Location) {
                    await updateUserField(from, "User_Location", messageBody);
                    await sendWhatsAppMessage(from, "Thank you for completing your details.");
                    logger.info("User location updated");
                    //Ashok:create method to make below welcome and first interactive as single method and reuse.  
                    // Show main menu after completing registration  
                    await sendWelcomeMessage(from, clientId, userData);
                } else {
                    // Fully registered user - display main menu  
                    await sendWelcomeMessage(from, clientId, userData);
                }
            }
        }
    } else {
        userData = await getUserData(from); // updated twice because, userData variable is declared at the top of the function, but its assignment is within the if (messageType === "text") block  

        // Extract the title from the JSON data  
        const { message } = webhookData;
        let title = [];
        let Response_id = [];

        if (message.interactive) {
            const interactiveType = message.interactive.type;
            if (interactiveType === "button_reply" && message.interactive.button_reply) {
                title = message.interactive.button_reply.title;
                Response_id = message.interactive.button_reply.id.split("|");
            } else if (interactiveType === "list_reply" && message.interactive.list_reply) {
                title = message.interactive.list_reply.title;
                Response_id = message.interactive.list_reply.id.split("|");
            }
        }

        logger.info(`Title: ${title} ID: ${Response_id}`);
        const previousId = Response_id[1];
        Response_id = Response_id[0].split("~");
        const clientId = Response_id[0];
        const menuId = Response_id[1];
        const selectId = Response_id[2];
        let Appointment_ID = Response_id[3];
        const clientDetails = await getClientDetails(clientId);
        const clientJsonData = clientDetails.json_data;

        try {
            if (title.toLowerCase() === "book appointment") {
                Appointment_ID = await insertAppointment(clientId, userData.User_ID);
                logger.info(`Appointment id: ${Appointment_ID}`);
            }

            // Get the main menu for initial interaction  
            const mainMenuItems = await getMainMenu(clientId, menuId);

            if (mainMenuItems.length === 0) {
                sendWhatsAppMessage(from, "No menu options available.");
                logger.error("No menu options available");
                return;
            } else if (mainMenuItems.length === 1 && mainMenuItems[0].ACTION) {
                const actionMenuNames = await handleAction(mainMenuItems[0].ACTION.split("~"), clientId, mainMenuItems[0].MENU_ID, title, selectId, from, Appointment_ID, userData);

                // Retrieve the first menu item's HEADER_MESSAGE (assuming only one HEADER_MESSAGE for the main menu)  
                let headerMessage = mainMenuItems[0].HEADER_MESSAGE;
                if (actionMenuNames !== null) {
                    let menuNames;
                    // Extract MENU_NAME items for interactive message  
                    //console.log(actionMenuNames[0].Appointment_ID)  
                    //Ashok: in what scenario, actionMenuNames[0].Appointment_ID is null??  
                    if (actionMenuNames[0].Appointment_ID) {
                        menuNames = actionMenuNames.map((item) => ({ id: item.CLIENT_ID + "~" + item.MENU_ID + "~" + item.ITEM_ID + "~" + item.Appointment_ID + "|" + clientId + "~" + menuId + "~" + selectId, title: item.MENU_NAME, }));
                    } else {
                        menuNames = actionMenuNames.map((item) => ({ id: item.CLIENT_ID + "~" + item.MENU_ID + "~" + item.ITEM_ID + "~" + Appointment_ID + "|" + clientId + "~" + menuId + "~" + selectId, title: item.MENU_NAME, }));
                    }
                    await sendRadioButtonMessage(from, headerMessage, menuNames);
                    //back button conditionally
                    if (clientJsonData["backButton"]) {
                        await sendBackButton(from, previousId, Appointment_ID, mainMenuItems);
                    }
                }
            } else {
                // Retrieve the first menu item's HEADER_MESSAGE (assuming only one HEADER_MESSAGE for the main menu)  
                const headerMessage = mainMenuItems[0].HEADER_MESSAGE;
                // Extract MENU_NAME items for interactive message  
                const menuNames = mainMenuItems.map((item) => ({ id: item.CLIENT_ID + "~" + item.MENU_ID + "~" + item.ITEM_ID + "~" + Appointment_ID + "|" + clientId + "~" + menuId + "~" + selectId, title: item.MENU_NAME, }));
                await sendRadioButtonMessage(from, headerMessage, menuNames);
                if (clientJsonData["backButton"]) {
                    await sendBackButton(from, previousId, Appointment_ID, mainMenuItems);
                }
            }
        } catch (error) {
            logger.error("Error fetching main menu:", error);
            sendWhatsAppMessage(from, "Sorry, an error occurred while fetching the menu.");
        }
    }
    res.sendStatus(200);
};

// This will be used to store appointment data in the database  
async function handleAction(iAction, iClientId, iMenuId, iUserValue, iSelectId, from, Appointment_ID, userData) {
    const iLang = "ENG";
    logger.info(`handleAction: iAction:${iAction} ,iClientID:${iClientId} ,iMenuId:${iMenuId}, iUserValue:${iUserValue} iSelectId: ${iSelectId} appointment_id: ${Appointment_ID}`);
    //Ashok:Why we need this below if else conditions to update appoinment and json?  
    if (iUserValue != "Back" && iUserValue != "Cancel Appointment" && iUserValue != "Reschedule") {
        await updateAppointment(iAction[0].split("~")[0], iUserValue, Appointment_ID, iSelectId);
        logger.info("Appointment updated successfully");
    }

    if (iAction[1] === "LIST") {
        return await getFromList(iClientId, iMenuId, iAction[2], iLang);
    } else if (iAction[1] === "POC") {
        return await getPocFromPoc(iClientId, iMenuId, await getAppointmentJsonDataByKey(Appointment_ID, "Department"));
    } else if (iAction[1] === "FETCH_AVAILABLE_DATES_DIRECT") {
        //Ashok: Why we have to update again?  
        return await getAvailableDates(iClientId, iMenuId, iSelectId);
    } else if (iAction[1] === "FETCH_AVAILABLE_DATES_CHECKUP") {
        return await getAvailableDates(iClientId, iMenuId, await getAppointmentJsonDataByKey(Appointment_ID, "Appointment_Type"), Appointment_ID);
    } else if (iAction[1] === "FETCH_AVAILABLE_TIMES_DIRECT") {
        return await getAvailableTimes(iClientId, iMenuId, iSelectId, await getAppointmentJsonDataByKey(Appointment_ID, "Appointment_Date"));
    }
    if (iAction[1] === "CONFIRM") {
        const confirmationMessage = await confirmAppointment(iClientId, iAction, Appointment_ID, userData);
        const confirmationOptions = [
            { CLIENT_ID: iClientId, MENU_ID: iMenuId, ITEM_ID: "Confirm", Appointment_ID: Appointment_ID, MENU_NAME: "Confirm", },
            { CLIENT_ID: iClientId, MENU_ID: iMenuId, ITEM_ID: "Cancel_Appointment_Request", Appointment_ID: Appointment_ID, MENU_NAME: "Cancel Request", },
        ];
        await sendWhatsAppMessage(from, confirmationMessage);
        return confirmationOptions;
    } else if (iAction[1] === "PAYMENT") {
        if (iUserValue === "Confirm") {
            const isTeleConsultation = (iAction[2] === "PAYMENT_TELE") ? true : false;
            const paymentStatus = await getPaymentStatusByTransactionId(iUserValue);
            const { paymentLink, transactionId, feesAmount } = await generatePaymentLink(Appointment_ID, userData, from);
            const expirationTime = new Date(Date.now() + 10 * 60 * 1000);
            await updateTransaction(transactionId, { expiration_time: expirationTime });
            await sendWhatsAppMessage(from, `Please don't make any additional actions on the bot, while the payment is in progress.`);
            // Inform user about the payment link and expiration time
            paymentLinkMessage = await getTemplateMessage(iClientId, "PAYMENT");
            paymentLinkMessage = paymentLinkMessage.replace("[feesAmount]", feesAmount || "");
            paymentLinkMessage = paymentLinkMessage.replace("[paymentLink]", paymentLink || "");
            paymentLinkMessage = paymentLinkMessage.replace("[expirationTime]", expirationTime.toLocaleTimeString() || "");

            await sendWhatsAppMessage(
                from,
                paymentLinkMessage);

            if (!isTeleConsultation) {
                await sendWhatsAppMessage(from, "If you like to pay here, click on the link or proceed to Finalize to pay at the counter.");
                // Get the main menu for initial interaction  
                const mainMenuItems = await getMainMenu(iClientId, iMenuId);
                headerMessage = mainMenuItems[0].HEADER_MESSAGE;
                // Finalize menu after payment is completed
                MenuItems = [
                    { CLIENT_ID: iClientId, MENU_ID: iMenuId, ITEM_ID: `Finalize*${transactionId}`, Appointment_ID: Appointment_ID, MENU_NAME: "Finalize" },
                ];
                // Extract MENU_NAME items for radio button message  
                const menuNames = MenuItems.map((item) => ({ id: item.CLIENT_ID + "~" + item.MENU_ID + "~" + item.ITEM_ID + "~" + Appointment_ID + "|" + iClientId + "~" + iMenuId + "~" + iSelectId, title: item.MENU_NAME }));
                await sendInteractiveMessage(from, headerMessage, menuNames);
            }


            // Periodic notification and payment status check
            const intervalId = setInterval(async() => {
                const currentTime = new Date();
                const timeDifference = expirationTime - currentTime; // Time left in ms
                const minutesLeft = Math.floor(timeDifference / 1000 / 60); // Convert to minutes
                const secondsLeft = Math.floor((timeDifference / 1000) % 60); // Remainder in seconds
                const paymentStatus = await getPaymentStatusByTransactionId(transactionId);
                if (paymentStatus === 'pay_later') {
                    clearInterval(intervalId); // Stop monitoring
                    return;
                }
                if (paymentStatus === 'paid') {
                    // Update transaction status to completed
                    await updateTransaction(transactionId, { status: 'completed' });
                    await updateAppointment("Payment_Status", "Paid", Appointment_ID, iSelectId);
                    // Send a confirmation message to the user
                    await sendWhatsAppMessage(from, "Payment successful. Please proceed to finalize your appointment.");
                    clearInterval(intervalId); // Stop further checks

                    // Get the main menu for initial interaction  
                    const mainMenuItems = await getMainMenu(iClientId, iMenuId);
                    headerMessage = mainMenuItems[0].HEADER_MESSAGE;
                    // Finalize menu after payment is completed
                    MenuItems = [
                        { CLIENT_ID: iClientId, MENU_ID: iMenuId, ITEM_ID: "Finalize", Appointment_ID: Appointment_ID, MENU_NAME: "Finalize" },
                    ];
                    // Extract MENU_NAME items for radio button message  
                    const menuNames = MenuItems.map((item) => ({ id: item.CLIENT_ID + "~" + item.MENU_ID + "~" + item.ITEM_ID + "~" + Appointment_ID + "|" + iClientId + "~" + iMenuId + "~" + iSelectId, title: item.MENU_NAME }));
                    await sendInteractiveMessage(from, headerMessage, menuNames);
                } else if (currentTime > expirationTime && paymentStatus !== 'completed') {
                    // Update transaction status to expired
                    await updateTransaction(transactionId, { status: 'expired' });
                    // Send payment expiration message
                    await sendWhatsAppMessage(
                        from,
                        `The payment link has expired. Please try again to complete your booking.`
                    );
                    clearInterval(intervalId); // Stop further checks
                } else if (timeDifference > 0 && paymentStatus !== 'completed') {
                    // Send periodic reminder if payment is not completed
                    await sendWhatsAppMessage(
                        from,
                        `Waiting for payment... You have ${minutesLeft} minutes and ${secondsLeft} seconds left to complete the payment.`
                    );
                }
            }, process.env.PAYMENT_CHECK_INTERVAL || 60000); // Check and notify every 60 seconds
        } else if (iUserValue === "Cancel Request") {
            let cancel_message = await getTemplateMessage(iClientId, iSelectId);
            await sendWhatsAppMessage(from, cancel_message);
            logger.info("Appointment cancellation request sent");
        }
        return null;
    } else if (iAction[1] === "FINALIZE") {
        const transactionId = iSelectId.split("*")[1]; // extract transaction id from user value
        if (iUserValue === 'Confirm' || iUserValue === 'Finalize') {
            if (transactionId) {
                // Update transaction status to "pay_later"
                await updateTransaction(transactionId, { status: "pay_later" });
                await updateAppointment("Payment_Status", "Pay_later", Appointment_ID, iSelectId);
            }
            // Finalize the appointment  
            const finalizeMessage = await finalizeAppointment(iClientId, iAction, Appointment_ID, userData);
            await sendWhatsAppMessage(from, finalizeMessage);
            const pocMessage = await POCMessage(iClientId, iAction, Appointment_ID, userData);
            if (pocMessage !== null) {
                // Retrieve the POC's contact number
                const jsonData = await getAppointmentJsonData(Appointment_ID);
                const pocDetails = await getPocDetailsByPocId(jsonData["JSON_DATA"]["Poc_ID"]);
                const pocContactNumber = pocDetails.Contact_Number;
                const pocJsonData = pocDetails.json_data;
                // Check if "bookedMessage" is true before sending the message
                if (pocJsonData["bookedMessage"]) {
                    // Send confirmation message to the POC
                    await sendWhatsAppMessage(pocContactNumber, pocMessage);
                }
            }
            logger.info("Appointment confirmed successfully");
        } else if (iUserValue === "Cancel Request") {
            let cancel_message = await getTemplateMessage(iClientId, iSelectId);
            await sendWhatsAppMessage(from, cancel_message);
            logger.info("Appointment cancellation request sent");
        }
        return null;
    } else if (iAction[1] === "FETCH_APPOINTMENT_DETAILS") {
        const appointmentDetails = await getAppointmentDetailsByUserID(userData.User_ID);
        logger.info(appointmentDetails);
        if (appointmentDetails && appointmentDetails.length > 0) {
            const appointments = appointmentDetails.map((appointment, index) => {
                Appointment_ID = appointment.Appointment_ID;
                return {
                    id: appointment.Appointment_ID,
                    text: `Appointment ID: ${appointment.Appointment_ID},Appointment Type: ${appointment.Appointment_Type}, Date: ${appointment.Appointment_Date}, Time: ${appointment.Appointment_Time}`,
                    cancelOptions: [
                        { CLIENT_ID: iClientId, MENU_ID: iMenuId, ITEM_ID: "Cancel", MENU_NAME: "Cancel", },
                        { CLIENT_ID: iClientId, MENU_ID: 0, ITEM_ID: "Back", MENU_NAME: "Back", },
                    ],
                };
            });

            for (const appointment of appointments) {
                const cancelItems = appointment.cancelOptions.map((item) => ({ id: item.CLIENT_ID + "~" + item.MENU_ID + "~" + item.ITEM_ID + "~" + appointment.id + "|" + iClientId + "~" + iMenuId + "~" + iSelectId, title: item.MENU_NAME, }));
                await sendInteractiveMessage(from, appointment.text, cancelItems);
            }
        } else {
            await sendWhatsAppMessage(from, "No appointment found.");
            logger.info("No appointment found");
        }
        return null;
    } else if (iAction[1] === "FINALIZE_CANCEL") {
        if (iUserValue === "Cancel") {
            await updateAppointment("Status", "Cancelled", Appointment_ID);
            await updateAppointment("Is_Active", 0, Appointment_ID);
            // Get the POC ID, appointment date, and time from the appointment details  
            const appointmentDetails = await getAppointmentDetailsByAppointmentId(Appointment_ID);
            const jsonData = await getAppointmentJsonData(Appointment_ID);
            jsonData["Poc_ID"] = appointmentDetails[0].POC_ID;
            jsonData["Appointment_Date"] = appointmentDetails[0].Appointment_Date;
            jsonData["Appointment_Time"] = appointmentDetails[0].Appointment_Time;
            logger.info(` ${jsonData["Poc_ID"]}  ${jsonData["Appointment_Date"]} ${jsonData["Appointment_Time"]}`);
            // Increase the appointments_per_slot available by one  
            await increaseAvailableSlots(jsonData);
            // Send a cancellation message to the POC
            const pocMessage = await POCMessageForCancellationAndReschedule(iClientId, "APPOINTMENT_CANCELLATION", Appointment_ID, userData);
            if (pocMessage !== null) {
                // Retrieve the POC's contact number
                const pocDetails = await getPocDetailsByPocId(jsonData["Poc_ID"]);
                const pocContactNumber = pocDetails.Contact_Number;
                // Send cancellation message to the POC
                await sendWhatsAppMessage(pocContactNumber, pocMessage);
            }
            await sendWhatsAppMessage(from, "Appointment cancelled successfully.");
            logger.info("Appointment cancelled successfully");
            await sendWhatsAppMessage(from, `Please type "hi" to start again`);
        }
        return null;
    } else if (iAction[1] === "FETCH_APPOINTMENT_DETAILS_RESCHEDULE") {
        //Ashok: Why we need separate fetch appointment for Cancel and resudule?  
        const appointmentDetails = await getAppointmentDetailsByUserID(userData.User_ID);
        logger.info(appointmentDetails);
        if (appointmentDetails && appointmentDetails.length > 0) {
            const appointments = appointmentDetails.map((appointment, index) => {
                Appointment_ID = appointment.Appointment_ID;
                return {
                    id: appointment.Appointment_ID,
                    text: `Appointment ID: ${appointment.Appointment_ID}, Appointment Type: ${appointment.Appointment_Type}, Date: ${appointment.Appointment_Date}, Time: ${appointment.Appointment_Time}`,
                    rescheduleOptions: [
                        { CLIENT_ID: iClientId, MENU_ID: iMenuId, ITEM_ID: "Reschedule", MENU_NAME: "Reschedule", },
                        { CLIENT_ID: iClientId, MENU_ID: 0, ITEM_ID: "Back", MENU_NAME: "Back", },
                    ],
                };
            });

            for (const appointment of appointments) {
                const rescheduleItems = appointment.rescheduleOptions.map((item) => ({ id: item.CLIENT_ID + "~" + item.MENU_ID + "~" + item.ITEM_ID + "~" + appointment.id + "|" + iClientId + "~" + iMenuId + "~" + iSelectId, title: item.MENU_NAME, }));
                await sendInteractiveMessage(from, appointment.text, rescheduleItems);
            }
        } else {
            await sendWhatsAppMessage(from, "No appointment found.");
            logger.info("No appointment found");
        }
        return null;
    } else if (iAction[1] === "RESCHEDULE_DATE") {
        // Get the appointment details  
        const appointmentDetails = await getAppointmentDetailsByAppointmentId(Appointment_ID);
        logger.info(appointmentDetails);
        const jsonData = await getAppointmentJsonData(Appointment_ID);
        jsonData["Poc_ID"] = appointmentDetails[0].POC_ID;
        jsonData["Appointment_Type"] = appointmentDetails[0].Appointment_Type;
        jsonData["Appointment_Date"] = appointmentDetails[0].Appointment_Date;
        jsonData["Appointment_Time"] = appointmentDetails[0].Appointment_Time;

        // Update the existing appointment status as rescheduled and make it inactive  
        await updateAppointment("Is_Active", 0, Appointment_ID);
        await updateAppointment("Status", "Rescheduled", Appointment_ID);

        // Send a reschedule confirmation message to the POC
        const pocMessage = await POCMessageForCancellationAndReschedule(iClientId, "APPOINTMENT_RESCHEDULE", Appointment_ID, userData);
        if (pocMessage !== null) {
            // Retrieve the POC's contact number
            const pocDetails = await getPocDetailsByPocId(await getAppointmentJsonDataByKey(Appointment_ID, "Poc_ID"));
            const pocContactNumber = pocDetails.Contact_Number;
            // Send reschedule confirmation message to the POC
            await sendWhatsAppMessage(pocContactNumber, pocMessage);
        }

        //Update the available slots  
        await increaseAvailableSlots(jsonData);

        // Create a new appointment with the new time and date  
        Appointment_ID = await insertAppointment(iClientId, userData.User_ID);
        logger.info("New Appointment id : " + Appointment_ID);
        logger.info(`Appointment Type: ${jsonData["Appointment_Type"]} POC_ID: '${jsonData["Poc_ID"]}`);
        await updateAppointment("Appointment_Type", jsonData["Appointment_Type"], Appointment_ID);
        await updateAppointmentJsonData(Appointment_ID, "Appointment_Type", jsonData["Appointment_Type"]);
        await updateAppointment("POC_ID", jsonData["Poc_ID"], Appointment_ID);
        await updateAppointmentJsonData(Appointment_ID, "Poc_ID", jsonData["Poc_ID"]);

        // Get the available dates for rescheduling  
        const availableDates = await getAvailableDates(iClientId, iMenuId, await getAppointmentJsonDataByKey(Appointment_ID, "Poc_ID"));
        // Send the available dates to the user  
        const dateOptions = availableDates.map((date) => ({ id: date.CLIENT_ID + "~" + date.MENU_ID + "~" + date.ITEM_ID + "~" + Appointment_ID + "|" + iClientId + "~" + iMenuId + "~" + iSelectId, title: date.MENU_NAME, }));
        await sendRadioButtonMessage(from, "Select a new date:", dateOptions);

        return null;
    } else if (iAction[1] === "CONFIRM_RESCHEDULE") {
        await updateAppointment("Appointment_Date", await getAppointmentJsonDataByKey(Appointment_ID, "Appointment_Date"), Appointment_ID);
        await updateAppointment("Appointment_Time", await getAppointmentJsonDataByKey(Appointment_ID, "Appointment_Time"), Appointment_ID);
        let confirmationMessage = await getTemplateMessage(iClientId, iAction[1]);
        const jsonData = await getAppointmentJsonData(Appointment_ID);
        confirmationMessage = confirmationMessage.replace("[User_Name]", userData.User_Name || "");
        confirmationMessage = confirmationMessage.replace("[User_Email]", userData.User_Email || "");
        confirmationMessage = confirmationMessage.replace("[User_Location]", userData.User_Location || "");
        confirmationMessage = confirmationMessage.replace("[Appointment_Type]", jsonData["JSON_DATA"]["Appointment_Type"] || "");
        confirmationMessage = confirmationMessage.replace("[Appointment_Date]", jsonData["JSON_DATA"]["Appointment_Date"] || "");
        confirmationMessage = confirmationMessage.replace("[Appointment_Time]", jsonData["JSON_DATA"]["Appointment_Time"] || "");
        await sendWhatsAppMessage(from, confirmationMessage);
        const confirmationOptions = [
            { CLIENT_ID: iClientId, MENU_ID: iMenuId, ITEM_ID: "Confirm", Appointment_ID: Appointment_ID, MENU_NAME: "Confirm", },
            { CLIENT_ID: iClientId, MENU_ID: iMenuId, ITEM_ID: "Cancel_Reschedule_Request", Appointment_ID: Appointment_ID, MENU_NAME: "Cancel Request", },
        ];
        // Return formatted list of options  
        return confirmationOptions;
    } else if (iAction[1] === "FINALIZE_RESCHEDULE") {
        if (iUserValue === "Confirm") {
            await updateAppointment("Status", "Confirmed", Appointment_ID);
            await updateAppointment("Is_Active", 1, Appointment_ID);
            // Update the appointments_per_slot  
            await updateAvailableSlots(await getAppointmentJsonData(Appointment_ID));
            let finalizeMessage = await getTemplateMessage(iClientId, iAction[1]);
            finalizeMessage = finalizeMessage.replace("[Appointment_ID]", Appointment_ID || "");
            // Send a confirmation message to the user  
            await sendWhatsAppMessage(from, finalizeMessage);
            logger.info("Appointment rescheduled successfully");
            await sendWhatsAppMessage(from, `Please type "hi" to start again`);
        } else if (iUserValue === "Cancel Request") {
            let cancel_message = await getTemplateMessage(iClientId, iSelectId);
            await sendWhatsAppMessage(from, cancel_message);
            logger.info("Appointment reschedule request cancelled");
        }
        return null;
    } else {
        logger.info("handleAction:inside Else");
    }
}

//Function to send a confirmation message to the user  
async function confirmAppointment(iClientId, iAction, Appointment_ID, userData) {
    let confirmationMessage = await getTemplateMessage(iClientId, iAction[2]);
    const jsonData = await getAppointmentJsonData(Appointment_ID);

    // Log the JSON data properly
    logger.info(`JSON Data: ${JSON.stringify(jsonData["JSON_DATA"], null, 2)}`);

    // Replace each placeholder  
    confirmationMessage = confirmationMessage.replace("[User_Name]", userData.User_Name || "");
    confirmationMessage = confirmationMessage.replace("[User_Email]", userData.User_Email || "");
    confirmationMessage = confirmationMessage.replace("[User_Location]", userData.User_Location || "");
    confirmationMessage = confirmationMessage.replace("[Appointment_Type]", jsonData["JSON_DATA"]["Appointment_Type"] || "");
    confirmationMessage = confirmationMessage.replace("[Department]", jsonData["JSON_DATA"]["Department"] || "");
    confirmationMessage = confirmationMessage.replace("[POC]", jsonData["JSON_DATA"]["Poc_name"] || "");
    confirmationMessage = confirmationMessage.replace("[Appointment_Date]", jsonData["JSON_DATA"]["Appointment_Date"] || "");
    confirmationMessage = confirmationMessage.replace("[Appointment_Time]", jsonData["JSON_DATA"]["Appointment_Time"] || "");
    confirmationMessage = confirmationMessage.replace("[Emergency_Reason]", jsonData["JSON_DATA"]["Emergency_Reason"] || "");

    return confirmationMessage;
}


// Function to send a final confirmation message to the user  
async function finalizeAppointment(iClientId, iAction, Appointment_ID, userData) {
    await updateAppointment("Status", "Confirmed", Appointment_ID);
    await updateAppointment("Is_Active", 1, Appointment_ID);

    const jsonData = await getAppointmentJsonData(Appointment_ID);

    if (jsonData && jsonData["JSON_DATA"]) {
        logger.info(`JSON Data: ${JSON.stringify(jsonData["JSON_DATA"], null, 2)}`);
        if (jsonData["JSON_DATA"]["Appointment_Type"] !== "Emergency") {
            await updateAvailableSlots(jsonData);
        }
    } else {
        logger.warn("No JSON data available for the appointment.");
    }

    const clientDetails = await getClientDetails(iClientId);
    const clientLocation = clientDetails.Location_URL;
    const clientName = clientDetails.Client_Name;
    const appointmentDetails = await getAppointmentDetailsByAppointmentId(Appointment_ID);
    const paymentStatus = appointmentDetails[0].Payment_Status;

    let finalizeMessage = await getTemplateMessage(iClientId, iAction[2]);
    finalizeMessage = finalizeMessage.replace("[Appointment_ID]", Appointment_ID || "");
    const meetLink = jsonData && jsonData["JSON_DATA"] ? await getMeetLink(jsonData["JSON_DATA"]["Poc_ID"]) : "";
    finalizeMessage = finalizeMessage.replace("[Meet_Link]", meetLink || "");
    finalizeMessage = finalizeMessage.replace("[Location]", clientLocation || "");
    finalizeMessage = finalizeMessage.replace("[User_Name]", userData.User_Name || "");
    finalizeMessage = finalizeMessage.replace("[Appointment_Type]", jsonData["JSON_DATA"]["Appointment_Type"] || "");
    finalizeMessage = finalizeMessage.replace("[Department]", jsonData["JSON_DATA"]["Department"] || "");
    finalizeMessage = finalizeMessage.replace("[POC]", jsonData["JSON_DATA"]["Poc_name"] || "");
    finalizeMessage = finalizeMessage.replace("[Appointment_Date]", jsonData["JSON_DATA"]["Appointment_Date"] || "");
    finalizeMessage = finalizeMessage.replace("[Appointment_Time]", jsonData["JSON_DATA"]["Appointment_Time"] || "");
    finalizeMessage = finalizeMessage.replace("[Payment_Status]", paymentStatus || "");
    finalizeMessage = finalizeMessage.replace("[Client_Name]", clientName || "");
    return finalizeMessage;
}


async function POCMessage(iClientId, iAction, Appointment_ID, userData) {
    const jsonData = await getAppointmentJsonData(Appointment_ID);
    let pocMessageTemplate = "";
    if (jsonData && jsonData["JSON_DATA"]) {
        if (jsonData["JSON_DATA"]["Appointment_Type"] == "Direct Consultation") {
            pocMessageTemplate = await getTemplateMessage(iClientId, "APPOINTMENT_CONFIRMATION_DIRECT");
        } else if (jsonData["JSON_DATA"]["Appointment_Type"] == "Tele Consultation") {
            pocMessageTemplate = await getTemplateMessage(iClientId, "APPOINTMENT_CONFIRMATION_TELE");
        } else {
            return null;
        }
    }


    // Replace placeholders in the message template
    let pocMessage = pocMessageTemplate.replace("[PATIENT_NAME]", userData.User_Name || "");
    pocMessage = pocMessage.replace("[POC_NAME]", jsonData["JSON_DATA"]["Poc_name"] || "");
    pocMessage = pocMessage.replace("[APPOINTMENT_DATE]", jsonData["JSON_DATA"]["Appointment_Date"] || "");
    pocMessage = pocMessage.replace("[APPOINTMENT_TIME]", jsonData["JSON_DATA"]["Appointment_Time"] || "");
    pocMessage = pocMessage.replace("[APPOINTMENT_TYPE]", jsonData["JSON_DATA"]["Appointment_Type"] || "");
    const meetLink = jsonData && jsonData["JSON_DATA"] ? await getMeetLink(jsonData["JSON_DATA"]["Poc_ID"]) : "";
    pocMessage = pocMessage.replace("[MEET_LINK]", meetLink || "");
    return pocMessage;
}

async function POCMessageForCancellationAndReschedule(iClientId, templateName, Appointment_ID, userData) {
    const jsonData = await getAppointmentJsonData(Appointment_ID);
    let pocMessageTemplate = await getTemplateMessage(iClientId, templateName);
    // Replace placeholders in the message template
    let pocMessage = pocMessageTemplate.replace("[PATIENT_NAME]", userData.User_Name || "");
    pocMessage = pocMessage.replace("[POC_NAME]", jsonData["JSON_DATA"]["Poc_name"] || "");
    pocMessage = pocMessage.replace("[APPOINTMENT_DATE]", jsonData["JSON_DATA"]["Appointment_Date"] || "");
    pocMessage = pocMessage.replace("[APPOINTMENT_TIME]", jsonData["JSON_DATA"]["Appointment_Time"] || "");
    pocMessage = pocMessage.replace("[APPOINTMENT_TYPE]", jsonData["JSON_DATA"]["Appointment_Type"] || "");
    return pocMessage;
}



async function sendWelcomeMessage(from, clientId, userData) {
    const welcomeMessage = await getWelcomeMessage(clientId);
    await sendWhatsAppMessage(from, `Hi ${userData.User_Name}, ${welcomeMessage}`);
    logger.info(`Welcome message sent to ${from}`);

    const mainMenuItems = await getMainMenu(clientId, 0);
    const headerMessage = mainMenuItems[0].HEADER_MESSAGE;
    const menuNames = mainMenuItems.map((item) => ({ id: item.CLIENT_ID + "~" + item.MENU_ID + "~" + item.MENU_ID + "|" + item.CLIENT_ID + "~" + item.MENU_ID + "~" + item.MENU_ID, title: item.MENU_NAME, }));
    const imagePath = await getImagePath(clientId, 'welcome');
    console.log(`imagePath: ${imagePath}`);
    await sendInteractiveMessageWithImage(from, headerMessage, menuNames, imagePath);
    logger.info(`Main menu sent to ${from}`);
    logger.info(`user Id: ${userData.User_ID}`);
}

//Method to send Back Button message  
async function sendBackButton(from, previousId, Appointment_ID, mainMenuItems) {
    const backmessage = [
        { id: previousId + "~" + Appointment_ID + "|" + mainMenuItems[0].CLIENT_ID + "~" + mainMenuItems[0].MENU_ID + "~" + mainMenuItems[0].ITEM_ID, title: "Back", },
    ];
    await sendBackButtonMessage(from, backmessage);
    logger.info(`Back button sent to ${from}`);
}


async function updateTransaction(paymentId, data) {
    const connection = db.getConnection();
    const query = `UPDATE transactions SET ? WHERE transaction_id = ?`;
    const values = [data, paymentId];
    await connection.promise().query(query, values);
}


const authInstance = require('../services/razorpay');
async function generatePaymentLink(Appointment_ID, userData, from) {
    // Fetch the POC details
    const pocDetails = await getPocFeeDetails(Appointment_ID);

    // Fetch the fees amount from the POC details
    const feesAmount = pocDetails.Fees;
    const data = {
        amount: feesAmount * 100,
        currency: 'INR',
        description: 'Payment for appointment',
        customer: {
            name: userData.User_Name,
            email: userData.User_Email,
            contact: from,
        },
        notify: {
            sms: true,
            email: true,
        },
        reminder_enable: true,
        notes: {
            from: from,
        },
    };

    const response = await authInstance.post('', data);
    const paymentLink = response.data.short_url;
    const paymentId = response.data.id;

    if (paymentId) {
        // Insert transaction into database with the payment ID    
        await insertTransaction(Appointment_ID, paymentId);
    } else {
        console.error('Payment ID is null or undefined');
    }

    return { paymentLink, transactionId: paymentId, feesAmount };
}
async function getPocFeeDetails(Appointment_ID) {
    const connection = db.getConnection();
    const query = `SELECT * FROM poc WHERE POC_ID = (SELECT POC_ID FROM appointments WHERE Appointment_ID = ?)`;
    const values = [Appointment_ID];
    const result = await connection.promise().query(query, values);
    return result[0][0];
}


async function insertTransaction(Appointment_ID, transactionId) {
    const connection = db.getConnection();
    const query = `INSERT INTO transactions (appointment_id, transaction_id, status) VALUES (?, ?, ?)`;
    const values = [Appointment_ID, transactionId, 'pending'];
    await connection.promise().query(query, values);
}
async function getPaymentStatusByTransactionId(transactionId) {
    const connection = db.getConnection();
    const query = `SELECT status FROM transactions WHERE transaction_id = ?`;
    const values = [transactionId];
    const result = await connection.promise().query(query, values);
    if (result[0].length > 0) {
        return result[0][0].status;
    } else {
        return null;
    }
}