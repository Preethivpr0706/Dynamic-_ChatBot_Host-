-- POC_Schedules
CREATE TABLE POC_Schedules (
    Schedule_ID INT PRIMARY KEY AUTO_INCREMENT,
    POC_ID INT,
    Day_of_Week ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'),
    Start_Time TIME,
    End_Time TIME,
    appointments_per_slot INT,
    slot_duration INT
);
