-- Templates table:

INSERT INTO Templates (TEMPLATE_ID, CLIENT_ID, TEMPLATE_NAME, TEMPLATE_TEXT) VALUES
(1, 1, 'CONFIRM_DIRECT', 'Here are your appointment details:\r\n *Name:* [User_Name]\r\n *Email:* [User_Email]\n\r *Location:* [User_Location]\n\r *Appointment Type:* [Appointment_Type]\n\r *Department:* [Department]\n\r *Doctor:* [POC]\n\r *Appointment Date:* [Appointment_Date]\n\r *Appointment Time:* [Appointment_Time]'),
(2, 1, 'FINALIZE_DIRECT', 'Appointment confirmed. *Your Appointment ID:* [Appointment_ID]'),
(3, 1, 'CONFIRM_EMERGENCY', 'Here are your appointment details:\n\r \r*Name:* [User_Name]\n\r *Email:* [User_Email]\n\r *Location:* [User_Location]\n\r *Appointment Type:* [Appointment_Type]\n\r *Emergency Reason:* [Emergency_Reason]'),
(4, 1, 'FINALIZE_EMERGENCY', 'Appointment confirmed. We are waiting for your arrival!!!'),
(5, 1, 'FINALIZE_TELE', 'Appointment confirmed. *Your Appointment ID:* [Appointment_ID]\n\r  Your *G-meet Link* is given below! \n \n [Meet_Link]'),
(6, 1, 'Cancel_Appointment_Request', 'Your appointment request has been *cancelled*. You can start over if you\'d like to make a new appointment.'),
(7, 1, 'CONFIRM_CHECKUP', 'Here are your appointment details:\r \r\n *Name:* [User_Name]\n\r *Email:* [User_Email]\n\r *Location:* [User_Location]\r\n *Appointment Type:* [Appointment_Type]\r\n *Appointment Date:* [Appointment_Date]\r\n *Appointment Time:* [Appointment_Time]'),
(8, 1, 'Live_Location', '📍 To assist you better, please share your live location.\n\nHere’s how to share your location on WhatsApp:\n1️⃣ Open your chat with us.\n2️⃣ Tap the 📎 (Attachment) icon.\n3️⃣ Select "Location."\n4️⃣ Choose "Share Live Location" and select the duration you\'d like to share for.\n\nThank you for helping us serve you better! 😊'),
(9, 1, 'CONFIRM_RESCHEDULE', 'Here are your appointment details:\r\n \r *Name:* [User_Name]\r\n *Email:* [User_Email]\r\n *Location:* [User_Location]\r\n *Appointment Type:* [Appointment_Type]\n\r *Appointment Date:* [Appointment_Date]\n\r *Appointment Time:* [Appointment_Time]'),
(10, 1, 'FINALIZE_RESCHEDULE', 'Appointment rescheduled successfully. Your *New Appointment ID:* [Appointment_ID]'),
(11, 1, 'CONFIRM_TELE', 'Here are your appointment details:\r\n *Name:* [User_Name]\r\n *Email:* [User_Email]\n\r *Location:* [User_Location]\n\r *Appointment Type:* [Appointment_Type]\n\r *Department:* [Department]\n\r *Doctor:* [POC]\n\r *Appointment Date:* [Appointment_Date]\n\r *Appointment Time:* [Appointment_Time]'),
(12, 1, 'FINALIZE_CHECKUP', 'Appointment confirmed. *Your Appointment ID:* [Appointment_ID]'),
(13, 2, 'FINALIZE', 'Appointment confirmed. Your *Appointment ID:* [Appointment_ID]'),
(14, 2, 'CONFIRM', 'Here are your appointment details:\r\n \r *Name:* [User_Name]\r\n *Email:* [User_Email]\r\n *Location:* [User_Location]\r\n *Doctor:* [POC]\n\r *Appointment Date:* [Appointment_Date]\n\r *Appointment Time:* [Appointment_Time]');
