-- POC_Available_Slots Table
CREATE TABLE POC_Available_Slots (
    Slot_ID INT PRIMARY KEY AUTO_INCREMENT,
    POC_ID INT,
    Schedule_Date DATE,
    Start_Time TIME,
    End_Time TIME,
    appointments_per_slot INT,
    slot_duration INT,
   Active_Status ENUM('blocked', 'unblocked') DEFAULT 'unblocked'
);
