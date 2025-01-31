// utils.js  
const axios = require('axios');

const path = require('path');

const logger = require('../config/Logger'); // Import the logger  

const path = require('path');
const dotenv = require('dotenv');

// Explicitly set the path to the .env file in the project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });



// Function to validate email format  
const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // Simple regex for email validation  
    return re.test(String(email).toLowerCase());
};

// Function to send a plain text WhatsApp message  
async function sendWhatsAppMessage(to, message) {
    const url = `https://graph.facebook.com/v13.0/${process.env.PHONE_NUMBER_ID}/messages`;
    const headers = {
        'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`, // Use the correct token  
        'Content-Type': 'application/json'
    };
    const data = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: message }
    };

    try {
        await axios.post(url, data, { headers });
        logger.info('Message sent successfully'); // Log at the info level  
    } catch (error) {
        console.log('Error sending message:', error);
        logger.error('Error sending message:', error.response ? error.response.data : error.message); // Log at the error level  
    }
}

// Function to send a button message (interactive message)  
async function sendInteractiveMessageWithImage(to, bodyText, buttons, filePath) {
    const mediaId = await uploadImage(filePath);
    // Ensure there's at least one button  
    if (buttons.length === 0) {
        logger.error('No buttons provided for interactive message.'); // Log at the error level  
        return; // Exit if no buttons are provided  
    }

    // Limit the number of buttons to 3  
    const limitedButtons = buttons.slice(0, 3);
    const url = `https://graph.facebook.com/v13.0/${process.env.PHONE_NUMBER_ID}/messages`;
    const headers = {
        'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`, // Use the correct token  
        'Content-Type': 'application/json'
    };
    const data = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'interactive',
        interactive: {
            type: 'button',
            header: {
                type: 'image',
                image: {
                    id: mediaId
                }
            },
            body: {
                text: bodyText
            },
            action: {
                buttons: limitedButtons.map((button) => ({
                    type: 'reply',
                    reply: {
                        id: button.id,
                        title: button.title
                    }
                }))
            }

        }
    };

    try {
        await axios.post(url, data, { headers });
        logger.info('Interactive message sent successfully'); // Log at the info level  
    } catch (error) {
        logger.error('Error sending interactive message:', error.response ? error.response.data : error.message); // Log at the error level  
    }
}

const fs = require('fs');
const FormData = require('form-data');

async function uploadImage(filePath) {
    const url = `https://graph.facebook.com/v13.0/${process.env.PHONE_NUMBER_ID}/media`;
    const headers = {
        'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`
    };

    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath)); // Local path  
    formData.append('type', 'image/png'); // Specify the MIME type  
    formData.append('messaging_product', 'whatsapp'); // Add the missing parameter  

    try {
        const response = await axios.post(url, formData, { headers: {...headers, ...formData.getHeaders() } });
        logger.debug('Image uploaded successfully:', response.data); // Log at the debug level  
        return response.data.id; // This is the media ID  
    } catch (error) {
        logger.error('Error uploading image:', error.response ? error.response.data : error.message); // Log at the error level  
    }
}

// Function to send a radio button message (list message)  
async function sendRadioButtonMessage(to, headerText, options) {

    const url = `https://graph.facebook.com/v13.0/${process.env.PHONE_NUMBER_ID}/messages`;
    const headers = {
        'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
    };

    // Function to truncate title to 24 characters  
    const truncateTitle = (title) => {
        return title.length > 24 ? title.substring(0, 24) : title;
    };

    const data = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'interactive',
        interactive: {
            type: 'list',

            header: {
                type: 'text',
                text: " "
            },
            body: {
                text: headerText || "Choose an option below"
            },
            action: {
                button: 'Select',
                sections: [{
                    title: 'Options',
                    rows: options.map((option) => ({
                        id: option.id, // Option IDs should be unique and consistent  
                        title: truncateTitle(option.title) // Truncate title if necessary  
                    }))
                }]
            }
        }
    };

    try {
        await axios.post(url, data, { headers });
        logger.info('Radio button message sent successfully'); // Log at the info level  
    } catch (error) {
        logger.error('Error sending radio button message:', error.response ? error.response.data : error.message); // Log at the error level  
    }
}

// Function to send a button message (interactive message)  
async function sendBackButtonMessage(to, buttons) {
    // Ensure there's at least one button  
    if (buttons.length === 0) {
        logger.error('No buttons provided for interactive message.'); // Log at the error level  
        return; // Exit if no buttons are provided  
    }

    // Limit the number of buttons to 3  
    const limitedButtons = buttons.slice(0, 3);
    const url = `https://graph.facebook.com/v13.0/${process.env.PHONE_NUMBER_ID}/messages`;
    const headers = {
        'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`, // Use the correct token  
        'Content-Type': 'application/json'
    };
    const data = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'interactive',
        interactive: {
            type: 'button',
            body: {
                text: 'Please click this button to go back'
            },
            action: {
                buttons: limitedButtons.map((button) => ({
                    type: 'reply',
                    reply: {
                        id: button.id,
                        title: button.title
                    }
                }))
            }

        }
    };

    try {
        await axios.post(url, data, { headers });
        logger.info('Interactive message sent successfully'); // Log at the info level  
    } catch (error) {
        logger.error('Error sending interactive message:', error.response ? error.response.data : error.message); // Log at the error level  
    }
}



async function sendInteractiveMessageWithDescription(to, sections, buttons, headerMessage) {

    // Ensure there's at least one button   
    if (buttons.length === 0) {
        logger.error('No buttons provided for interactive message.'); // Log at the error level  
        return; // Exit if no buttons are provided   
    }

    // Limit the number of buttons to 3   
    const limitedButtons = buttons.slice(0, 3);
    const url = `https://graph.facebook.com/v13.0/${process.env.PHONE_NUMBER_ID}/messages`;
    const headers = {
        'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`, // Use the correct token   
        'Content-Type': 'application/json'
    };

    const data = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'interactive',
        interactive: {
            type: 'button',
            header: {
                type: 'text',
                text: headerMessage
            },
            body: {
                text: sections.map((section) => `${section.title}\n${section.description}`).join('\n\n')
            },
            action: {
                buttons: limitedButtons.map((button) => ({
                    type: 'reply',
                    reply: {
                        id: button.id,
                        title: button.title
                    }
                }))
            }
        }
    };

    try {
        await axios.post(url, data, { headers });
        logger.info('Interactive message sent successfully'); // Log at the info level  
    } catch (error) {
        logger.error('Error sending interactive message:', error.response ? error.response.data : error.message); // Log at the error level  
    }
}

// Function to send a button message (interactive message)  
async function sendInteractiveMessage(to, bodyText, buttons) {
    // Ensure there's at least one button  
    if (buttons.length === 0) {
        logger.error('No buttons provided for interactive message.'); // Log at the error level  
        return; // Exit if no buttons are provided  
    }

    // Limit the number of buttons to 3  
    const limitedButtons = buttons.slice(0, 3);
    const url = `https://graph.facebook.com/v13.0/${process.env.PHONE_NUMBER_ID}/messages`;
    const headers = {
        'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`, // Use the correct token  
        'Content-Type': 'application/json'
    };
    const data = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'interactive',
        interactive: {
            type: 'button',
            body: {
                text: bodyText
            },
            action: {
                buttons: limitedButtons.map((button) => ({
                    type: 'reply',
                    reply: {
                        id: button.id,
                        title: button.title
                    }
                }))
            }

        }
    };

    try {
        await axios.post(url, data, { headers });
        logger.info('Interactive message sent successfully'); // Log at the info level  
    } catch (error) {
        logger.error('Error sending interactive message:', error.response ? error.response.data : error.message); // Log at the error level  
    }
}

// utils/webhookParser.js
async function parseWebhookData(body) {
    try {
        if (!body.object || !body.entry || !body.entry[0].changes) {
            logger.error('Invalid webhook data:', body);
            return null;
        }

        const entry = body.entry[0];
        const changes = entry.changes[0].value;

        // Check if messages exist  
        // Check if messages exist  
        if (!changes || !changes.messages || changes.messages.length === 0) {
            //logger.info('No messages in webhook data:', body);
            return null;
        }

        if (!changes.messages[0]) {
            //logger.info('No messages in webhook data:', body);
            return { changes, displayPhoneNumber: null, phoneNumberId: null, from: null, messageBody: null, messageType: null, message: null };
        }

        const message = changes.messages[0];
        const metadata = changes.metadata || {};
        const displayPhoneNumber = metadata.display_phone_number || null;
        const phoneNumberId = metadata.phone_number_id || null;

        const from = message.from || null;
        let messageBody = null;
        let messageType = null;

        if (message.interactive) {
            messageType = 'interactive';
            messageBody = message.interactive.button_reply ? message.interactive.button_reply.title : message.interactive.list_reply ? message.interactive.list_reply.title : null;
        } else if (message.text) {
            messageType = 'text';
            messageBody = message.text.body;
        }

        return { changes, displayPhoneNumber, phoneNumberId, from, messageBody, messageType, message };
    } catch (error) {
        logger.error('Error parsing webhook data:', error);
        return null;
    }
}




async function logMessageDetails(logger, from, messageBody, messageType) {
    logger.info(`Message received from: ${from}, Content: ${messageBody}`);
    logger.debug(`Message type: ${messageType}`);
}


async function getImagePath(clientId, imageType) {
    const directory = `./../../images/client${clientId}/`;

    if (fs.existsSync(directory)) {
        const files = fs.readdirSync(directory);

        // Find the first file that starts with the imageType
        const file = files.find(f => path.parse(f).name === imageType);

        if (file) {
            return path.join(directory, file); // Return the full path with the extension
        }
    }

    return null; // Return null if the file is not found
}


// Exporting functions  
module.exports = {
    validateEmail,
    sendWhatsAppMessage,
    sendInteractiveMessage,
    sendRadioButtonMessage,
    sendBackButtonMessage,
    sendInteractiveMessageWithDescription,
    sendInteractiveMessageWithImage,
    parseWebhookData,
    logMessageDetails,
    getImagePath
};