-- List Table:
CREATE TABLE List (
    Client_ID INT,
    Item_ID INT PRIMARY KEY AUTO_INCREMENT,
    Key_name VARCHAR(50),  -- e.g., 'EMERGENCY_REASON', 'DEPARTMENT'
    Lang VARCHAR(10),  -- e.g., 'ENG'
    Value_name VARCHAR(255),
    Display_Order INT,
    UNIQUE (Client_ID, Key_name, Lang, Value_name)
);
