var Email = {};

(function () {
    async function sendOne(body) {
        await fetch(
            "https://lcr.churchofjesuschrist.org/services/leader-messaging/send-message?lang=eng",
            {
                headers: {
                    accept: "application/json, text/plain, */*",
                    "content-type": "application/json;charset=UTF-8",
                },
                credentials: "include",
                method: "POST",
                body: JSON.stringify(body, null, 2),
            }
        ).catch(function (err) {
            console.error("Error sending message:", err.message);
        });
    }

    async function sendAll(assignments) {
        let bodies = assignments
            .map(function (assignment) {
                return assignment.body;
            })
            .filter(Boolean);
        for (body of bodies) {
            await sendOne(body);
        }
    }

    Email = {
        send: sendOne,
        batchSend: sendAll,
    };

    if ("undefined" != typeof module) {
        module.exports = Email;
    }
})();
