-- Appointments Table
CREATE TABLE Appointments (
    Client_ID INT,
    Appointment_ID INT PRIMARY KEY AUTO_INCREMENT,
    User_ID INT,
    POC_ID INT,
    Appointment_Date DATE,
    Appointment_Time TIME,
    Appointment_Type ENUM('Tele Consultation', 'Direct Consultation', 'Emergency' , 'Master Health Checkup') DEFAULT 'Direct Consultation',  
    Status ENUM('Confirmed', 'Rescheduled', 'Cancelled', 'Pending', 'Not_Availed') DEFAULT 'Pending',
    Is_Active BOOLEAN DEFAULT TRUE,
    Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    JSON_DATA JSON
);
