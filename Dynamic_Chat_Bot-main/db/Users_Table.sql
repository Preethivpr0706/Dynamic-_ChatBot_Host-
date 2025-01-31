-- Users Table

CREATE TABLE Users (
    User_ID INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    User_Name VARCHAR(100),
    User_Contact VARCHAR(20) UNIQUE,
    User_Email VARCHAR(100),
    User_Location VARCHAR(500)
);
