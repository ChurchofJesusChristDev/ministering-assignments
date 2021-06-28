"use strict";

(async function () {
    var data;
    try {
        // when running on the page directly
        data = JSON.parse($('script[type="application/json"]').innerText);
    } catch (e) {
        data = require("./data.json");
    }

    var cards;
    try {
        cards = require("./cards.json");
    } catch (e) {
        // ignore
    }

    var CJCD = require("./transform.js");
    await CJCD.init(data, cards);

    var assignments = CJCD.toJSON();
    //console.log(JSON.stringify(assignments, null, 2));

    var Email = require("./email.js");
    var msgs = require("./template.js")(assignments);

    msgs.filter(function (msg) {
        var testable = /Potter/i.test(msg.member.nickname);
        if (testable) {
            console.log(msg.member.nickname);
            return true;
        }
    }).forEach(function (msg) {
        console.log(msg);
        // TODO Email.send(msg.body)
    });
})();
