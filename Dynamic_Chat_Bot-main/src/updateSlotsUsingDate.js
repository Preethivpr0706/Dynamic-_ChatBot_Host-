const mysql = require('mysql2/promise');
const readline = require('readline');
const moment = require('moment');

// Database connection details
const dbConfig = {
    user: 'root',
    password: 'password',
    host: 'localhost',
    database: 'chatbotdynamic'
};

const daysToGenerate = 30;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question("Enter the start date (YYYY-MM-DD) for generating slots: ", async(userStartDate) => {
    try {
        const startDate = moment(userStartDate, "YYYY-MM-DD");
        if (!startDate.isValid()) {
            console.log("Invalid date format. Please enter a valid date.");
            rl.close();
            return;
        }

        const connection = await mysql.createConnection(dbConfig);
        const [schedules] = await connection.execute("SELECT Schedule_ID, POC_ID, Day_of_Week, Start_Time, End_Time, appointments_per_slot, slot_duration FROM POC_Schedules");

        for (const schedule of schedules) {
            const { Schedule_ID, POC_ID, Day_of_Week, Start_Time, End_Time, appointments_per_slot, slot_duration } = schedule;
            const slotDuration = moment.duration(slot_duration, 'minutes');

            for (let day = 0; day < daysToGenerate; day++) {
                const scheduleDate = moment(startDate).add(day, 'days');

                if (scheduleDate.format('dddd') === Day_of_Week) {
                    const [existingSlots] = await connection.execute(
                        "SELECT COUNT(*) AS count FROM POC_Available_Slots WHERE POC_ID = ? AND Schedule_Date = ? AND Start_Time >= ? AND End_Time <= ?", [POC_ID, scheduleDate.format("YYYY-MM-DD"), Start_Time, End_Time]
                    );

                    if (existingSlots[0].count === 0) {
                        let currentSlotStart = moment(Start_Time, "HH:mm:ss");
                        const endSlotTime = moment(End_Time, "HH:mm:ss");

                        while (currentSlotStart.clone().add(slotDuration).isSameOrBefore(endSlotTime)) {
                            const currentSlotEnd = currentSlotStart.clone().add(slotDuration);

                            await connection.execute(
                                "INSERT INTO POC_Available_Slots (POC_ID, Schedule_Date, Start_Time, End_Time, appointments_per_slot, slot_duration) VALUES (?, ?, ?, ?, ?, ?)", [POC_ID, scheduleDate.format("YYYY-MM-DD"), currentSlotStart.format("HH:mm:ss"), currentSlotEnd.format("HH:mm:ss"), appointments_per_slot, slot_duration]
                            );

                            currentSlotStart = currentSlotEnd;
                        }
                    }
                }
            }
        }

        await connection.end();
        console.log("Slot data inserted successfully.");
    } catch (error) {
        console.error("Error generating slots:", error);
    } finally {
        rl.close();
    }
});