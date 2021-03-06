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

function initSqrl() {
    Sqrl.filters.define("tel", CJCD.formatTel || CJCD._formatTel);
    Sqrl.filters.define("addr", function (addr) {
        return addr.slice(0,2).join("<br>")
            // Direction names to single letter
            .replace(/\bEast\b/i, 'E')
            .replace(/\bWest\b/i, 'W')
            .replace(/\bNorth\b/i, 'N')
            .replace(/\bSouth\b/i, 'S')
            // Common abbrevations and fixes
            .replace(/\bBuilding\b/i, 'Bldg')
            .replace(/\bApartment\b/i, 'Apt')
            .replace(/\bUnit Unit\b/i, 'Unit')
            .replace(/\bApt Apt\b/i, 'Apt')
            // Utah-specific shorthand
            .replace(/\bPleasant Grove\b/i, 'PG')
            .replace(/\bSalt Lake City\b/i, 'SLC')
            .replace(/\bUtah\b/i, 'UT')
            // 9-digit zip to 5-digit zip
            .replace(/\b(\d{5})-\d{4}\b/i, '$1');
    });
    Sqrl.filters.define("email", function (str) {
      if (str.length <= 24) {
        return str;
      }
      return str.split("@").join("<br><span style='float: right;'>@") + "</span>";
    });
    Sqrl.filters.define("name", function (str) {
      return str.split(", ").reverse().join("<br>");
    });
    Sqrl.filters.define("first", function (str) {
      return str.split(" ").shift();
    });
    Sqrl.filters.define("nbsp1", function (str) {
      return '\xa0' + str;
    });
    Sqrl.filters.define("nbsp2", function (str) {
      return '\xa0\xa0' + str;
    });
    Sqrl.filters.define("nbsp3", function (str) {
      return '\xa0\xa0\xa0' + str;
    });
    Sqrl.filters.define("nbsp4", function (str) {
      return '\xa0\xa0\xa0\xa0' + str;
    });

    //Sqrl.templates.define('greeting', Sqrl.compile(greetingMd));
    Sqrl.templates.define('companions', Sqrl.compile(CJCD.templates.companions));
    Sqrl.templates.define('assignments', Sqrl.compile(CJCD.templates.assignments));
    Sqrl.templates.define('ministers', Sqrl.compile(CJCD.templates.ministers));
    //Sqrl.templates.define('assignment', Sqrl.compile(CJCD.templates.assignment));
}

var max = '75px';
var templates = {
    // TODO use css variables
    member: `
        <tr>
            <td class="pic">
              {{@if(it.imageDataUrl)}}
                <img src="{{ it.imageDataUrl }}" style="max-width: 75px; max-height: 75px;" />
              {{#else}}
                <div style="width: 75px;"></div>
              {{/if}}
            </td>
            <td>{{ it.nickname | name | safe }}<br></td>
            <td class="age">{{ m.age }}<br></td>
            <td>{{ it.gender }}<br></td>
            <td>{{ it.phone | tel }}<br></td>
            <td>{{ it.address | addr | safe }}</td>
            <td>{{ it.email | email | safe }}<br></td>
        </tr>
    `,
    companions: `
        <table>
        <tr>
            <td class="pic">
                {{@if(it.member.imageDataUrl)}}
                    <img src="{{ it.member.imageDataUrl }}" style="max-width:${max}; max-height:${max};" />
                {{#else}}
                    <div style="width: ${max}"></div>
                {{/if}}
            </td>
            <td>{{ it.member.nickname }}<br></td>
            <td class="age">{{ it.member.age }}<br></td>
            <td>{{ it.member.gender }}<br></td>
            <td>{{ it.member.phone | tel }}<br></td>
            <td>{{ it.member.address | addr | safe }}</td>
            <td>{{ it.member.email | email | safe }}<br></td>
        </tr>
        {{ @each(it.companions) => m }}
        <tr>
            <td class="pic">
                {{@if(m.imageDataUrl)}}
                    <img src="{{ m.imageDataUrl }}" style="max-width:${max}; max-height:${max};" />
                {{#else}}
                    <div style="width: ${max}"></div>
                {{/if}}
            </td>
            <td>{{ m.nickname }}<br></td>
            <td class="age">{{ m.age }}<br></td>
            <td>{{ m.gender }}<br></td>
            <td>{{ m.phone | tel }}<br></td>
            <td>{{ m.address | addr | safe }}</td>
            <td>{{ m.email | email | safe }}<br></td>
        </tr>
        {{/each}}
        </table>
    `,
    assignments: `
        <table>
        {{ @each(it.assignments) => m }}
        <tr>
            <td class="pic">
                {{@if(m.imageDataUrl)}}
                    <img src="{{ m.imageDataUrl }}" style="max-width:${max}; max-height:${max};" />
                {{#else}}
                    <div style="width: ${max}"></div>
                {{/if}}
            </td>
            <td>{{ m.nickname }}<br></td>
            <td class="age">{{ m.age }}<br></td>
            <td>{{ m.gender }}<br></td>
            <td>{{ m.phone | tel }}<br></td>
            <td>{{ m.address | addr | safe }}</td>
            <td>{{ m.email | email | safe }}<br></td>
        </tr>
        {{/each}}
        </table>
    `,
    ministers: `
        <table>
        {{ @each(it.ministers) => m }}
        <tr>
            <td class="pic">
                {{@if(m.imageDataUrl)}}
                    <img src="{{ m.imageDataUrl }}" style="max-width:${max}; max-height:${max};" />
                {{#else}}
                    <div style="width: ${max}"></div>
                {{/if}}
            </td>
            <td>{{ m.nickname }}<br></td>
            <td class="age">{{ m.age }}<br></td>
            <td>{{ m.gender }}<br></td>
            <td>{{ m.phone | tel }}<br></td>
            <td>{{ m.address | addr | safe }}</td>
            <td>{{ m.email | email | safe }}<br></td>
        </tr>
        {{/each}}
        </table>
    `,
    assignment: `
        <p><strong>{{ it.member.nickname }}</strong>'s Ministering Companionship:<br>
        {{@include('companions', it) /}}

        {{@if(it.assignments.length)}}
            <p><strong>Families you minister to</strong>:<br>
            {{@include('assignments', it) /}}
        {{/if}}

        {{@if(it.ministers.length)}}
            <p>Who ministers to you:<br>
            {{@include('ministers', it) /}}
        {{/if}}
    `,
};

function renderAssignment(assignment) {
    return Sqrl.render(CJCD.templates.assignment, assignment);
}

if ('undefined' !== typeof module) {
  module.exports = createMessages;
}

if ('undefined' !== typeof CJCD) {
  CJCD._loadStyles = async function (...hrefs) {
    return await Promise.all(hrefs.map(CJCD._loadStyle));
  };
  CJCD._loadStyle = async function (href) {
    return await new Promise(function (resolve, reject) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href = href;
      //link.async = false;
      link.onload = resolve;
      link.onerror = reject;
      document.head.append(link);
    });
  }
  CJCD.promise = Promise.resolve(CJCD.promise).then(async function () {
      document.querySelectorAll('style,link[rel="stylesheet"]').forEach(function (el) { el.remove(); });
      document.head = document.createElement('head');
      //document.body = document.createElement('body');
      await CJCD._loadStyles(
          // MVP.css is a great option
          "https://unpkg.com/mvp.css", // TODO version
          // And so is new.css
          //"https://fonts.xz.style/serve/inter.css",
          //"https://cdn.jsdelivr.net/npm/@exampledev/new.css@1.1.2/new.min.css",
      );
  });
  CJCD._loadScripts = async function (...srcs) {
    return await Promise.all(srcs.map(CJCD._loadScript));
  };
  CJCD._loadScript = async function (src) {
    return await new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = src;
      //script.async = false;
      script.onload = resolve;
      script.onerror = reject;
      document.body.append(script);
    });
  }
  CJCD.promise = Promise.resolve(CJCD.promise).then(async function () {
      await CJCD._loadScripts(
          "https://cdn.jsdelivr.net/npm/squirrelly@8.0.8/dist/browser/squirrelly.min.js",
          "https://cdn.jsdelivr.net/npm/marked@2.1.3/marked.min.js",
      )
  }).then(initSqrl);
  CJCD.execTemplate = createMessages;
  CJCD.templates = templates;
  CJCD.renderAssignment = renderAssignment;
}
