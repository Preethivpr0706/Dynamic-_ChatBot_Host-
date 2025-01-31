-- POC Table

--CLIENT 1
-- Insert Doctors into POC Table
INSERT INTO POC (Client_ID, Department_ID, POC_Name, Specialization, Contact_Number, Email, Meet_Link)
VALUES
(1, 1, 'Dr. Harry Smith', 'Cardiology', '+917299817996', 'harishradhakrishnan2001@gmail.com', 'https://meet.google.com/fqa-ibje-mpn'),
(1, 2, 'Dr. Preet Jones', 'Orthopedics', '+919094995418', 'preethivijay0706@gmail.com', 'https://meet.google.com/fqa-ibje-mpn'),
(1, 3, 'Dr. Praggy Davis', 'Pediatrics', '+919003060876', 'harishrk2101@gmail.com', 'https://meet.google.com/fqa-ibje-mpn');

-- health checkup
INSERT INTO POC (Client_ID, Department_ID, POC_Name, Specialization, Contact_Number, Email)
VALUES
(1, 8, 'Master Health Checkup', 'Master Health Checkup', '+917299817996', 'harishradhakrishnan2001@gmail.com');

-- Insert Doctors into POC Table
INSERT INTO POC (Client_ID, Department_ID, POC_Name, Specialization, Contact_Number, Email, Meet_Link)
VALUES
(1, 1, 'Dr. Bob', 'Cardiology', '+917299817996', 'harishradhakrishnan2001@gmail.com','https://meet.google.com/fqa-ibje-mpn'),
(1, 2, 'Dr. Alice', 'Orthopedics', '+919094995418', 'preethivijay0706@gmail.com','https://meet.google.com/fqa-ibje-mpn'),
(1, 3, 'Dr. Rakesh', 'Pediatrics', '+919003060876', 'harishrk2101@gmail.com','https://meet.google.com/fqa-ibje-mpn');



-- CLIENT 2
INSERT INTO POC (Client_ID, Department_ID, POC_Name, Specialization, Contact_Number, Email, Meet_Link)
VALUES
(2, null, 'Dr. John', 'General', '+917299817996', 'harishradhakrishnan2001@gmail.com','https://meet.google.com/fqa-ibje-mpn'),
(2, null, 'Dr. Sony', 'General', '+919094995418', 'preethivijay0706@gmail.com','https://meet.google.com/fqa-ibje-mpn');

