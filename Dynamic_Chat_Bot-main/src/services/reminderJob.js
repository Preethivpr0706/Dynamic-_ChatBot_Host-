const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const cron = require('node-cron');

const path = require('path');
const dotenv = require('dotenv');

// Explicitly set the path to the .env file in the project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });


const { fetchUpcomingAppointments, getTemplateMessage } = require('../controllers/dbController');
const { connectDB } = require('../config/db');

connectDB();


// WhatsApp API Config
const WHATSAPP_API_URL = `https://graph.facebook.com/v13.0/423177220884486/messages`
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_TOKEN;



// Send WhatsApp Reminder Function
async function sendWhatsAppReminder(phone, customerName, doctorName, date, time, client_name, client_email, mediaId, userReminderTemplateName) {
    try {
        const response = await axios.post(
            WHATSAPP_API_URL, {
                messaging_product: "whatsapp",
                to: phone,
                type: "template",
                template: {
                    name: userReminderTemplateName, // template name is fetched from table table
                    language: { code: "en" },
                    components: [{
                            type: "header",
                            parameters: [{
                                type: "image",
                                image: {
                                    id: mediaId, // Use the uploaded image's media ID
                                },
                            }, ],
                        },
                        {
                            type: "body",
                            parameters: [
                                { type: "text", text: customerName }, // {{1}}
                                { type: "text", text: doctorName }, // {{2}}
                                { type: "text", text: date }, // {{3}}
                                { type: "text", text: time }, // {{4}}
                                { type: "text", text: client_name }, // {{5}}
                                { type: "text", text: client_email }, // {{6}}
                            ],
                        },
                    ],
                },
            }, {
                headers: {
                    Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                    "Content-Type": "application/json",
                },
            }
        );
        console.log(`Reminder sent to ${phone}:`, response.data);
    } catch (error) {
        console.error(`Failed to send reminder to ${phone}:`, error.response ? error.response.data : error.message);
    }
}

// Cron Job to Check and Send Reminders
cron.schedule("* * * * *", async() => {
    console.log("Checking for upcoming appointments...");
    try {
        const appointments = await fetchUpcomingAppointments();

        for (const appointment of appointments) {
            const {
                customer_name,
                phone_number,
                Appointment_Date,
                Appointment_Time,
                Appointment_Type,
                Appointment_ID,
                doctor_name,
                poc_phone,
                client_name,
                client_email,
                client_id
            } = appointment;

            // Format date and time for the message
            const date = new Date(Appointment_Date).toLocaleDateString();
            const time = Appointment_Time; // Assuming already in HH:MM format

            const imagePath = './../../images/reminder.jpg';
            const mediaId = await uploadImage(imagePath);

            //template name fetching from template table
            const userReminderTemplateName = await getTemplateMessage(client_id, "USER_APPT_REMINDER");
            const pocReminderTemplateName = await getTemplateMessage(client_id, "POC_APPT_REMINDER");

            // Send WhatsApp reminder to Patient
            await sendWhatsAppReminder(phone_number, customer_name, doctor_name, date, time, client_name, client_email, mediaId, userReminderTemplateName);

            // Send WhatsApp reminder to POC
            await sendWhatsAppReminderToPOC(poc_phone, doctor_name, date, time, Appointment_Type, Appointment_ID, client_name, client_email, mediaId, pocReminderTemplateName);
        }
    } catch (error) {
        console.error("Error processing reminders:", error);
    }
});

// Reminder for POC Function
async function sendWhatsAppReminderToPOC(phone, doctorName, date, time, appointmentType, appointmentId, client_name, client_email, mediaId, pocReminderTemplateName) {
    try {
        const response = await axios.post(
            WHATSAPP_API_URL, {
                messaging_product: "whatsapp",
                to: phone,
                type: "template",
                template: {
                    name: pocReminderTemplateName, // template name is fetched from table table
                    language: { code: "en" },
                    components: [{
                            type: "header",
                            parameters: [{
                                type: "image",
                                image: {
                                    id: mediaId, // Use the uploaded image's media ID
                                },
                            }],
                        },
                        {
                            type: "body",
                            parameters: [
                                { type: "text", text: doctorName }, // {{1}}
                                { type: "text", text: date }, // {{2}}
                                { type: "text", text: time }, // {{3}}
                                { type: "text", text: appointmentType }, // {{4}}
                                { type: "text", text: appointmentId }, // {{5}}
                                { type: "text", text: client_name }, // {{6}}
                                { type: "text", text: client_email }, // {{7}}
                            ],
                        },
                    ],
                },
            }, {
                headers: {
                    Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                    "Content-Type": "application/json",
                },
            }
        );
        console.log(`Reminder sent to POC ${phone}:`, response.data);
    } catch (error) {
        console.error(`Failed to send reminder to POC ${phone}:`, error.response ? error.response.data : error.message);
    }
}

async function uploadImage(filePath) {
    const url = `https://graph.facebook.com/v13.0/423177220884486/media`;
    const headers = {
        'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`
    };

    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath)); // Local path  
    formData.append('type', 'image/png'); // Specify the MIME type  
    formData.append('messaging_product', 'whatsapp'); // Add the missing parameter  

    try {
        const response = await axios.post(url, formData, { headers: {...headers, ...formData.getHeaders() } });
        console.log('Image uploaded successfully:', response.data); // Log at the debug level  
        return response.data.id; // This is the media ID  
    } catch (error) {
        console.log('Error uploading image:', error.response ? error.response.data : error.message); // Log at the error level  
    }
}