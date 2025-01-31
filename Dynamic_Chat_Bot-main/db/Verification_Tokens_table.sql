use chatbotdynamic;

CREATE TABLE verification_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  token VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE verification_tokens  
ADD COLUMN used_at TIMESTAMP NULL;  

ALTER TABLE poc ADD COLUMN Password VARCHAR(255);

ALTER TABLE chatbotdynamic.client ADD COLUMN Admin_Email VARCHAR(255);
 ALTER TABLE chatbotdynamic.client ADD COLUMN Admin_Password VARCHAR(255);
UPDATE `chatbotdynamic`.`client` SET `Admin_Email` = 'admin@gmail.com', `Admin_Password` = 'Admin123' WHERE (`Client_ID` = '1');

  


