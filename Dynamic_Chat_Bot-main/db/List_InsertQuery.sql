-- List Table

-- CLIENT 1
-- Insert Departments into List Table
INSERT INTO List (Client_ID, Key_name, Lang, Value_name, Display_Order)
VALUES
(1, 'DEPARTMENT', 'ENG', 'Cardiology', 1),
(1, 'DEPARTMENT', 'ENG', 'Orthopedics', 2),
(1, 'DEPARTMENT', 'ENG', 'Pediatrics', 3);

-- Insert Emergency Reasons into List Table
INSERT INTO List (Client_ID, Key_name, Lang, Value_name, Display_Order)
VALUES
(1, 'EMERGENCY_REASON', 'ENG', 'Heart Attack', 1),
(1, 'EMERGENCY_REASON', 'ENG', 'Accident', 2),
(1, 'EMERGENCY_REASON', 'ENG', 'Choking', 3);

-- Greetings
INSERT INTO List (Client_ID, Key_name, Lang, Value_name, Display_Order)
VALUES (1, 'GREETINGS','ENG',' Welcome to Miot Hospital😊',1);

-- Health Checkup
INSERT INTO List (Client_ID, Key_name, Lang, Value_name, Display_Order)
VALUES (1, 'HEALTH_CHECKUP','ENG','Master_Health_Checkup',1);

-- CLIENT 2
-- Greetings
INSERT INTO List (`Client_ID`, `Item_ID`, `Key_name`, `Lang`, `Value_name`, `Display_Order`) VALUES ('2', '9', 'GREETINGS', 'ENG', 'Welcome to HK Hospital😊', '1');
