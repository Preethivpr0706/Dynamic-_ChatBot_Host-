const axios = require('axios');
const cron = require('node-cron');
const path = require('path');
const dotenv = require('dotenv');

// Explicitly set the path to the .env file in the project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { fetchCompletedAppointments, getTemplateMessage, updateFeedbackSentStatus } = require('../controllers/dbController');
const pool = require("../config/db"); // Import connection pool

// WhatsApp API Config
const WHATSAPP_API_URL = `https://graph.facebook.com/v13.0/549704921563564/messages`;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_TOKEN;

// Send WhatsApp Feedback Request Function
async function sendWhatsAppFeedbackRequest(phone, customerName, hospitalName, feedbackTemplateName) {
    try {
        const response = await axios.post(
            WHATSAPP_API_URL, {
                messaging_product: "whatsapp",
                to: phone,
                type: "template",
                template: {
                    name: feedbackTemplateName,
                    language: { code: "en" },
                    components: [{
                            type: "body",
                            parameters: [
                                { type: "text", text: customerName },
                                { type: "text", text: hospitalName }
                            ]
                        },
                        {
                            type: "button", // Note: singular "button", not "buttons"
                            sub_type: "flow",
                            index: "0" // The index of the button in your template
                        }
                    ]
                }
            }, {
                headers: {
                    Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                    "Content-Type": "application/json"
                }
            }
        );

        console.log(`✅ Feedback request sent to ${phone}:`, response.data);
        return true;

    } catch (error) {
        console.error(`❌ Failed to send feedback request to ${phone}:`,
            error.response ? error.response.data : error.message);
        return false;
    }
}

// Cron Job to Check Completed Appointments and Send Feedback Requests
// Run every two hours (0 */2 * * *)
cron.schedule("0 */2 * * *", async() => {
    console.log("Checking for completed appointments that need feedback requests...");
    try {
        // Fetch completed appointments where feedback hasn't been sent yet
        const appointments = await fetchCompletedAppointments();

        for (const appointment of appointments) {
            const {
                Appointment_ID,
                customer_name,
                phone_number,
                client_name,
                client_id
            } = appointment;

            // Get feedback template name from template table
            const feedbackTemplateName = await getTemplateMessage(client_id, "USER_FEEDBACK_FORM");

            // Send WhatsApp feedback request (no image needed for feedback template)
            const success = await sendWhatsAppFeedbackRequest(
                phone_number,
                customer_name,
                client_name, // Using client_name as hospital name
                feedbackTemplateName
            );

            if (success) {
                // Update the feedback_sent status in the appointment table
                await updateFeedbackSentStatus(Appointment_ID);
                console.log(`Feedback request sent and status updated for appointment ${Appointment_ID}`);
            }
        }
    } catch (error) {
        console.error("Error processing feedback requests:", error);
    }
});




// Manual trigger function for testing or specific appointments
async function sendManualFeedbackRequest(appointmentId) {
    try {
        // Fetch specific appointment
        const query = `
            SELECT a.Appointment_ID, u.User_Name as customer_name, u.User_Contact as phone_number,
                   c.Client_Name as client_name, a.Client_ID as client_id
            FROM appointments a
            JOIN client c ON a.Client_ID = c.Client_ID
            JOIN users u ON a.User_ID = u.User_ID
            WHERE a.Appointment_ID = ? AND a.Status = 'Availed' AND a.feedback_sent = 0
        `;
        const [appointment] = await pool.promise().execute(query, [appointmentId]);
        if (!appointment || appointment.length === 0) {
            console.error(`No eligible appointment found with ID: ${appointmentId}`);
            return false;
        }
        const appt = appointment[0];
        // Get feedback template name
        const feedbackTemplateName = await getTemplateMessage(appt.client_id, "USER_FEEDBACK_FORM");
        // Send WhatsApp feedback request
        const success = await sendWhatsAppFeedbackRequest(
            appt.phone_number,
            appt.customer_name,
            appt.client_name, // Using client_name as hospital name
            feedbackTemplateName
        );
        if (success) {
            // Update the feedback_sent status in the appointment table
            await updateFeedbackSentStatus(appt.Appointment_ID);
            console.log(`Feedback request sent and status updated for appointment ${appt.Appointment_ID}`);
            return true;
        }
        return false;
    } catch (error) {
        console.error(`Error sending manual feedback request for appointment ${appointmentId}:`, error);
        return false;
    }
}


module.exports = {
    sendManualFeedbackRequest
};