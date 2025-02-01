// pocView.js  
const {
    getPocDetails,
    getAppointmentDetailsForPocView,
    getAvailableDates,
    getAvailableTimes,
    getAppointmentJsonDataByKey,
    getAppointmentJsonData,
    updateAppointmentJsonData,
    getClientID,
    getTemplateMessage,
    updateAppointment,
    increaseAvailableSlots,
    insertAppointment,
} = require('../controllers/dbController');

const {
    sendWhatsAppMessage,
    sendInteractiveMessage,
    sendInteractiveMessageWithImage,
    sendInteractiveMessageWithDescription,
    sendCancelRescheduleInteractiveMessage,
    sendRadioButtonMessage,
    sendBackButtonMessage,
} = require('../utils/utils');

const logger = require('../config/Logger');


exports.handlePocView = async(req, res, webhookData) => {
    const { from, messageBody, messageType, displayPhoneNumber } = webhookData;
    logger.info(`Handling POC view for: ${from}`);
    try {

        if (messageType === "text") {
            // Get client ID based on the display phone number  
            const clientId = await getClientID(displayPhoneNumber, from);
            logger.debug(`Client ID: ${clientId}`);
            if (clientId) {
                const pocDetails = await getPocDetails(clientId, from);
                logger.debug(`POC Details: ${JSON.stringify(pocDetails)}`);
                if (pocDetails) {
                    // Show welcome message for POC and two options  
                    const welcomeMessage = `Welcome, ${pocDetails.POC_NAME}!`;
                    const options = [{
                            id: clientId + "~" + "VIEW_APPOINTMENTS",
                            title: "View Appointments",
                        },
                        {
                            id: clientId + "~" + "UPDATE_UNAVAILABILITY",
                            title: "Update Availability",
                        },
                    ];
                    await sendInteractiveMessageWithImage(
                        from,
                        welcomeMessage,
                        options,
                        `../images/client${clientId}/poc1.jpg`);
                    logger.info("Welcome message sent successfully");
                }
            }
        } else {
            // Extract the title from the JSON data  
            const { message } = webhookData;
            let title = [];
            let Response_id = [];

            if (message.interactive) {
                const interactiveType = message.interactive.type;
                if (
                    interactiveType === "button_reply" &&
                    message.interactive.button_reply
                ) {
                    title = message.interactive.button_reply.title;
                    Response_id = message.interactive.button_reply.id;
                } else if (
                    interactiveType === "list_reply" &&
                    message.interactive.list_reply
                ) {
                    title = message.interactive.list_reply.title;
                    Response_id = message.interactive.list_reply.id;
                }
            }

            logger.info(`Title: ${title} ID: ${Response_id}`);
            Response_id = Response_id.split("~");
            const clientId = Response_id[0];
            const action = Response_id[1];
            const pageNumber = Response_id[2] ? parseInt(Response_id[2]) : 1;

            try {
                if (action === "VIEW_APPOINTMENTS") {
                    // Fetch appointments in format [date - time - no of appointments >0] (in interactive message with previous[<--] and next[-->] button which fetches in batch)  
                    const appointments = await getAppointmentDetailsForPocView(
                        clientId,
                        pageNumber,
                        10
                    );
                    logger.debug(`Appointments: ${JSON.stringify(appointments)}`);
                    if (typeof appointments === "object" && appointments.message) {
                        const sections = [{
                            title: appointments.message,
                            description: "",
                        }, ];
                        const options = [{
                                id: clientId + "~" + "VIEW_APPOINTMENTS" + "~" + (pageNumber - 1),
                                title: "<-- Previous",
                            },
                            {
                                id: clientId + "~" + "UPDATE_UNAVAILABILITY",
                                title: "Update availability",
                            },
                        ];
                        await sendInteractiveMessageWithDescription(
                            from,
                            sections,
                            options,
                            ""
                        );
                        logger.info("Appointments message sent successfully");
                    } else {
                        let sections = [];
                        appointments.forEach((appointment) => {
                            sections.push({
                                title: `${appointment.date} - ${appointment.time} - ${appointment.noOfAppointments}`,
                                description: appointment.day,
                            });
                        });
                        const options = [{
                                id: clientId + "~" + "VIEW_APPOINTMENTS" + "~" + (pageNumber - 1),
                                title: "<-- Previous",
                            },
                            {
                                id: clientId + "~" + "VIEW_APPOINTMENTS" + "~" + (pageNumber + 1),
                                title: "Next -->",
                            },
                            {
                                id: clientId + "~" + "UPDATE_UNAVAILABILITY",
                                title: "Update availability",
                            },
                        ];
                        const headerMessage = "Here are your booked slots:";
                        await sendInteractiveMessageWithDescription(
                            from,
                            sections,
                            options,
                            headerMessage
                        );
                        logger.info("Appointments sent successfully");
                    }
                } else if (action === "UPDATE_UNAVAILABILITY") {
                    // Handle update unavailability logic here  
                    logger.warn("Update unavailability logic not implemented");
                }
            } catch (error) {
                logger.error("Error fetching appointment details:", error);
                sendWhatsAppMessage(
                    from,
                    "Sorry, an error occurred while fetching the appointment details."
                );
            }
        }
        res.sendStatus(200);
    } catch (error) {
        logger.error("Error handling POC view:", error);
        res.status(500).send("Internal Server Error");
    }
};