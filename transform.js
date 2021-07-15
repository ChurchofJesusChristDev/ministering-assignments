var CJCD;

CJCD = (function () {
    var ids = {};
    var people = {};

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

        // (801) 555-1234
        //return `(${t.slice(0, 3)}) ${t.slice(3, 6)}-${t.slice(6, 10)}`;
        // +18015551234
        return `+1${t.slice(0, 10)}`;
    }

    // formats the email
    function formatEmail(name, email) {
        if (!email || !/@/.test(email)) {
            return "";
        }
        email = email.toLowerCase().trim();
        // "Harry Potter <harry.j.potter@email.com>"
        //return `<pre>"${name}" &lt;${email}&gt;,</pre>`;
        return email;
    }

    // formats a card as a row
    function formatMember(c) {
        return {
            id: c.id,
            name: c.name,
            nickname: c.spokenName,
            age: c.age,
            gender: "FEMALE" === c.gender ? "F" : "M",
            phone: CJCD._formatTel(c.individualPhone || c.phone),
            email: CJCD._formatEmail(c.spokenName, c.email),
            address: c._address || [],
            imageDataUrl: CJCD._images[c.id] || "",
        };
    }

    function getPerson(cmisId) {
        if (!people[cmisId]) {
            ids[cmisId] = true;
            people[cmisId] = {
                cmisId: cmisId,
                companions: {},
                assignments: {},
                ministers: {},
            };
        }
        return people[cmisId];
    }

    function organize() {
        CJCD._data.props.pageProps.initialState.ministeringData.elders.forEach(
            function (district) {
                district.companionships.forEach(function (ship, i) {
                    //console.log("companionship", i);
                    // this is a little imperfect for people in multiple companionships, but should work generally

                    ship.ministers.forEach(function (m, j) {
                        // TODO where to put this?
                        m._district = district.districtName;

                        //console.log("minister", j);
                        ids[m.legacyCmisId] = true;

                        var p = getPerson(m.legacyCmisId);
                        if (ship.ministers) {
                            ship.ministers.forEach(function (n) {
                                if (m === n) {
                                    return;
                                }
                                p.companions[n.legacyCmisId] = true;
                            });
                        }

                        if (ship.assignments) {
                            ship.assignments.forEach(function (a) {
                                var q = getPerson(a.legacyCmisId);
                                q.ministers[m.legacyCmisId] = true;

                                p.assignments[a.legacyCmisId] = true;
                                ids[a.legacyCmisId] = true;
                            });
                        }
                    });
                });
            }
        );
    }

    async function getCards() {
        for (id in ids) {
            await getCard(id);
        }
    }

    function getCachedCard(id) {
        return CJCD._cards[id];
    }

    async function getProfile(id) {
        if (CJCD._profiles[id]) {
            return await CJCD._profiles[id];
        }
        //console.log(Object.keys(profiles).length, id);

        // misnomer, this is the whole family, formatted 10 different ways
        var profileUrl = `https://lcr.churchofjesuschrist.org/records/member-profile/service/${id}?lang=eng`;
        CJCD._profiles[id] = fetch(profileUrl, {
            credentials: "same-origin",
        }).then(async function (resp) {
            CJCD._profiles[id] = await resp.json();
            // data.individual?.residentialAddress?.formattedLines
            return CJCD._profiles[id];
        });

        return await CJCD._profiles[id];
    }

    async function getImageDataUrl(id) {
        if (CJCD._p_images[id]) {
            return CJCD._p_images[id];
        }

        var profileImageUrl = `https://lcr.churchofjesuschrist.org/services/photos/manage-photos/approved-image-individual/${id}?lang=eng&addable=false`;
        //var profileImageUrl = `https://lcr.churchofjesuschrist.org/services/photos/manage-photos/approved-image-household/${id}?lang=eng&type=HOUSEHOLD`;
        CJCD._p_images[id] = fetch(profileImageUrl, {
            credentials: "same-origin",
        }).then(async function (resp) {
            let data = await resp.json();
            let tokenUrl = data.image?.tokenUrl || "";
            if (!tokenUrl || 'images/nohousehold.svg' === tokenUrl || 'images/nophoto.svg' === tokenUrl) {
                return "";
            }

            var imgUrl = `${tokenUrl}/MEDIUM`;
            var opts = { credentials: "same-origin" };
            return await fetch(imgUrl, opts)
                .then(async function (resp) {
                    let blob = await resp.blob();
                    CJCD._images[id] = await blobToDataURL(blob);
                    //return CJCD._images[id];
                });
        }).catch(function (err) {
            console.error("Image Error: Could not fetch image for", id);
            console.error(err);
            CJCD._images[id] = "";
            // return CJCD._images[id];
        });
        return CJCD._p_images[id];

        //**blob to dataURL**
        function blobToDataURL(blob) {
            return new Promise(function (resolve, reject) {
                var a = new FileReader();
                a.onload = function (e) {
                    resolve(e.target.result);
                };
                a.onerror = function (e) {
                    reject(e);
                };
                a.readAsDataURL(blob);
            });
        }
    }

    async function getCard(id) {
        if (CJCD._cards[id]) {
            return await CJCD._cards[id];
        }
        //console.log(Object.keys(cards).length, id);

        var cardUrl =
            `https://lcr.churchofjesuschrist.org/services/member-card` +
            `?id=${id}&includePriesthood=true&lang=eng&type=INDIVIDUAL`;
        CJCD._cards[id] = fetch(cardUrl, {
            credentials: "same-origin",
        }).then(async function (resp) {
            CJCD._cards[id] = await resp.json();

            CJCD._cards[id]._address = await getProfile(id)
                .then(function (data) {
                    return (
                        data.individual?.residentialAddress?.formattedLines || []
                    );
                })
                .catch(function () {
                    return [];
                });
            await getImageDataUrl(id);

            return CJCD._cards[id];
        });

        return await CJCD._cards[id];
    }

    async function getAssignment(id) {
        var p = CJCD.getPerson(id);
        var c = await CJCD.getCard(id);

        if (!c) {
            throw new Error(`Error: invalid id '${id}'`);
        }
        var assignment = {
            member: CJCD._formatMember(c),
            assignments: [],
            ministers: [],
            companions: [],
        };

        if (Object.keys(p.assignments).length) {
            assignment.assignments = await Promise.all(Object.keys(p.assignments).map(
                async function (id) {
                    var family = await CJCD.getCard(id);
                    return CJCD._formatMember(family);
                }
            ));
        }

        if (Object.keys(p.companions).length > 0) {
            assignment.companions = await Promise.all(Object.keys(p.companions).map(
                async function (id) {
                    var companion = await CJCD.getCard(id);
                    return CJCD._formatMember(companion);
                }
            ));
        }

        if (Object.keys(p.ministers).length > 0) {
            assignment.ministers = await Promise.all(Object.keys(p.ministers).map(
                async function (id) {
                    var minister = await CJCD.getCard(id);
                    return CJCD._formatMember(minister);
                }
            ));
        }

        return assignment;
    }

    function idToMember(id) {
        var p = CJCD.getPerson(id);
        var c = CJCD.getCachedCard(id);

        if (!c) {
            throw new Error(`Error: invalid id '${id}'`);
        }
        var assignment = {
            member: CJCD._formatMember(c),
            assignments: [],
            ministers: [],
            companions: [],
        };

        if (Object.keys(p.assignments).length) {
            assignment.assignments = Object.keys(p.assignments).map(
                function (m) {
                    var family = CJCD.getCachedCard(m);
                    return CJCD._formatMember(family);
                }
            );
        }

        if (Object.keys(p.companions).length > 0) {
            assignment.companions = Object.keys(p.companions).map(function (
                id
            ) {
                var companion = CJCD.getCachedCard(id);
                return CJCD._formatMember(companion);
            });
        }

        if (Object.keys(p.ministers).length > 0) {
            assignment.ministers = Object.keys(p.ministers).map(function (
                id
            ) {
                var minister = CJCD.getCachedCard(id);
                return CJCD._formatMember(minister);
            });
        }

        return assignment;
    }

    function toJSON() {
        var assignments = [];
        return Object.keys(CJCD.ids).map(idToMember);
    }

    function $(sel, el) {
      return (el || document.body).querySelector(sel);
    }

    function createDownloadAnchor(json, name, replacer, indent) {
      // TODO https://stackoverflow.com/a/41553494/151312
      //var contentType = "text/json;charset=utf-8";
      var contentType = "application/octet-stream";
      var dataStr = "data:" + contentType + "," + encodeURIComponent(JSON.stringify(json, replacer, indent));
      var a = document.createElement('a');
      a.setAttribute("href", dataStr);
      a.setAttribute("download", name);
      return a;
    }

    function download(json, name, replacer, indent) {
      var a = createDownloadAnchor(json, name, replacer, indent);
      document.body.appendChild(a); // required for firefox
      a.click();
      a.remove();
    }

    return {
        _data: null,
        _cards: null,
        _p_images: null,
        _images: null,
        _people: people,
        _formatTel: formatTel,
        _formatEmail: formatEmail,
        _formatMember: formatMember,
        ids: ids,
        init: async function (_data, _cards, _profiles, _images) {
            if (!_data) {
                _data = JSON.parse(
                    $('script[type="application/json"]').innerText
                );
            }
            CJCD._data = _data;
            CJCD.organize();

            CJCD._cards = _cards || CJCD._cards || {};
            CJCD._images = _images || CJCD._images || {};
            CJCD._p_images = {};
            CJCD._profiles = _profiles || CJCD._profiles || {};
        },
        organize: organize,
        getPerson: getPerson,
        getAssignment: getAssignment,
        getAssignments: async function () {
            let assignments = [];

            await Object.keys(CJCD.ids).reduce(function (promise, id) {
                return promise.then(async function () {
                    let assignment = await CJCD.getAssignment(id);
                    assignments.push(assignment);
                });
            }, Promise.resolve());

            return assignments;
        },
        getCard: getCard,
        getCards: getCards,
        getCachedCard: getCachedCard,
        toJSON: toJSON,
        download: function (name = 'ministering-assignments.json', replacer, indent) {
          download(toJSON(), name, replacer, indent);
        },
    };
})();

if ("undefined" != typeof module) {
    module.exports = CJCD;
}
