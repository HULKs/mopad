const functions = require("firebase-functions");
const admin = require("firebase-admin");
const ical = require("ical-generator");
const moment = require("moment");

admin.initializeApp();

exports.ical = functions.region("europe-west1").https.onRequest(async (request, response) => {
    const talks = await admin.firestore().collection("talks").get();

    const calendar = ical({
        domain: "mopad-hulks.web.app",
        name: "Mopad",
        description: "Moderated Organization PAD (powerful, agile, distributed)",
        timezone: "UTC",
        prodId: {
            company: "HULKs",
            product: "mopad",
            language: "EN",
        },
    });

    talks.forEach(talk => {
        const scheduledAt = talk.get("scheduledAt");
        const duration = talk.get("duration");

        if (scheduledAt && duration) {
            calendar.createEvent({
                id: talk.id,
                start: moment(scheduledAt.toDate()),
                end: moment(scheduledAt.toDate()).add(duration, "seconds"),
                summary: talk.get("title"),
                description: talk.get("description"),
                location: talk.get("location"),
            });
        }
    });

    calendar.serve(response);
});
