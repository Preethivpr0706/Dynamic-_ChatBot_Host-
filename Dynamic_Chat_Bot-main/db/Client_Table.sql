create database chatbotdynamic;
use chatbotdynamic;


-- Client table:
CREATE TABLE Client (
    Client_ID INT PRIMARY KEY AUTO_INCREMENT,
    Client_Name VARCHAR(100),
    Location VARCHAR(255),
    Contact_Number VARCHAR(20),
    Email VARCHAR(100)
);
