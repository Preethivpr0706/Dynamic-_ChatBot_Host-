-- POC Table:
CREATE TABLE POC (
    POC_ID INT PRIMARY KEY AUTO_INCREMENT,
    Client_ID INT,
    Department_ID INT,
    POC_Name VARCHAR(100),
    Specialization VARCHAR(100),
    Contact_Number VARCHAR(20),
    Email VARCHAR(100),
	Meet_Link VARCHAR (100)
);
