//
// CHANGE THIS!
// This is a good default message and formatting,
// but you may want to change it to be what you want, specifically.
//
function tmplMessage(p) {
    var templates = {
        assignee: {
            subject: "Your Ministers",
            html: `
            <p>We wanted to let know who your ministers are.
            Feel free to reach out to them if you ever need to
            borrow a cup of sugar or get a ride to the airport.
            :)
        `,
        },
        minister: {
            subject: "Updated Assignments",
            html: `
            ${greetMinister(p.member)}

            <p>
            We've updated ministering assignments and wanted to make sure you have yours.
            We also have three ideas for you (below):

            <p>
            <blockquote><em>
                "[What] matters most is how you have blessed and cared for those within your stewardship,
                which has virtually nothing to do with a specific calendar or a particular location.
                What matters is that you love your people and are fulfilling the commandment
                “to watch over the church always.” - Elder Holland
            </em></blockquote>

            ${formatCompanions(p.companions)}

            ${formatAssignments(p.assignments)}

            ${formatMinisters(p.ministers)}

            <p>First Sunday of the Month: Huddle
            <ul>
                <li>Visit, call, or text your companion</li>
                <li>Plan when to minister and what to do</li>
            </ul>

            <p>Following weeks: Make a visit (perhaps Tuesday or Sunday)

            <p>Suggested Topics:
            <ul>
                <li>The current week's Come Follow Me for Adults
                <br>(if your family has children, the Primary Lesson from Come Follow Me has multiple suggestions)
                <br>https://www.churchofjesuschrist.org/study/manual/come-follow-me-for-individuals-and-families-doctrine-and-covenants-2021/intro
                </li>

                <li>A talk from the most recent General Conference
                <br>https://www.churchofjesuschrist.org/study/general-conference/2021/04
                </li>

                <li>An article from this month's Liahona
                <br>https://www.churchofjesuschrist.org/study/magazines/liahona
                </li>

                <li>Share testimony of a Gospel Principle that's been at work in your life
                </li>
            </ul>
        `,
        },
    };
    return templates;
}

// TODO need to get the whole family, not just head-of-household
function formatAssignments(families) {
    let msg = `<p><strong>Families you minister to</strong>: <br>\n `;

    // msg += '<ul>\n';
    msg += '<table border="0" style="border-collapse: collapse;">\n';
    families.forEach(function (family) {
        msg += formatCard(family);
    });
    // msg += '</ul>\n';
    msg += "</table>\n\n";

    return msg;
}

function formatCompanions(companions) {
    let msg = "<p>";
    if (1 === companions.length) {
        msg += `Your ministering companion: <br>\n `;
    } else {
        msg += `Your ministering companions: <br>\n `;
    }

    // msg += '<ul>\n';
    msg += '<table border="0" style="border-collapse: collapse;">\n';
    companions.forEach(function (companion) {
        msg += formatCard(companion);
    });
    // msg += '</ul>\n';
    msg += "</table>\n\n";

    return msg;
}

function formatMinisters(ministers) {
    let msg = `<p>Who ministers to you: <br>\n `;

    // msg += '<ul>\n';
    msg += '<table border="0" style="border-collapse: collapse;">\n';
    ministers.forEach(function (minister) {
        msg += formatCard(minister);
    });
    // msg += '</ul>\n';
    msg += "</table>\n\n";

    return msg;
}

//
// Generic stuff
// You can change this, but don't need to
//

// format phone numbers as (801) 555-1234
function formatTel(t) {
    t = (t || "").replace(/\D/g, "").trim();

    if (!t) {
        return "";
    }

    if (t.length > 10) {
        if ("1" !== t[0] || t.length > 11) {
            console.warn("phone too long:", t);
        }
        t = t.slice(-10);
        //return "";
    }

    if (t.length < 10) {
        console.warn("phone too short:", t);
        t = t.padStart(10, "_");
        //return "";
    }

    return `(${t.slice(0, 3)}) ${t.slice(3, 6)}-${t.slice(6, 10)}`;
}

function formatAddr(addr) {
    return addr.join("<br>");
}

// formats the email
function formatEmail(name, email) {
    if (!email || !/@/.test(email)) {
        return "";
    }
    // "Harry Potter <harry.j.potter@email.com>"
    //return `<pre>"${name}" &lt;${email}&gt;,</pre>`;
    return `${email}`;
}

// formats a card as a row
function formatCard(c) {
    return `
        <!-- open row -->
        <tr><td>
        &nbsp;&nbsp;&nbsp;&nbsp;
        </td><td>
        ${c.nickname}
        </td><td>
        &nbsp;&nbsp;
        ${String(c.age)}
        </td><td>
        ${c.gender}
        </td><td>
        &nbsp;&nbsp;
        ${formatTel(c.phone)}
        </td><td>
        &nbsp;&nbsp;
        ${formatAddr(c.address)}
        </td><td>
        &nbsp;&nbsp;
        ${formatEmail(c.nickname, c.email)}
        <! --close row -->
        </td></tr>\n
    `;
}

/*
function formatCard(c) {
    return (
        "<li>" +
        c.nickname +
        " " +
        c.age +
        " " +
        ("FEMALE" === c.gender ? "F" : "M") +
        "\t" +
        formatTel(c.individualPhone || c.phone) +
        "\t" +
        formatEmail(c.nickname, c.email) +
        "</li>\n"
    );
}
*/

function greetMinister(m) {
    return `Hi ${m.nickname.split(" ").shift()},`;
}

function createMessages(assignments) {
    return assignments
        .map(function (assignment) {
            var p = assignment;
            var m = assignment.member;

            if (!m.email) {
                console.warn("no email for", m.nickname, `(${m.id})`);
                return null;
            }

            if (0 === p.assignments.length) {
                console.warn("no assignment for", m.nickname, `(${m.id})`);
                return null;
            }

            if (0 === p.ministers.length) {
                console.warn("no ministers for", m.nickname, `(${m.id})`);
                // pass
            }

            if (0 === p.companions.length) {
                console.warn("no companions for", m.nickname, `(${m.id})`);
                // pass
            }

            var tmpl = tmplMessage(p);
            var data = {
                lang: "eng",
                allowReplyAll: false,
                recipients: [parseInt(m.id, 10)],
                subject: tmpl.minister.subject,
                messageBody: tmpl.minister.html,
                type: "EQ",
            };

            return Object.assign({}, assignment, { body: data });
        })
        .filter(Boolean);
}

if ('undefined' !== typeof module) {
  module.exports = createMessages;
}

if ('undefined' !== typeof CJCD) {
  CJCD.execTemplate = createMessages;
}
