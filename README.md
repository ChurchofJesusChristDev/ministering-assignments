# Send Ministering Assignments

Send a friend email for all assignments with plain-text contact information

> Most people don't know where to check their ministering assignment,
> and don't know when it has changed.
> 
> We want to periodically send a church email (and eventually texts)
> showing assignments in a simple way, and with a call to action.

https://lcr.churchofjesuschrist.org/ministering?lang=eng&type=EQ&tab=assigned

## Overview

Here's the step-by-step overview:

1. "Scrape" the ministering assignment data from the JSON "script" tag in the HTML
2. Transform that data from the format used for page layout to a more generally useful format
3. Fetch the missing person information (phone numbers, email, address) from the `card` API
4. Template the complete data set as you wish to display it in print or email
5. Send the batch of emails, one API call per each

## How to Send an Email

This part is relatively simple.

Authentication is cookie-based, so no authentication details are provided.

```js
async function sendEmail(message) {
  return fetch("https://lcr.churchofjesuschrist.org/services/leader-messaging/send-message?lang=eng", {
    "headers": {
      "accept": "application/json, text/plain, */*",
      "content-type": "application/json;charset=UTF-8"
    },
    "credentials": "include",
    "method": "POST",
    "body": JSON.stringify(message, null, 2)
  });
}
```

```js
var message = {
  lang: 'eng',
  recipients: [ 1000000001 ],
  allowReplyAll: false,
  subject: "[Test] You're a Wizard Harry!",
  messageBody: 'Harry! You've been accepted to Hogwarts School Stake.",
  type: 'EQ'
};

sendEmail(message);
```

## Getting the Data from the HTML

Unfortunately, it doesn't seem possible to get the JSON you need from the API.

Instead, you have to get it from a JSON object stored in a quasi "script tag".

```js
var data = JSON.parse($('script[type="application/json"]').innerText);
```

The format of the data in the HTML isn't ideal, but it's workable. Here's an abreviated view:

```js
{
  "props": {
    "pageProps": {
      "initialState": {
        "ministeringData": {
	
	  //
	  // misnomer: these are districts
	  //
          "elders": [
            {
              "districtName": "District 1",
              "districtUuid": "50000000-0000-4000-8000-000000000001",
     	      "supervisorName": "Black, Sirius",
              "supervisorLegacyCmisId": 1000000005,
              "supervisorPersonUuid": "10000000-0000-4000-8000-000000000005",
	      
	      "companionships": [
	        "id": "60000000-0000-4000-8000-000000000001",
		
		"ministers": [
                  {
                    "personUuid": "10000000-0000-4000-8000-000000000003",
                    "legacyCmisId": 1000000003,
                    "name": "Weasley, Ronald",
                    "nameOrder": 2,
                    "email": "ron.b.weasley@example.com",
                    "interviews": [
                      {
                        "id": "A0000000-0000-4000-8000-000000000001",
                        "date": "2020-03-01T00:00:00.000",
                        "timestamp": "2020-03-01T06:00:00.000+0000"
                      }
		    ],
                    "youthBasedOnAge": false
		  }
		],
		
		"assignments": [
                  {
		    //
		    // misnomer: this refers to head of household, as the family identifier
		    //
                    "personUuid": "10000000-0000-4000-8000-000000000001",
                    "legacyCmisId": 1000000001,
                    "name": "Potter, Harry James & Ginevra Molly",
                    "nameOrder": 1,
                    "youthBasedOnAge": false
                  }
		],
		
                "recentlyChangedDate": "2021-06-01T06:00:00.000+0000",
                "recentlyChangedDateInMilliseconds": 1622527200000
	      ]
            }
          ]
        }
      }
    }
  }
}
```

Take a look at the [Full Data Shape](https://github.com/ChurchofJesusChristDev/send-ministering-assignments/#shape-of-data) for more detail.

And this is how you can access it

```js
// Misnomer, these are Ministering Districts
data.props.pageProps.initialState.ministeringData.elders

// Sadly, no ID
data.props.pageProps.initialState.ministeringData.elders[0].supervisorName

// Individual ID and email, but no phone number
data.props.pageProps.initialState.ministeringData.elders[0].companionships[0].ministers[0].legacyCmisId
// Individual ID, but no contact info
data.props.pageProps.initialState.ministeringData.elders[0].companionships[0].assignments[0].legacyCmisId
```

If we want to omit the most garbage and get the most useful data only:

```js
console.log(
  JSON.stringify(
    {
      props: { 
        pageProps: { 
          initialState: { 
            ministeringData: {
              elders: data.props.pageProps.initialState.ministeringData.elders
            }
          } 
        }
      }
    },
    null,
    2
  )
);
```

You can then save that to a file and use it as a cache.

## Get Complete Ministering Assignment Data

```js
// load companionship data and card cache, if any
CJCD.init(data, cards || {});

// transform the data into an individual-oriented format
CJCD.organize();

// get the missing information from card API
await CJCD.getCards();

var assignments = CJCD.toJSON();
```

`assignments` will look like this:

```js
[
  {
    "member": {
      "nickname": "",
      "given_name": "",
      "family_name": "",
      "phone": "",
      "email": "",
      "address": "",
      "district": ""
    },
    "companions": [],
    "assignments": [],
    "ministers": []
  }
]
```

If you want to get the card values to save them for local caching:

```js
console.log(JSON.stringify(CJCD._cards, null, 2));
```

This will put all person info in `cards` and all companionship info in `people`.

```js
var CJCD;

CJCD = (function () {
    var ids = {};
    var people = {};

    function getPerson(id) {
        if (!people[id]) {
            ids[id] = true;
            people[id] = {
                companions: {},
                assignments: {},
                ministers: {},
            };
        }
        return people[id];
    }

    function organize() {
        CJCD._data.props.pageProps.initialState.ministeringData.elders.forEach(
            function (district) {
                district.companionships.forEach(function (ship, i) {
                    //console.log("companionship", i);
                    // this is a little imperfect for people in multiple companionships, but should work generally

                    ship.ministers.forEach(function (m, j) {
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

    async function getCard(id) {
        if (CJCD._cards[id]) {
            return CJCD._cards[id];
        }
        //console.log(Object.keys(cards).length, id);

        var cardUrl =
            `https://lcr.churchofjesuschrist.org/services/member-card` +
            `?id=${id}&includePriesthood=true&lang=eng&type=INDIVIDUAL`;

        return fetch(cardUrl, {
            credentials: "same-origin",
        }).then(function (resp) {
            return resp.json().then(function (data) {
                CJCD._cards[id] = data;
                return CJCD._cards[id];
            });
        });
    }

    function toJSON() {
        var assignments = [];
        return Object.keys(CJCD.ids).map(function (id) {
            var p = CJCD.getPerson(id);
            var c = CJCD.getCachedCard(id);
            var isMinister = false;

            var assignment = {
                member: p, // TODO format member
                assignments: [],
                ministers: [],
                companions: [],
            };

            if (Object.keys(p.assignments).length) {
                isMinister = true;
                assignment.assignments = Object.keys(p.assignments).map(
                    function (m) {
                        var family = CJCD.getCachedCard(m);
                        // TODO format in a reasonable way
                        return family;
                    }
                );
            }

            if (Object.keys(p.companions).length > 0) {
                isMinister = true;
                assignment.companions = Object.keys(p.companions).map(function (
                    id
                ) {
                    var companion = CJCD.getCachedCard(id);
                    // TODO format in a reasonable way
                    return companion;
                });
            }

            if (Object.keys(p.ministers).length > 0) {
                assignment.ministers = Object.keys(p.ministers).map(function (
                    id
                ) {
                    var minister = CJCD.getCachedCard(id);
                    // TODO format in a reasonable way
                    return minister;
                });
            }

            return assignment;
        });
    }

    return {
        _data: null,
        _cards: null,
        _people: people,
        ids: ids,
        init: async function (_data, _cards) {
            CJCD._data = _data;
            CJCD._cards = _cards || CJCD._cards || {};
            CJCD.organize();
            await CJCD.getCards();
        },
        organize: organize,
        getPerson: getPerson,
        getCard: getCard,
        getCards: getCards,
        getCachedCard: getCachedCard,
        toJSON: toJSON,
    };
})();

if ("undefined" != typeof module) {
    module.exports = CJCD;
}
```

## Templating Emails

This will create an email for everyone who has a ministering assignment and/or is assigned to a set of ministers.

```js
var CJCD;

if ("undefined" === typeof CJCD) {
    CJCD = require("./email.js");
}

var assigneeSubject = "Will you do the Elder's Quorum a Favor?";
var assigneeMessage = `\n<p>We wanted to let know who your ministers are. Feel free to reach out to them if you ever need to borrow a cup of sugar, or get a ride to the airport. :)\n`;

var ministerSubject = "Updated Assignments: Will you do the Elder's Quorum a Favor?";
var ministerMessage =
    `\n<p>We've updated ministering assignments wanted to make sure you have yours. We also have two favors to ask: ` +
    `\n<p>1. We'd like to ask you to pray for the families you minister to by name today (and often). ` +
    `\n<p>2. If you haven't heard from your ministers will you do a little reverse ministering and reach out to them? `;

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

function formatEmail(name, email) {
    if (!email || !/@/.test(email)) {
        return "";
    }
    //return `<pre>"${name}" &lt;${email}&gt;,</pre>`;
    return `${email}`;
}

function formatCard(c) {
    return (
        "<li>" +
        c.spokenName +
        " " +
        c.age +
        " " +
        ("FEMALE" === c.gender ? "F" : "M") +
        "\t" +
        formatTel(c.individualPhone || c.phone) +
        "\t" +
        formatEmail(c.spokenName, c.email) +
        "</li>\n"
    );
}

function helloMinisters(p, c) {
    var lead = `Hi ${c.spokenName.split(" ").shift()}, \n` + assigneeMessage;
    return lead;
}

function helloAssignments(p, c) {
    var lead = `Hey ${c.spokenName.split(" ").shift()}, \n` + ministerMessage;
    return lead;
}

async function createMessages() {
    CJCD.organize();
    await CJCD.getCards();
    return Object.keys(CJCD.ids)
        .filter(function (id) {
            var p = CJCD.getPerson(id);
            var c = CJCD.getCachedCard(id);

            if (!Object.keys(p.assignments)) {
                console.warn("no assignments", c.spokenName, `(${id})`);
                return;
            }

            if (!c.email) {
                console.warn("no email for", c.spokenName, `(${id})`);
                return;
            }

            if (0 === Object.keys(p.ministers).length) {
                console.warn("no ministers for", c.spokenName, `(${id})`);
                // pass
            }

            if (0 === Object.keys(p.companions).length) {
                console.warn("no companions for", c.spokenName, `(${id})`);
                // pass
            }

            if (0 === Object.keys(p.assignments).length) {
                console.warn("no assignment for", c.spokenName, `(${id})`);
                // pass
            }

            return id;
        })
        .map(function (id) {
            var msgs = ['']; // start with a new paragraph

            var p = CJCD.getPerson(id);
            var c = CJCD.getCachedCard(id);
	    var isMinister = false;

            if (Object.keys(p.assignments).length) {
                isMinister = true;
                let msg = `Who you minister to:<br><ul>\n`;
                Object.keys(p.assignments).forEach(function (m) {
                    var assignment = cards[m];
                    msg += formatCard(assignment);
                });
                msg += "</ul>";
                msgs.push(msg);
            }
	    
            if (Object.keys(p.companions).length > 0) {
                isMinister = true;
                let msg = "";
                if (1 === Object.keys(p.companions).length > 1) {
                    msg += `Your companion:<br><ul>\n`;
                } else {
                    msg += `Your companions:<br><ul>\n`;
                }
                Object.keys(p.companions).forEach(function (id) {
                    var companion = cards[id];
                    msg += formatCard(companion);
                });
                msg += "</ul>";
                msgs.push(msg);
            }

            if (Object.keys(p.ministers).length > 0) {
                let msg = `Your ministers:<br><ul>\n`;
                Object.keys(p.ministers).forEach(function (id) {
                    var minister = cards[id];
                    msg += formatCard(minister);
                });
                msg += "</ul>";
                msgs.push(msg);
            }

            if (!msgs.length) {
                console.error("[SANITY] Impossible!", id, "does not exist!");
                return;
            }

            // recipients: [ id ]

            var lead;
            if (
                "MALE" !== c.gender ||
                (0 === Object.keys(p.assignments).length &&
                    0 === Object.keys(p.companions).length)
            ) {
                lead = helloMinisters(p, c);
            } else {
                lead = helloAssignments(p, c);
            }

            var body = lead + msgs.join("\n<p>") + "\n\n";

            var data = {
                lang: "eng",
                allowReplyAll: false,
                recipients: [parseInt(id, 10)],
                subject: isMinister && ministerSubject || assigneeSubject,
                messageBody: body,
                type: "EQ",
            };

            console.log({
                body: JSON.stringify(data),
            });

            return data;
        });
}

var messages = createMessages();
```

## Shape of Data

The JSON is over 1MB, so to examine it quickly I used Matt's JSON-to-Go, and I cut out `translations`, as that accounted for about 75% of the entire structure.

Again, the purpose is NOT to provide the Go representation of the JSON, but rather that was the simplest tool I know of to convert a huge JSON dataset into a small overview.

```go
type AutoGenerated struct {
	Props struct {
		PageProps struct {
			IsServer bool `json:"isServer"`
			Store    struct {
			} `json:"store"`
			InitialState struct {
				APIStatus struct {
					ShowGenericError bool `json:"showGenericError"`
					IsPageError      bool `json:"isPageError"`
					IsFileNotFound   bool `json:"isFileNotFound"`
					IsCaPage         bool `json:"isCaPage"`
				} `json:"apiStatus"`
				Lang    string `json:"lang"`
				Version string `json:"version"`
				Proxy   struct {
					ProxyOptions       []interface{} `json:"proxyOptions"`
					ProxySearchResults []interface{} `json:"proxySearchResults"`
					Loading            bool          `json:"loading"`
				} `json:"proxy"`
				UserContext struct {
					Environment string `json:"environment"`
					Version     string `json:"version"`
					ContextPath string `json:"contextPath"`
					Unit        struct {
						UnitName            string      `json:"unitName"`
						UnitNumber          int         `json:"unitNumber"`
						Type                string      `json:"type"`
						TranslatedType      string      `json:"translatedType"`
						Children            interface{} `json:"children"`
						ParentUnitName      string      `json:"parentUnitName"`
						ParentUnitNumber    int         `json:"parentUnitNumber"`
						ParentType          string      `json:"parentType"`
						GrandparentType     string      `json:"grandparentType"`
						MissionName         string      `json:"missionName"`
						MissionUnitNumber   int         `json:"missionUnitNumber"`
						AreaName            string      `json:"areaName"`
						AreaUnitNumber      int         `json:"areaUnitNumber"`
						MsrOfficeName       string      `json:"msrOfficeName"`
						MsrOfficeUnitNumber int         `json:"msrOfficeUnitNumber"`
					} `json:"unit"`
					IsLcrClassCallingHtvtEnabled bool `json:"isLcrClassCallingHtvtEnabled"`
					SubOrgs                      []struct {
						UnitNumber          int           `json:"unitNumber"`
						SubOrgID            int           `json:"subOrgId"`
						OrgTypeIds          []int         `json:"orgTypeIds"`
						DefaultOrgTypeIds   []int         `json:"defaultOrgTypeIds"`
						Name                string        `json:"name"`
						Children            []interface{} `json:"children"`
						UserCanEditCallings bool          `json:"userCanEditCallings"`
						IsClass             bool          `json:"isClass"`
						IsRealClass         bool          `json:"isRealClass"`
						IsSplit             bool          `json:"isSplit"`
						ClassGroup          interface{}   `json:"classGroup"`
						ParentName          interface{}   `json:"parentName"`
						FirstTypeID         int           `json:"firstTypeId"`
						Gender              interface{}   `json:"gender"`
						IsCombined          bool          `json:"isCombined"`
					} `json:"subOrgs"`
					UnitOrgs []struct {
						Children       interface{} `json:"children"`
						UnitOrgUUID    string      `json:"unitOrgUuid"`
						UnitUUID       string      `json:"unitUuid"`
						UnitNumber     int         `json:"unitNumber"`
						UnitOrgName    string      `json:"unitOrgName"`
						UnitOrgTypeIds []int       `json:"unitOrgTypeIds"`
						IsClass        bool        `json:"isClass"`
					} `json:"unitOrgs"`
					FullDateFormatJs         string `json:"fullDateFormatJs"`
					FullDateFormatOmitYearJs string `json:"fullDateFormatOmitYearJs"`
					EmptyNameGroup           struct {
						FormattedLocal interface{} `json:"formattedLocal"`
						FormattedLatin interface{} `json:"formattedLatin"`
						Name1          struct {
							Family         interface{} `json:"family"`
							Given          interface{} `json:"given"`
							Suffix         interface{} `json:"suffix"`
							TranslitSource bool        `json:"translitSource"`
							WritingSystem  string      `json:"writingSystem"`
							Label          string      `json:"label"`
							LabelKey       string      `json:"labelKey"`
						} `json:"name1"`
						Name2        interface{} `json:"name2"`
						Name3        interface{} `json:"name3"`
						AutoRomanize bool        `json:"autoRomanize"`
					} `json:"emptyNameGroup"`
					LdsAccountUsername       string   `json:"ldsAccountUsername"`
					LdsAccountPreferredName  string   `json:"ldsAccountPreferredName"`
					IndividualID             int64    `json:"individualId"`
					Roles                    []string `json:"roles"`
					ActivePosition           int      `json:"activePosition"`
					ActivePositionUnitNumber int      `json:"activePositionUnitNumber"`
					ActivePositionEnglish    string   `json:"activePositionEnglish"`
					Positions                []struct {
						PositionTypeID int    `json:"positionTypeId"`
						PositionName   string `json:"positionName"`
						UnitNumber     int    `json:"unitNumber"`
					} `json:"positions"`
					Proxied                       bool   `json:"proxied"`
					BetaEnv                       bool   `json:"betaEnv"`
					BetaTerms                     bool   `json:"betaTerms"`
					NonBetaURL                    string `json:"nonBetaUrl"`
					BetaURL                       string `json:"betaUrl"`
					AddressURL                    string `json:"addressUrl"`
					CdolURL                       string `json:"cdolUrl"`
					CdolUnitURL                   string `json:"cdolUnitUrl"`
					LuHelpURL                     string `json:"luHelpUrl"`
					ChangeBoundaryURL             string `json:"changeBoundaryUrl"`
					ChangeBoundaryStakeURL        string `json:"changeBoundaryStakeUrl"`
					ViewBoundaryProposalStatusURL string `json:"viewBoundaryProposalStatusUrl"`
					StakeConferencesURL           string `json:"stakeConferencesUrl"`
					SurveyURL                     string `json:"surveyUrl"`
					NewBishopURL                  string `json:"newBishopUrl"`
					NewBishopStatusURL            string `json:"newBishopStatusUrl"`
					NewStakeCounselorURL          string `json:"newStakeCounselorUrl"`
					NewPatriarchURL               string `json:"newPatriarchUrl"`
					RecommendMissionPresidentURL  string `json:"recommendMissionPresidentUrl"`
					WelfareServicesURL            string `json:"welfareServicesUrl"`
					CqaBulkWait                   string `json:"cqaBulkWait"`
					Teasers                       struct {
						SmallTeasers  []interface{} `json:"smallTeasers"`
						MediumTeasers [][]struct {
							ID             string      `json:"id"`
							Feature        interface{} `json:"feature"`
							URL            interface{} `json:"url"`
							URLInNewWindow bool        `json:"urlInNewWindow"`
							ImageURL       string      `json:"imageUrl"`
							Title          string      `json:"title"`
							Description    string      `json:"description"`
						} `json:"mediumTeasers"`
					} `json:"teasers"`
					Menus []struct {
						Type                 string      `json:"type"`
						HiddenMenuSearchOnly bool        `json:"hiddenMenuSearchOnly"`
						Name                 string      `json:"name"`
						LiClass              interface{} `json:"liClass"`
						UlClass              interface{} `json:"ulClass"`
						SubMenuID            interface{} `json:"subMenuId"`
						AllowEmptyMenu       bool        `json:"allowEmptyMenu"`
						Sorted               bool        `json:"sorted"`
						IncludeRoles         [][]string  `json:"includeRoles"`
						ExcludeRoles         interface{} `json:"excludeRoles"`
						Item                 struct {
							HiddenMenuSearchOnly bool        `json:"hiddenMenuSearchOnly"`
							Name                 interface{} `json:"name"`
							MenuSearchName       interface{} `json:"menuSearchName"`
							Title                interface{} `json:"title"`
							ParentTitle          interface{} `json:"parentTitle"`
							URL                  string      `json:"url"`
							URLInNewWindow       bool        `json:"urlInNewWindow"`
							UISref               interface{} `json:"uiSref"`
							UISrefOpts           interface{} `json:"uiSrefOpts"`
							LiClass              interface{} `json:"liClass"`
							IncludeRoles         interface{} `json:"includeRoles"`
							ExcludeRoles         interface{} `json:"excludeRoles"`
							React                bool        `json:"react"`
							SubOrgID             interface{} `json:"subOrgId"`
						} `json:"item"`
						Items            interface{} `json:"items"`
						Columns          interface{} `json:"columns"`
						ParentSubOrgType interface{} `json:"parentSubOrgType"`
						ParentSubOrgID   interface{} `json:"parentSubOrgId"`
					} `json:"menus"`
					ReactDomain             interface{} `json:"reactDomain"`
					AppUpdatedFormattedDate string      `json:"appUpdatedFormattedDate"`
				} `json:"userContext"`
				UberSearch struct {
					MemberResults []interface{} `json:"memberResults"`
					PageResults   []interface{} `json:"pageResults"`
					Loading       bool          `json:"loading"`
				} `json:"uberSearch"`
				MemberList      []interface{} `json:"memberList"`
				MinisteringData struct {
					Loading bool `json:"loading"`
					Elders  []struct {
						Companionships []struct {
							ID        string `json:"id"`
							Ministers []struct {
								PersonUUID   string `json:"personUuid"`
								LegacyCmisID int64  `json:"legacyCmisId"`
								Name         string `json:"name"`
								NameOrder    int    `json:"nameOrder"`
								Email        string `json:"email"`
								Interviews   []struct {
									ID        string `json:"id"`
									Date      string `json:"date"`
									Timestamp string `json:"timestamp"`
								} `json:"interviews"`
								YouthBasedOnAge bool   `json:"youthBasedOnAge"`
								AssignType      string `json:"assignType,omitempty"`
								UnitOrgID       string `json:"unitOrgId,omitempty"`
							} `json:"ministers"`
							Assignments []struct {
								PersonUUID      string `json:"personUuid"`
								LegacyCmisID    int    `json:"legacyCmisId"`
								Name            string `json:"name"`
								NameOrder       int    `json:"nameOrder"`
								YouthBasedOnAge bool   `json:"youthBasedOnAge"`
							} `json:"assignments"`
							RecentlyChangedDate               string `json:"recentlyChangedDate"`
							RecentlyChangedDateInMilliseconds int64  `json:"recentlyChangedDateInMilliseconds"`
						} `json:"companionships"`
						DistrictName           string `json:"districtName"`
						DistrictUUID           string `json:"districtUuid"`
						SupervisorName         string `json:"supervisorName"`
						SupervisorLegacyCmisID int64  `json:"supervisorLegacyCmisId"`
						SupervisorPersonUUID   string `json:"supervisorPersonUuid"`
					} `json:"elders"`
					EldersQuorumSupervisors []struct {
						PersonUUID      string `json:"personUuid"`
						LegacyCmisID    int64  `json:"legacyCmisId"`
						Name            string `json:"name"`
						NameOrder       int    `json:"nameOrder"`
						YouthBasedOnAge bool   `json:"youthBasedOnAge"`
					} `json:"eldersQuorumSupervisors"`
					InterviewViewAccess             bool        `json:"interviewViewAccess"`
					Error                           bool        `json:"error"`
					ReliefSociety                   interface{} `json:"reliefSociety"`
					ReliefSocietySupervisors        interface{} `json:"reliefSocietySupervisors"`
					CurrentReliefSociety            interface{} `json:"currentReliefSociety"`
					EligibleMinistersAndAssignments struct {
						EligibleMinisters []struct {
							PersonUUID           string      `json:"personUuid"`
							LegacyCmisID         int         `json:"legacyCmisId"`
							Name                 string      `json:"name"`
							NameOrder            int         `json:"nameOrder"`
							PriesthoodOffice     string      `json:"priesthoodOffice"`
							Age                  int         `json:"age"`
							UnitOrgs             []string    `json:"unitOrgs"`
							Email                interface{} `json:"email"`
							NotGenerallyAssigned bool        `json:"notGenerallyAssigned"`
							Spouse               struct {
								EligibleMinister bool `json:"eligibleMinister"`
								NameFormats      struct {
									ListPreferredLocal   string      `json:"listPreferredLocal"`
									GivenPreferredLocal  string      `json:"givenPreferredLocal"`
									FamilyPreferredLocal string      `json:"familyPreferredLocal"`
									ListPreferred        interface{} `json:"listPreferred"`
									ListOfficial         interface{} `json:"listOfficial"`
									SpokenPreferredLocal interface{} `json:"spokenPreferredLocal"`
								} `json:"nameFormats"`
								UUID      string `json:"uuid"`
								NameOrder int    `json:"nameOrder"`
								Age       int    `json:"age"`
								Emails    []struct {
									Email     string      `json:"email"`
									OwnerType interface{} `json:"ownerType"`
									UseType   interface{} `json:"useType"`
								} `json:"emails"`
								Phones []struct {
									Number    string      `json:"number"`
									OwnerType interface{} `json:"ownerType"`
									UseType   interface{} `json:"useType"`
								} `json:"phones"`
								PhoneNumber      string      `json:"phoneNumber"`
								PriesthoodOffice string      `json:"priesthoodOffice"`
								MembershipUnit   interface{} `json:"membershipUnit"`
								LegacyCmisID     int         `json:"legacyCmisId"`
								Sex              string      `json:"sex"`
								UnitOrgsCombined []string    `json:"unitOrgsCombined"`
								Positions        interface{} `json:"positions"`
								HouseholdMember  struct {
									HouseholdRole string `json:"householdRole"`
									Household     struct {
										AnchorPerson struct {
											LegacyCmisID int    `json:"legacyCmisId"`
											UUID         string `json:"uuid"`
										} `json:"anchorPerson"`
										UUID                    string `json:"uuid"`
										FamilyNameLocal         string `json:"familyNameLocal"`
										DirectoryPreferredLocal string `json:"directoryPreferredLocal"`
										Address                 struct {
											FormattedLine1 string        `json:"formattedLine1"`
											FormattedLine2 string        `json:"formattedLine2"`
											FormattedLine3 string        `json:"formattedLine3"`
											FormattedLine4 interface{}   `json:"formattedLine4"`
											Formatted1     interface{}   `json:"formatted1"`
											Formatted2     interface{}   `json:"formatted2"`
											Formatted3     interface{}   `json:"formatted3"`
											Formatted4     interface{}   `json:"formatted4"`
											AddressLines   []string      `json:"addressLines"`
											FormattedAll   []interface{} `json:"formattedAll"`
										} `json:"address"`
										Emails []struct {
											Email     string      `json:"email"`
											OwnerType interface{} `json:"ownerType"`
											UseType   interface{} `json:"useType"`
										} `json:"emails"`
										Phones []struct {
											Number    string      `json:"number"`
											OwnerType interface{} `json:"ownerType"`
											UseType   interface{} `json:"useType"`
										} `json:"phones"`
										Unit struct {
											ParentUnit     interface{} `json:"parentUnit"`
											UUID           interface{} `json:"uuid"`
											UnitNumber     int         `json:"unitNumber"`
											NameLocal      string      `json:"nameLocal"`
											UnitType       interface{} `json:"unitType"`
											Children       interface{} `json:"children"`
											Positions      interface{} `json:"positions"`
											CdolLink       interface{} `json:"cdolLink"`
											AdminUnit      interface{} `json:"adminUnit"`
											AddressUnknown interface{} `json:"addressUnknown"`
										} `json:"unit"`
									} `json:"household"`
									MembershipUnitFlag bool `json:"membershipUnitFlag"`
								} `json:"householdMember"`
								Member                      bool   `json:"member"`
								PriesthoodTeacherOrAbove    bool   `json:"priesthoodTeacherOrAbove"`
								HouseholdEmail              string `json:"householdEmail"`
								HouseholdAnchorPersonUUID   string `json:"householdAnchorPersonUuid"`
								HouseholdNameFamilyLocal    string `json:"householdNameFamilyLocal"`
								HouseholdRole               string `json:"householdRole"`
								Convert                     bool   `json:"convert"`
								Email                       string `json:"email"`
								UnitName                    string `json:"unitName"`
								YouthBasedOnAge             bool   `json:"youthBasedOnAge"`
								IsSpouse                    bool   `json:"isSpouse"`
								HouseholdUUID               string `json:"householdUuid"`
								IsProspectiveElder          bool   `json:"isProspectiveElder"`
								IsSingleAdult               bool   `json:"isSingleAdult"`
								IsYoungSingleAdult          bool   `json:"isYoungSingleAdult"`
								HouseholdPhoneNumber        string `json:"householdPhoneNumber"`
								IsHead                      bool   `json:"isHead"`
								PersonUUID                  string `json:"personUuid"`
								NameListPreferredLocal      string `json:"nameListPreferredLocal"`
								HouseholdNameDirectoryLocal string `json:"householdNameDirectoryLocal"`
								FormattedAddress            string `json:"formattedAddress"`
								UnitNumber                  int    `json:"unitNumber"`
								NameGivenPreferredLocal     string `json:"nameGivenPreferredLocal"`
								IsMember                    bool   `json:"isMember"`
								HouseHoldMemberNameForList  string `json:"houseHoldMemberNameForList"`
								IsOutOfUnitMember           bool   `json:"isOutOfUnitMember"`
								IsAdult                     bool   `json:"isAdult"`
								NameFamilyPreferredLocal    string `json:"nameFamilyPreferredLocal"`
								OutOfUnitMember             bool   `json:"outOfUnitMember"`
								Address                     struct {
									FormattedLine1 string        `json:"formattedLine1"`
									FormattedLine2 string        `json:"formattedLine2"`
									FormattedLine3 string        `json:"formattedLine3"`
									FormattedLine4 interface{}   `json:"formattedLine4"`
									Formatted1     interface{}   `json:"formatted1"`
									Formatted2     interface{}   `json:"formatted2"`
									Formatted3     interface{}   `json:"formatted3"`
									Formatted4     interface{}   `json:"formatted4"`
									AddressLines   []string      `json:"addressLines"`
									FormattedAll   []interface{} `json:"formattedAll"`
								} `json:"address"`
								Birth struct {
									Date struct {
										Date    string `json:"date"`
										Calc    string `json:"calc"`
										Display string `json:"display"`
									} `json:"date"`
									MonthDay struct {
										Date    string `json:"date"`
										Calc    string `json:"calc"`
										Display string `json:"display"`
									} `json:"monthDay"`
									Place   interface{} `json:"place"`
									Country interface{} `json:"country"`
								} `json:"birth"`
								PersonStatusFlags struct {
									Member           bool `json:"member"`
									Convert          bool `json:"convert"`
									Adult            bool `json:"adult"`
									SingleAdult      bool `json:"singleAdult"`
									YoungSingleAdult bool `json:"youngSingleAdult"`
									ProspectiveElder bool `json:"prospectiveElder"`
									Deceased         bool `json:"deceased"`
								} `json:"personStatusFlags"`
								Name string `json:"name"`
							} `json:"spouse,omitempty"`
						} `json:"eligibleMinisters"`
						EligibleAssignments []struct {
							PersonUUID   string      `json:"personUuid"`
							LegacyCmisID int         `json:"legacyCmisId"`
							Name         string      `json:"name"`
							NameOrder    int         `json:"nameOrder"`
							Email        interface{} `json:"email"`
						} `json:"eligibleAssignments"`
					} `json:"eligibleMinistersAndAssignments"`
				} `json:"ministeringData"`
				MinisteringStats struct {
				} `json:"ministeringStats"`
				MinisteringAssignmentsReport struct {
				} `json:"ministeringAssignmentsReport"`
				MemberCard struct {
					Loading        bool        `json:"loading"`
					Error          interface{} `json:"error"`
					MemberCardList struct {
					} `json:"memberCardList"`
				} `json:"memberCard"`
				HouseholdCard struct {
					Loading           bool        `json:"loading"`
					Error             interface{} `json:"error"`
					HouseholdCardList struct {
					} `json:"householdCardList"`
				} `json:"householdCard"`
				MinisteringFilter struct {
					SearchText        string `json:"searchText"`
					SelectedDistricts struct {
						All bool `json:"all"`
					} `json:"selectedDistricts"`
					SelectedOptionFilters struct {
					} `json:"selectedOptionFilters"`
					SelectedOrg              string `json:"selectedOrg"`
					SelectedQuarter          string `json:"selectedQuarter"`
					UnassignedSearchText     string `json:"unassignedSearchText"`
					ShowNotGenerallyAssigned bool   `json:"showNotGenerallyAssigned"`
				} `json:"ministeringFilter"`
				UnitPicker struct {
					SelectedUnit struct {
					} `json:"selectedUnit"`
					SearchValue interface{} `json:"searchValue"`
				} `json:"unitPicker"`
				MinisteringAssignmentsFilter struct {
					HouseholdsSearchText         string `json:"householdsSearchText"`
					HouseholdsAssignedValue      string `json:"householdsAssignedValue"`
					HouseholdsOrganizationsValue string `json:"householdsOrganizationsValue"`
					IndividualsSearchText        string `json:"individualsSearchText"`
					IndividualsOrgFilter         string `json:"individualsOrgFilter"`
					IndividualsMissingFilter     string `json:"individualsMissingFilter"`
				} `json:"ministeringAssignmentsFilter"`
				MinisteringPhotos struct {
				} `json:"ministeringPhotos"`
				NewMemberReport struct {
					Data       []interface{} `json:"data"`
					SearchText string        `json:"searchText"`
					Term       string        `json:"term"`
					ShowAge    bool          `json:"showAge"`
					IsLoading  bool          `json:"isLoading"`
				} `json:"newMemberReport"`
				BirthdayList struct {
					Data        []interface{} `json:"data"`
					MonthsShown string        `json:"monthsShown"`
					UnitOrg     string        `json:"unitOrg"`
					Month       int           `json:"month"`
					ShowAge     bool          `json:"showAge"`
					IsLoading   bool          `json:"isLoading"`
				} `json:"birthdayList"`
				SacramentAttendanceReport struct {
					Data          []interface{} `json:"data"`
					Years         []interface{} `json:"years"`
					Year          interface{}   `json:"year"`
					EditMonth     interface{}   `json:"editMonth"`
					IsSaving      bool          `json:"isSaving"`
					IsLoading     bool          `json:"isLoading"`
					IsInitialLoad bool          `json:"isInitialLoad"`
					TempWeeks     []interface{} `json:"tempWeeks"`
				} `json:"sacramentAttendanceReport"`
			} `json:"initialState"`
			InitialProps struct {
				Type       string `json:"type"`
				UnitNumber int    `json:"unitNumber"`
				Tab        string `json:"tab"`
			} `json:"initialProps"`
		} `json:"pageProps"`
	} `json:"props"`
	Page  string `json:"page"`
	Query struct {
		Lang string `json:"lang"`
		Tab  string `json:"tab"`
		Type string `json:"type"`
	} `json:"query"`
	BuildID      string          `json:"buildId"`
	IsFallback   bool            `json:"isFallback"`
	CustomServer bool            `json:"customServer"`
	Gip          bool            `json:"gip"`
	Head         [][]interface{} `json:"head"`
}
```

<!--
```go
				Translations struct {
					LettersRestorationDate                                              string `json:"letters.restoration.date"`
					CommonInvalidName                                                   string `json:"common.invalid.name"`
					CommonPhone                                                         string `json:"common.phone"`
					MinisteringAttachAssignments                                        string `json:"ministering.attach.assignments"`
					CommonAssistantBranchClerkMembership                                string `json:"common.assistant.branch.clerk.membership"`
					MenuMeetinghouseTechnologyTraining                                  string `json:"menu.meetinghouse.technology.training"`
					CommonAssistantWardClerk                                            string `json:"common.assistant.ward.clerk"`
					CommonMissionExecutiveSecretaryProselyting                          string `json:"common.mission.executive.secretary.proselyting"`
					CommonExpandAll                                                     string `json:"common.expand.all"`
					CommonTimeagoSeparator                                              string `json:"common.timeago.separator"`
					MenuIssueLimitedUseRecommends                                       string `json:"menu.issue.limited-use.recommends"`
					GlobalLangDe                                                        string `json:"global.lang.de"`
					LettersValidationFieldRequired                                      string `json:"letters.validation.field.required"`
					CommonSame                                                          string `json:"common.same"`
					LettersOfficialCommunication                                        string `json:"letters.official.communication"`
					MenuSiteIsInDevelopment                                             string `json:"menu.site.is.in.development"`
					NewMemberInstructions                                               string `json:"new-member.instructions"`
					MinisteringCompanionship                                            string `json:"ministering.companionship"`
					CommonDateReceived                                                  string `json:"common.date.received"`
					MenuReliefSociety                                                   string `json:"menu.relief.society"`
					CommonUnbaptized                                                    string `json:"common.unbaptized"`
					MenuDistrictPrimary                                                 string `json:"menu.district.primary"`
					CommonPrimaryPresidency                                             string `json:"common.primary.presidency"`
					LeaderMessagingSendAddressHelp                                      string `json:"leader-messaging.send-address-help"`
					SacramentAttendanceYear                                             string `json:"sacrament-attendance.year"`
					LeaderMessagingAllAdultMembers                                      string `json:"leader-messaging.all-adult-members"`
					CommonTableFiltered                                                 string `json:"common.table.filtered"`
					MenuEditContactInfo                                                 string `json:"menu.edit.contact.info"`
					CommonEditAndSummary                                                string `json:"common.edit.and.summary"`
					CommonFilteredBy                                                    string `json:"common.filtered.by"`
					ProgressRecordViewAll                                               string `json:"progress-record.view.all"`
					LeaderMessagingAllBranchPresidents                                  string `json:"leader-messaging.all-branch-presidents"`
					CommonDefaultStakeViewMessage                                       string `json:"common.default.stake.view.message"`
					CommonArea                                                          string `json:"common.area"`
					CommonSubmitToDistrict                                              string `json:"common.submit.to.district"`
					LettersValidationSelectRestorationDate                              string `json:"letters.validation.select.restoration.date"`
					CommonAgeLabel                                                      string `json:"common.age.label"`
					LeaderMessagingBranchLeaders                                        string `json:"leader-messaging.branch-leaders"`
					MinisteringQ4                                                       string `json:"ministering.q4"`
					MenuCustomReports                                                   string `json:"menu.custom.reports"`
					MinisteringMinistersSelfAssigned                                    string `json:"ministering.ministers.self.assigned"`
					MinisteringQ2                                                       string `json:"ministering.q2"`
					MinisteringQ3                                                       string `json:"ministering.q3"`
					CommonReset                                                         string `json:"common.reset"`
					CommonUnexpectedError                                               string `json:"common.unexpected.error"`
					MenuEditQuarterlyReports                                            string `json:"menu.edit.quarterly.reports"`
					MinisteringQ1                                                       string `json:"ministering.q1"`
					CommonMailingLabelBoldName                                          string `json:"common.mailing.label.bold.name"`
					MenuIncomeExpenseDetail                                             string `json:"menu.income.expense.detail"`
					LeaderMessagingDistrictCouncil                                      string `json:"leader-messaging.district-council"`
					MinisteringPastWeek                                                 string `json:"ministering.past.week"`
					CommonMShortLabel                                                   string `json:"common.m.short.label"`
					CommonTimeagoYears                                                  string `json:"common.timeago.years"`
					MinisteringMinisteringAssignments                                   string `json:"ministering.ministering.assignments"`
					CommonYoungWomenPresidency                                          string `json:"common.young.women.presidency"`
					MenuByuPathwayWorldwide                                             string `json:"menu.byu.pathway.worldwide"`
					LeaderMessagingCalling                                              string `json:"leader-messaging.calling"`
					CommonMaxAgeX                                                       string `json:"common.max.age.x"`
					LeaderMessagingAllEldersQuorumPresidencies                          string `json:"leader-messaging.all-elders-quorum-presidencies"`
					MinisteringRsAssignmentMustBeRs                                     string `json:"ministering.rs.assignment.must.be.rs"`
					MoveYsaMassMove                                                     string `json:"move.ysa.mass.move"`
					CommonTimeagoHours                                                  string `json:"common.timeago.hours"`
					MenuNameRemoval                                                     string `json:"menu.name.removal"`
					CommonClearFilters                                                  string `json:"common.clear.filters"`
					CommonBishopX                                                       string `json:"common.bishop.x"`
					CommonFShortLabel                                                   string `json:"common.f.short.label"`
					HtvtHousehold                                                       string `json:"htvt.household"`
					CommonMaleShortLabel                                                string `json:"common.male.short.label"`
					LeaderMessagingAllWardMissionLeaders                                string `json:"leader-messaging.all-ward-mission-leaders"`
					LeaderMessagingMembers                                              string `json:"leader-messaging.members"`
					CommonShowPhone                                                     string `json:"common.show.phone"`
					MinisteringIndividualsInterviewed                                   string `json:"ministering.individuals.interviewed"`
					CommonQuickLinks                                                    string `json:"common.quick.links"`
					MenuMinisteringAssignmentProposals                                  string `json:"menu.ministering.assignment.proposals"`
					NewMemberResponsibility                                             string `json:"new-member.responsibility"`
					StatsHouseholds                                                     string `json:"stats.households"`
					GlobalLangEn                                                        string `json:"global.lang.en"`
					LettersUnknown                                                      string `json:"letters.unknown"`
					CommonAssistantStakeClerkMembership                                 string `json:"common.assistant.stake.clerk.membership"`
					MenuStakeSundaySchool                                               string `json:"menu.stake.sunday.school"`
					MenuChurchHandbooks                                                 string `json:"menu.church.handbooks"`
					BirthdayListBirthday                                                string `json:"birthday-list.birthday"`
					OrdRecordPriesthoodOrd                                              string `json:"ord.record.priesthood.ord"`
					ProgressRecordParentUnitMessage                                     string `json:"progress-record.parent.unit.message"`
					MonthsAugust                                                        string `json:"months.august"`
					ProgressRecordViewMostRecent                                        string `json:"progress-record.view.most.recent"`
					MenuIssueLimitedUseRecommends                                       string `json:"menu.issue.limited.use.recommends"`
					CommonStakeExecutiveSecretary                                       string `json:"common.stake.executive.secretary"`
					MenuSundaySchool                                                    string `json:"menu.sunday.school"`
					CommonPriestOrdination                                              string `json:"common.priest.ordination"`
					LettersValidationDateInFuture                                       string `json:"letters.validation.date.in.future"`
					DashboardGeneralHandbook                                            string `json:"dashboard.general.handbook"`
					LettersFirstPresidency                                              string `json:"letters.first.presidency"`
					FeedbackSubmit                                                      string `json:"feedback.submit"`
					Five00ServerError                                                   string `json:"500.server.error"`
					CommonAdd                                                           string `json:"common.add"`
					MinisteringInterviewIntervalInstructions                            string `json:"ministering.interview.interval.instructions"`
					LettersReadmissionCompleted                                         string `json:"letters.readmission.completed"`
					CommonHere                                                          string `json:"common.here"`
					MenuAuxiliaries                                                     string `json:"menu.auxiliaries"`
					MenuPefEndorsementForm                                              string `json:"menu.pef.endorsement.form"`
					GlobalLangFr                                                        string `json:"global.lang.fr"`
					CommonCommaSpace                                                    string `json:"common.comma.space"`
					LettersHeadquarterCommunicationsInfo                                string `json:"letters.headquarter.communications.info"`
					CalendarDayShort1                                                   string `json:"calendar.day.short.1"`
					CalendarDayShort2                                                   string `json:"calendar.day.short.2"`
					MinisteringUnassignedHouseholds                                     string `json:"ministering.unassigned.households"`
					CalendarDayShort3                                                   string `json:"calendar.day.short.3"`
					MenuClerkResourcesLcr                                               string `json:"menu.clerk.resources.lcr"`
					FeedbackLoadingText                                                 string `json:"feedback.loading.text"`
					MinisteringSaveAssignmentWarning                                    string `json:"ministering.save.assignment.warning"`
					MenuWelcomeToMembership                                             string `json:"menu.welcome.to.membership"`
					CommonSuffix                                                        string `json:"common.suffix"`
					CommonMembershipRecordNumber                                        string `json:"common.membership.record.number"`
					CommonSize                                                          string `json:"common.size"`
					LeaderMessagingYoungSingleAdults                                    string `json:"leader-messaging.young-single-adults"`
					RecordFamily                                                        string `json:"record.family"`
					MenuDonations                                                       string `json:"menu.donations"`
					MinisteringMinisterNotAuthorized                                    string `json:"ministering.minister.not.authorized"`
					GlobalLangIt                                                        string `json:"global.lang.it"`
					MenuCreateMemberOfRecord                                            string `json:"menu.create.member.of.record"`
					MinisteringInterviewIntervalInstructionsNoLink                      string `json:"ministering.interview.interval.instructions.no.link"`
					MenuTransferDetail                                                  string `json:"menu.transfer.detail"`
					CommonPriesthood6Plural                                             string `json:"common.priesthood.6.plural"`
					CommonAllMembers                                                    string `json:"common.all.members"`
					CommonWarning                                                       string `json:"common.warning"`
					CommonValidationMemberNotFoundTitle                                 string `json:"common.validation.member.not.found.title"`
					CommonFaqs                                                          string `json:"common.faqs"`
					CommonDistrictPresidencyCounselors                                  string `json:"common.district.presidency.counselors"`
					CommonSelectAll                                                     string `json:"common.select.all"`
					CommonLeftArrows                                                    string `json:"common.left.arrows"`
					MenuViewInterviews                                                  string `json:"menu.view.interviews"`
					LeaderMessagingAllExecutiveSecretaries                              string `json:"leader-messaging.all-executive-secretaries"`
					ProgressRecordStakeviewDefaultMessage                               string `json:"progress-record.stakeview.default.message"`
					CalendarDayShort4                                                   string `json:"calendar.day.short.4"`
					CalendarDayShort5                                                   string `json:"calendar.day.short.5"`
					MenuWorldwideLeadershipTraining                                     string `json:"menu.worldwide.leadership.training"`
					CalendarDayShort6                                                   string `json:"calendar.day.short.6"`
					CalendarDayShort7                                                   string `json:"calendar.day.short.7"`
					HtvtAssigned                                                        string `json:"htvt.assigned"`
					CommonMrnLabel                                                      string `json:"common.mrn.label"`
					LettersValidationSelectConfirmationOfficiator                       string `json:"letters.validation.select.confirmation.officiator"`
					LettersOrdinationDate                                               string `json:"letters.ordination.date"`
					LeaderMessagingStakeGeneralPriesthoodMeeting                        string `json:"leader-messaging.stake-general-priesthood-meeting"`
					CommonRecord                                                        string `json:"common.record"`
					MenuPrintMrs                                                        string `json:"menu.print.mrs"`
					CommonMissionClerk                                                  string `json:"common.mission.clerk"`
					CalendarHour                                                        string `json:"calendar.hour"`
					RecordFemale                                                        string `json:"record.female"`
					MemberLookupViewMemberProfile                                       string `json:"member-lookup.view.member.profile"`
					MinisteringAssignment                                               string `json:"ministering.assignment"`
					BirthdayListPageTitle                                               string `json:"birthday-list.page.title"`
					ChildProtectionCertificationNumberNumber                            string `json:"child-protection.certification.number.number"`
					HtvtFilterSubtitleUnassignedAll                                     string `json:"htvt.filter.subtitle.unassigned.all"`
					MinisteringNoDuplicateMinisters                                     string `json:"ministering.no.duplicate.ministers"`
					CommonDenyRemove                                                    string `json:"common.deny.remove"`
					MinisteringSelectedAssignments                                      string `json:"ministering.selected.assignments"`
					MenuProposedAssignments                                             string `json:"menu.proposed.assignments"`
					CommonClerkResourcesCommunication                                   string `json:"common.clerk.resources.communication"`
					CommonCopyrightText                                                 string `json:"common.copyright.text"`
					MinisteringInterviewCurrentQuarterInfo                              string `json:"ministering.interview.current.quarter.info"`
					LeaderMessagingSendAssignment                                       string `json:"leader-messaging.send-assignment"`
					HtvtPageTitle                                                       string `json:"htvt.page.title"`
					MenuMembershipAudit                                                 string `json:"menu.membership.audit"`
					MinisteringAssignmentProposalsInfo                                  string `json:"ministering.assignment.proposals.info"`
					LeaderMessagingRecipientCountSingular                               string `json:"leader-messaging.recipient-count-singular"`
					MenuUnitSettings                                                    string `json:"menu.unit.settings"`
					CommonDays                                                          string `json:"common.days"`
					CommonYear                                                          string `json:"common.year"`
					LeaderMessagingAllBishops                                           string `json:"leader-messaging.all-bishops"`
					CommonViewSelectedSections                                          string `json:"common.view.selected.sections"`
					BirthdayListYoungMen                                                string `json:"birthday-list.young.men"`
					CommonWardBishopricCounselors                                       string `json:"common.ward.bishopric.counselors"`
					MenuStakeYoungWomen                                                 string `json:"menu.stake.young.women"`
					GlobalLangIs                                                        string `json:"global.lang.is"`
					RecordHouseholdEmail                                                string `json:"record.household.email"`
					MenuRecordPatriarchOrdination                                       string `json:"menu.record.patriarch.ordination"`
					OrdTempleOrdinances                                                 string `json:"ord.temple.ordinances"`
					MenuViewStatistics                                                  string `json:"menu.view.statistics"`
					CommonLocalUnit                                                     string `json:"common.local.unit"`
					MenuActionItems                                                     string `json:"menu.action.items"`
					MenuTemple                                                          string `json:"menu.temple"`
					MenuActionsInProcess                                                string `json:"menu.actions.in.process"`
					PefSubmitEndorsement                                                string `json:"pef.submit.endorsement"`
					MinisteringEditAssignments                                          string `json:"ministering.edit.assignments"`
					CommonBaptismDate                                                   string `json:"common.baptism.date"`
					MenuFinance                                                         string `json:"menu.finance"`
					MenuPaymentCards                                                    string `json:"menu.payment.cards"`
					MinisteringNoCompanionshipsCreatedPreviousQuarter                   string `json:"ministering.no.companionships.created.previous.quarter"`
					CommonPrintLater                                                    string `json:"common.print.later"`
					MenuStakeLeadership                                                 string `json:"menu.stake.leadership"`
					MenuPlaceOrRemoveMoveRestriction                                    string `json:"menu.place.or.remove.move.restriction"`
					MenuWelfareServiceRequests                                          string `json:"menu.welfare.service.requests"`
					CommonUpdate                                                        string `json:"common.update"`
					MenuLimitedUseRecommends                                            string `json:"menu.limited.use.recommends"`
					LeaderMessagingAllAuxiliaryPresidencies                             string `json:"leader-messaging.all-auxiliary-presidencies"`
					MinisteringShowChanges                                              string `json:"ministering.show.changes"`
					CommonPrevious                                                      string `json:"common.previous"`
					CommonElderOrdination                                               string `json:"common.elder.ordination"`
					CommonUnknown                                                       string `json:"common.unknown"`
					CommonBranchPresidentTitle                                          string `json:"common.branch_president.title"`
					CommonUnitName                                                      string `json:"common.unit.name"`
					LettersValidationConfirmationDateBefore                             string `json:"letters.validation.confirmation.date.before"`
					LeaderMessagingAllMelchizedekPriesthood                             string `json:"leader-messaging.all.melchizedek.priesthood"`
					MenuPrintCertificates                                               string `json:"menu.print.certificates"`
					MenuAssistingReturningFromWar                                       string `json:"menu.assisting.returning.from.war"`
					CommonMemberName                                                    string `json:"common.member.name"`
					PefPageTitle                                                        string `json:"pef.page.title"`
					MinisteringLastInterview                                            string `json:"ministering.last.interview"`
					CommonPriesthoodElder                                               string `json:"common.priesthood.elder"`
					MenuMissionaryRecommendEntry                                        string `json:"menu.missionary.recommend.entry"`
					LettersValidationExplanationToLong                                  string `json:"letters.validation.explanation.to.long"`
					CommonRecordNumberHeading                                           string `json:"common.record.number.heading"`
					MenuRollsAndLists                                                   string `json:"menu.rolls.and.lists"`
					MenuTempleEndowment                                                 string `json:"menu.temple.endowment"`
					CommonTimeagoSuffixAgo                                              string `json:"common.timeago.suffix.ago"`
					CommonLittleDelete                                                  string `json:"common.little.delete"`
					CommonSelectPosition                                                string `json:"common.select.position"`
					MinisteringPreviousQuarter                                          string `json:"ministering.previous.quarter"`
					MenuSeminaryRegistration                                            string `json:"menu.seminary.registration"`
					CommonPriesthoodLowercase5                                          string `json:"common.priesthood.lowercase.5"`
					MonthsJanuary                                                       string `json:"months.january"`
					CommonUnit                                                          string `json:"common.unit"`
					CommonPriesthoodLowercase6                                          string `json:"common.priesthood.lowercase.6"`
					CommonSave                                                          string `json:"common.save"`
					MinisteringHouseholds                                               string `json:"ministering.households"`
					NewMemberPageTitle                                                  string `json:"new-member.page.title"`
					ProgressRecordEligibleAaronic                                       string `json:"progress-record.eligible.aaronic"`
					CommonPriesthoodLowercase9                                          string `json:"common.priesthood.lowercase.9"`
					CommonCollapseAll                                                   string `json:"common.collapse.all"`
					LettersRestorationOfBlessingsInterviewNotRestore                    string `json:"letters.restoration.of.blessings.interview.not.restore"`
					MenuYoungWomen                                                      string `json:"menu.young.women"`
					MinisteringMinisteringInterviews                                    string `json:"ministering.ministering.interviews"`
					CommonPriesthoodLowercase1                                          string `json:"common.priesthood.lowercase.1"`
					CommonAlertFatherNotFound                                           string `json:"common.alert.father.not.found"`
					LeaderMessagingYoungMen                                             string `json:"leader-messaging.young-men"`
					MinisteringAllCompanionships                                        string `json:"ministering.all.companionships"`
					CommonPriesthoodLowercase3                                          string `json:"common.priesthood.lowercase.3"`
					CommonMoreThanXYears                                                string `json:"common.more.than.x.years"`
					CommonPriesthoodLowercase4                                          string `json:"common.priesthood.lowercase.4"`
					CommonWardMissionary                                                string `json:"common.ward.missionary"`
					SacramentAttendancePageTitle                                        string `json:"sacrament-attendance.page.title"`
					CommonPriesthoodLowercase2                                          string `json:"common.priesthood.lowercase.2"`
					MenuMembersWithoutCallings                                          string `json:"menu.members.without.callings"`
					RecordPostalCode                                                    string `json:"record.postal.code"`
					CommonSelectMember                                                  string `json:"common.select.member"`
					CommonBranchClerk                                                   string `json:"common.branch.clerk"`
					LeaderMessagingElders                                               string `json:"leader-messaging.elders"`
					RecordCurrentUnit                                                   string `json:"record.current.unit"`
					RecommendVoidRecommend                                              string `json:"recommend.void.recommend"`
					CommonSelectYear                                                    string `json:"common.select.year"`
					MinisteringCurrentQuarter                                           string `json:"ministering.current.quarter"`
					LeaderMessagingLeaders                                              string `json:"leader-messaging.leaders"`
					LostMembersMemberNotFound                                           string `json:"lost-members.member.not.found"`
					LettersValidationSelectConfirmation                                 string `json:"letters.validation.select.confirmation"`
					CommonLookup                                                        string `json:"common.lookup"`
					CommonBranchMissionary                                              string `json:"common.branch.missionary"`
					CommonAllIndividuals                                                string `json:"common.all.individuals"`
					RecordHouseholdPhone                                                string `json:"record.household.phone"`
					RecommendExpired                                                    string `json:"recommend.expired"`
					Months11                                                            string `json:"months.11"`
					Months10                                                            string `json:"months.10"`
					MenuBirthdayList                                                    string `json:"menu.birthday.list"`
					LeaderMessagingErrorNoSenderEmail                                   string `json:"leader-messaging.error-no-sender-email"`
					MinisteringDistricts                                                string `json:"ministering.districts"`
					MenuHighCouncil                                                     string `json:"menu.high.council"`
					MinisteringHasBishopApproved                                        string `json:"ministering.has.bishop.approved"`
					MinisteringAssignedHouseholds                                       string `json:"ministering.assigned.households"`
					MenuRecommendPerform                                                string `json:"menu.recommend.perform"`
					MinisteringNoCompanionshipsCreatedPreviousQuarterPreMinistering     string `json:"ministering.no.companionships.created.previous.quarter.pre.ministering"`
					MenuCertificates                                                    string `json:"menu.certificates"`
					MenuBudgetSummary                                                   string `json:"menu.budget.summary"`
					MenuReportsRolls                                                    string `json:"menu.reports.rolls"`
					MenuDonationBatchSummary                                            string `json:"menu.donation.batch.summary"`
					MemberLookupFindIndividualsAndPages                                 string `json:"member-lookup.find.individuals.and.pages"`
					CommonBrothers                                                      string `json:"common.brothers"`
					MenuBoyScouts                                                       string `json:"menu.boy.scouts"`
					LettersCancellationOfSealingDecision                                string `json:"letters.cancellation.of.sealing.decision"`
					CommonSelect                                                        string `json:"common.select"`
					CommonSavingOnly                                                    string `json:"common.saving.only"`
					CommonMissionExecutiveSecretary                                     string `json:"common.mission.executive.secretary"`
					MinisteringPresidencyMemberColon                                    string `json:"ministering.presidency.member.colon"`
					CommonDistrictClerk                                                 string `json:"common.district.clerk"`
					CommonSendMessage                                                   string `json:"common.send.message"`
					ChildProtectionActive                                               string `json:"child-protection.active"`
					CommonActiveDate                                                    string `json:"common.active.date"`
					MinisteringAnnotationPresentClerk                                   string `json:"ministering.annotation.present.clerk"`
					CommonPrintInstructions                                             string `json:"common.print.instructions"`
					MenuRequestAddRemoveAnnotation                                      string `json:"menu.request.add.remove.annotation"`
					CommonDistrictPrimaryPresidency                                     string `json:"common.district.primary.presidency"`
					CommonUnitNumber                                                    string `json:"common.unit.number"`
					MinisteringBishopBranchPresidentApprovedAssignment                  string `json:"ministering.bishop.branch.president.approved.assignment"`
					MenuChildProtectionComplianceSystem                                 string `json:"menu.child.protection.compliance.system"`
					CommonAll                                                           string `json:"common.all"`
					FeedbackBug                                                         string `json:"feedback.bug"`
					CommonHomePhone                                                     string `json:"common.home.phone"`
					CommonMailingLabels                                                 string `json:"common.mailing.labels"`
					CallingsMoveTo                                                      string `json:"callings.move.to"`
					MenuAllReports                                                      string `json:"menu.all.reports"`
					LettersValidationConfirmationOfficiatorPriesthood                   string `json:"letters.validation.confirmation.officiator.priesthood"`
					MinisteringPrintAssignments                                         string `json:"ministering.print.assignments"`
					MenuIssueLimitedUseGroupRecommends                                  string `json:"menu.issue.limited.use.group.recommends"`
					CommonUnavailable                                                   string `json:"common.unavailable"`
					RecordResidentialAddress                                            string `json:"record.residential.address"`
					MenuEditMembershipInformation                                       string `json:"menu.edit.membership.information"`
					LeaderMessagingWardCouncil                                          string `json:"leader-messaging.ward-council"`
					LeaderMessagingAllowReplyAllHelp                                    string `json:"leader-messaging.allow-reply-all-help"`
					MenuLearnAboutMinisteringDescription                                string `json:"menu.learn.about.ministering.description"`
					MenuManageCompanionships                                            string `json:"menu.manage.companionships"`
					CommonPleaseContactGsc                                              string `json:"common.please.contact.gsc"`
					CommonPleaseEnterMemberName                                         string `json:"common.please.enter.member.name"`
					CommonAgeColon                                                      string `json:"common.age.colon"`
					MenuLawOfTheFastTraining                                            string `json:"menu.law.of.the.fast.training"`
					LettersConfidentialCommunication                                    string `json:"letters.confidential.communication"`
					CommonSubmitToStake                                                 string `json:"common.submit.to.stake"`
					CommonPartialDateHelp                                               string `json:"common.partial.date.help"`
					MinisteringIndividualDoesNotQualify                                 string `json:"ministering.individual.does.not.qualify"`
					MenuCreateAReport                                                   string `json:"menu.create.a.report"`
					MenuMissionaryProgressRecord                                        string `json:"menu.missionary.progress.record"`
					OrdTeacherOrdinationCertificate                                     string `json:"ord.teacher.ordination.certificate"`
					LettersType                                                         string `json:"letters.type"`
					BetaBeta                                                            string `json:"beta.beta"`
					CommonDisplayOptions                                                string `json:"common.display.options"`
					CommonMembershipNumber                                              string `json:"common.membership.number"`
					CommonSisters                                                       string `json:"common.sisters"`
					CommonAllOrganizations                                              string `json:"common.all.organizations"`
					CommonNotConfirmed                                                  string `json:"common.not.confirmed"`
					CommonLoadingText                                                   string `json:"common.loading.text"`
					LettersInstructions                                                 string `json:"letters.instructions"`
					CommonPrintMultipleCopies                                           string `json:"common.print.multiple.copies"`
					MenuRecordAaronicPriesthoodOrdination                               string `json:"menu.record.aaronic.priesthood.ordination"`
					CommonYoungMenPresidency                                            string `json:"common.young.men.presidency"`
					GlobalProxyMessage                                                  string `json:"global.proxy.message"`
					CommonNoResultsReportTable                                          string `json:"common.no.results.report.table"`
					MinisteringAttachAssignment                                         string `json:"ministering.attach.assignment"`
					OrdChildBlessingCertificate                                         string `json:"ord.child.blessing.certificate"`
					MenuChastityAndFidelity                                             string `json:"menu.chastity.and.fidelity"`
					LettersReinstatementApprovalInstructions                            string `json:"letters.reinstatement.approval.instructions"`
					CommonInvalidDateExpectedFormat                                     string `json:"common.invalid.date.expected.format"`
					MenuMinisteringSisters                                              string `json:"menu.ministering.sisters"`
					MenuDistrictQuarterlyReport                                         string `json:"menu.district.quarterly.report"`
					CommonSelectedMembers                                               string `json:"common.selected.members"`
					RecordName                                                          string `json:"record.name"`
					LeaderMessagingFrom                                                 string `json:"leader-messaging.from"`
					MinisteringAssignedCurrentQuarterInfo                               string `json:"ministering.assigned.current.quarter.info"`
					RecommendTempleRecommendStatusLabel                                 string `json:"recommend.temple.recommend.status.label"`
					MenuDistrictPresidency                                              string `json:"menu.district.presidency"`
					ProgressRecordOtherCommitments                                      string `json:"progress-record.other.commitments"`
					DashboardWelfareResources                                           string `json:"dashboard.welfare.resources"`
					DashboardDataPrivacy                                                string `json:"dashboard.data.privacy"`
					MinisteringNoCompanionshipsInDistrict                               string `json:"ministering.no.companionships.in.district"`
					LeaderMessagingDeliveryResultRejectNoticeAttachmentSizeExceeded     string `json:"leader-messaging.delivery-result-reject-notice-attachment-size-exceeded"`
					MenuQuarterlyReport                                                 string `json:"menu.quarterly.report"`
					CommonContinue                                                      string `json:"common.continue"`
					CommonCmirPrintWarning                                              string `json:"common.cmir.print.warning"`
					MenuExpenseDetail                                                   string `json:"menu.expense.detail"`
					MessagesMenuRequestMinutes                                          string `json:"messages.menu.request.minutes"`
					LettersReadmissionInterviewNotReadmitted                            string `json:"letters.readmission.interview.not.readmitted"`
					MinisteringNewAndModifiedAssignments                                string `json:"ministering.new.and.modified.assignments"`
					LettersConfidentialRecordCommunication                              string `json:"letters.confidential.record.communication"`
					CommonActions                                                       string `json:"common.actions"`
					MinisteringQuarterlyReportNotifyClerk                               string `json:"ministering.quarterly.report.notify.clerk"`
					LeaderMessagingChooseFile                                           string `json:"leader-messaging.choose.file"`
					MinisteringPastMonth                                                string `json:"ministering.past.month"`
					LettersCancellationOfSealingApprovalInstructions                    string `json:"letters.cancellation.of.sealing.approval.instructions"`
					MinisteringNoCompanion                                              string `json:"ministering.no.companion"`
					MinisteringRecentChanges                                            string `json:"ministering.recent.changes"`
					CalendarMonthLong8                                                  string `json:"calendar.month.long.8"`
					MinisteringTeaserDescription                                        string `json:"ministering.teaser.description"`
					CalendarMonthLong9                                                  string `json:"calendar.month.long.9"`
					BirthdayListReliefSociety                                           string `json:"birthday-list.relief.society"`
					CommonPrintMailingLabels                                            string `json:"common.print.mailing.labels"`
					CalendarMonthLong4                                                  string `json:"calendar.month.long.4"`
					CalendarMonthLong5                                                  string `json:"calendar.month.long.5"`
					CalendarMonthLong6                                                  string `json:"calendar.month.long.6"`
					GlobalErrorGlobal                                                   string `json:"global.error.global"`
					EmploymentIndividualsRequesting                                     string `json:"employment.individuals.requesting"`
					MenuCurrentAssignments                                              string `json:"menu.current.assignments"`
					CalendarMonthLong7                                                  string `json:"calendar.month.long.7"`
					MinisteringInterviewPreviousQuarterInfoQr                           string `json:"ministering.interview.previous.quarter.info.qr"`
					LostMembersCannotFindMember                                         string `json:"lost-members.cannot.find.member"`
					LeaderMessagingAllPrimaryPresidencies                               string `json:"leader-messaging.all-primary-presidencies"`
					CommonCurrentlyServingMission                                       string `json:"common.currently.serving.mission"`
					CommonCurrent                                                       string `json:"common.current"`
					ChildProtectionCertificationStatusPageTitle                         string `json:"child-protection.certification.status.page.title"`
					LostMembersRestoreToUnit                                            string `json:"lost-members.restore.to.unit"`
					DashboardOrderOfficeSupplies                                        string `json:"dashboard.order.office.supplies"`
					LostMembersNotFoundContactFamily                                    string `json:"lost-members.not.found.contact.family"`
					MonthsJuly                                                          string `json:"months.july"`
					MinisteringHideChanges                                              string `json:"ministering.hide.changes"`
					CommonBackToReports                                                 string `json:"common.back.to.reports"`
					NewReturningMemberTitle                                             string `json:"new-returning-member.title"`
					GlobalLangTy                                                        string `json:"global.lang.ty"`
					Four04UseBrowserBackButton                                          string `json:"404.use.browser.back.button"`
					LeaderMessagingChurchPurposesOnly                                   string `json:"leader-messaging.church.purposes.only"`
					LettersSealingClearanceDisapprovalInstructions                      string `json:"letters.sealing.clearance.disapproval.instructions"`
					MenuMembershipRecords                                               string `json:"menu.membership.records"`
					CommonShowCurrentUnit                                               string `json:"common.show.current.unit"`
					CommonCorrectErrors                                                 string `json:"common.correct.errors"`
					MenuRecordingMembershipInfo                                         string `json:"menu.recording.membership.info"`
					CommonMonths                                                        string `json:"common.months"`
					CommonSaveAndContinue                                               string `json:"common.save.and.continue"`
					LostMembersNotFoundBishop                                           string `json:"lost-members.not.found.bishop"`
					LeaderMessagingFooterText                                           string `json:"leader-messaging.footer-text"`
					CommonAllPriesthoodOffices                                          string `json:"common.all.priesthood.offices"`
					LostMembersInfoLine2                                                string `json:"lost-members.info.line2"`
					LostMembersInfoLine1                                                string `json:"lost-members.info.line1"`
					MenuEldersQuorum                                                    string `json:"menu.elders.quorum"`
					CommonLittleUndelete                                                string `json:"common.little.undelete"`
					CommonBranchPresident                                               string `json:"common.branch.president"`
					GlobalLangSq                                                        string `json:"global.lang.sq"`
					MenuServingYsa                                                      string `json:"menu.serving.ysa"`
					MenuSignOut                                                         string `json:"menu.sign.out"`
					RecommendCanceled                                                   string `json:"recommend.canceled"`
					CommonWardClerk                                                     string `json:"common.ward.clerk"`
					CommonSummary                                                       string `json:"common.summary"`
					CalendarMonthLong1                                                  string `json:"calendar.month.long.1"`
					CalendarMonthLong2                                                  string `json:"calendar.month.long.2"`
					CalendarMonthLong3                                                  string `json:"calendar.month.long.3"`
					CommonYears                                                         string `json:"common.years"`
					MenuEmployeeEndorsementSystem                                       string `json:"menu.employee.endorsement.system"`
					CommonPriesthoodHighPriest                                          string `json:"common.priesthood.high_priest"`
					MenuStakeYoungMen                                                   string `json:"menu.stake.young.men"`
					OrdMemberOfThisStake                                                string `json:"ord.member.of.this.stake"`
					MinisteringShowIndividualsInfoRs                                    string `json:"ministering.show.individuals.info.rs"`
					MenuClerkResources                                                  string `json:"menu.clerk.resources"`
					MenuReleaseNotes                                                    string `json:"menu.release.notes"`
					CommonMtcPresidencyCounselors                                       string `json:"common.mtc.presidency.counselors"`
					CommonLearnMoreRkats                                                string `json:"common.learn.more.rkats"`
					MenuBudget                                                          string `json:"menu.budget"`
					RecordConfidentialDescriptionViewAnnotation                         string `json:"record.confidential.description.view.annotation"`
					LostMembersAddedToList                                              string `json:"lost-members.added.to.list"`
					FeedbackErrorGlobal                                                 string `json:"feedback.error.global"`
					LettersReinstatementDisapprovalInstructions                         string `json:"letters.reinstatement.disapproval.instructions"`
					MinisteringAssignmentReliefSocietyInfo                              string `json:"ministering.assignment.relief.society.info"`
					CommonPriesthoodPriest                                              string `json:"common.priesthood.priest"`
					CommonBuildDate                                                     string `json:"common.build.date"`
					CommonViewInCdol                                                    string `json:"common.view.in.cdol"`
					BirthdayListHighPriestsQuorum                                       string `json:"birthday-list.high.priests.quorum"`
					CommonNotApplicable                                                 string `json:"common.not.applicable"`
					BirthdayListEldersQuorum                                            string `json:"birthday-list.elders.quorum"`
					CommonDefault                                                       string `json:"common.default"`
					FeedbackThanks                                                      string `json:"feedback.thanks"`
					HtvtNotAssigned                                                     string `json:"htvt.not.assigned"`
					CommonSaveAsDraft                                                   string `json:"common.save.as.draft"`
					LettersLiftingOfSealingRestrictionDisapprovalInstructions           string `json:"letters.lifting.of.sealing.restriction.disapproval.instructions"`
					MinisteringMinisterAlreadyAssigned                                  string `json:"ministering.minister.already.assigned"`
					CommonStake                                                         string `json:"common.stake"`
					ChildProtectionStatus                                               string `json:"child-protection.status"`
					CommonTotal                                                         string `json:"common.total"`
					CommonMissionaryTrainingCenter                                      string `json:"common.missionary_training_center"`
					MenuTithingDeclaration                                              string `json:"menu.tithing.declaration"`
					CommonHomeTeachingDistrictSupervisor                                string `json:"common.home.teaching.district.supervisor"`
					MenuMemberLookup                                                    string `json:"menu.member.lookup"`
					HtvtHomeTeachers                                                    string `json:"htvt.home.teachers"`
					CommonPriesthoodOffice                                              string `json:"common.priesthood.office"`
					CommonStreetAddress                                                 string `json:"common.street.address"`
					CommonHousehold                                                     string `json:"common.household"`
					MinisteringDistrictName                                             string `json:"ministering.district.name"`
					SacramentAttendanceAverage                                          string `json:"sacrament-attendance.average"`
					ProgressRecordMissionaryServiceError                                string `json:"progress-record.missionary.service.error"`
					CommonPleaseCorrectErrors                                           string `json:"common.please.correct.errors"`
					RecordHeadOfHousehold                                               string `json:"record.head.of.household"`
					LeaderMessagingTeaserDescriptionFromApplication                     string `json:"leader-messaging.teaser.description.from.application"`
					MonthsJune                                                          string `json:"months.june"`
					CalendarDone                                                        string `json:"calendar.done"`
					MenuRecordBishopOrdination                                          string `json:"menu.record.bishop.ordination"`
					MenuMembersMovedOut                                                 string `json:"menu.members.moved.out"`
					CommonConfirmationDate                                              string `json:"common.confirmation.date"`
					CommonAssistantBranchClerk                                          string `json:"common.assistant.branch.clerk"`
					CommonDelete                                                        string `json:"common.delete"`
					CommonRightArrows                                                   string `json:"common.right.arrows"`
					CommonDistrictPresident                                             string `json:"common.district.president"`
					LeaderMessagingFileTooBigError                                      string `json:"leader-messaging.file.too.big.error"`
					CommonShowCurrentAge                                                string `json:"common.show.current.age"`
					LettersRestorationOfBlessingsWithdrawnInstructions                  string `json:"letters.restoration.of.blessings.withdrawn.instructions"`
					LeaderMessagingAllBranchYsaLeaders                                  string `json:"leader-messaging.all-branch-ysa-leaders"`
					MenuReadmissionAfterNameRemoval                                     string `json:"menu.readmission.after.name.removal"`
					CommonPendingRecordInformation                                      string `json:"common.pending.record.information"`
					CommonPrintCertificate                                              string `json:"common.print.certificate"`
					CommonStakeReliefSocietyPresidency                                  string `json:"common.stake.relief.society.presidency"`
					MinisteringHqAnnotationMessage                                      string `json:"ministering.hq.annotation.message"`
					LeaderMessagingAllYoungMenLeaders                                   string `json:"leader-messaging.all-young-men-leaders"`
					CommonMelchizedekPriesthoodOrdination                               string `json:"common.melchizedek.priesthood.ordination"`
					CommonMoreThan1Year                                                 string `json:"common.more.than.1.year"`
					MemberListAllIndividuals                                            string `json:"member-list.all.individuals"`
					CommonPriesthoodLabel                                               string `json:"common.priesthood.label"`
					GlobalLdsChurch                                                     string `json:"global.lds.church"`
					CommonMemberDetails                                                 string `json:"common.member.details"`
					Four04ReturnToReportForms                                           string `json:"404.return.to.report.forms"`
					CommonEdit                                                          string `json:"common.edit"`
					MenuMemberFocus                                                     string `json:"menu.member.focus"`
					CommonUpdating                                                      string `json:"common.updating"`
					CommonDateColon                                                     string `json:"common.date.colon"`
					CommonFemaleShortLabel                                              string `json:"common.female.short.label"`
					MinisteringUnassignedMinisteringBrothers                            string `json:"ministering.unassigned.ministering.brothers"`
					CommonReliefSocietyMinisteringSecretary                             string `json:"common.relief.society.ministering.secretary"`
					MenuResources                                                       string `json:"menu.resources"`
					CommonUnexpectedErrorTitle                                          string `json:"common.unexpected.error.title"`
					MenuSendAMessage                                                    string `json:"menu.send.a.message"`
					MinisteringMinisterNotOldEnough                                     string `json:"ministering.minister.not.old.enough"`
					CommonInterviewDate                                                 string `json:"common.interview.date"`
					LeaderMessagingAllowReplyAll                                        string `json:"leader-messaging.allow-reply-all"`
					CommonMemberNotFound                                                string `json:"common.member.not.found"`
					MenuMembershipCouncils                                              string `json:"menu.membership.councils"`
					CommonSaving                                                        string `json:"common.saving"`
					LettersFirstPresidencyDecisionLetter                                string `json:"letters.first.presidency.decision.letter"`
					CommonMLongLabel                                                    string `json:"common.m.long.label"`
					CommonIndividualEmail                                               string `json:"common.individual.email"`
					LostMembersJoinHeadofhousehold                                      string `json:"lost-members.join.headofhousehold"`
					HtvtFilterSubtitleUnassignedHomeTeachers                            string `json:"htvt.filter.subtitle.unassigned.home.teachers"`
					CommonEldersQuorumMinisteringSecretary                              string `json:"common.elders.quorum.ministering.secretary"`
					MenuYoungChurchServiceMissionaries                                  string `json:"menu.young.church.service.missionaries"`
					MinisteringInterviewPreviousQuarterInfo                             string `json:"ministering.interview.previous.quarter.info"`
					GlobalLangZh                                                        string `json:"global.lang.zh"`
					OrdPrimaryAdvancementCertificate                                    string `json:"ord.primary.advancement.certificate"`
					CommonPosition                                                      string `json:"common.position"`
					CommonSignatureParentOrGuardian                                     string `json:"common.signature.parent.or.guardian"`
					CallingsSetApart                                                    string `json:"callings.set.apart"`
					CommonSubmitToHq                                                    string `json:"common.submit.to.hq"`
					MenuNewLeaderRecommendations                                        string `json:"menu.new.leader.recommendations"`
					MenuOther                                                           string `json:"menu.other"`
					LeaderMessagingBranchPriesthoodLeadershipMeeting                    string `json:"leader-messaging.branch-priesthood-leadership-meeting"`
					CommonReliefSocietyPresidency                                       string `json:"common.relief.society.presidency"`
					CommonNoThanks                                                      string `json:"common.no.thanks"`
					LeaderMessagingClerks                                               string `json:"leader-messaging.clerks"`
					MenuDonationBatchDetail                                             string `json:"menu.donation.batch.detail"`
					MinisteringSearchMembers                                            string `json:"ministering.search.members"`
					MenuSingleAdults                                                    string `json:"menu.single.adults"`
					ChildProtectionUploadNewCertification                               string `json:"child-protection.upload.new.certification"`
					LettersValidationEnterExplanation                                   string `json:"letters.validation.enter.explanation"`
					LettersValidationOrdinationDateBefore                               string `json:"letters.validation.ordination.date.before"`
					ChildProtectionGovernmentCertificationsInfo                         string `json:"child-protection.government.certifications.info"`
					CommonAging                                                         string `json:"common.aging"`
					LeaderMessagingMessageSentError                                     string `json:"leader-messaging.message-sent-error"`
					LeaderMessagingParentsYoungWomen                                    string `json:"leader-messaging.parents-young-women"`
					CommonStakePrimaryPresidency                                        string `json:"common.stake.primary.presidency"`
					MenuMemberList                                                      string `json:"menu.member.list"`
					MinisteringSearchHouseholds                                         string `json:"ministering.search.households"`
					CommonWardsAndBranches                                              string `json:"common.wards.and.branches"`
					CommonMissionPresidencyCounselors                                   string `json:"common.mission.presidency.counselors"`
					RecordPriorUnit                                                     string `json:"record.prior.unit"`
					LeaderMessagingDistrictGeneralPriesthoodMeeting                     string `json:"leader-messaging.district-general-priesthood-meeting"`
					MinisteringAssignmentProposalsPublishSuccess                        string `json:"ministering.assignment.proposals.publish.success"`
					LettersReinstatementWithdrawnInstructions                           string `json:"letters.reinstatement.withdrawn.instructions"`
					CommonRemoving                                                      string `json:"common.removing"`
					CommonFindMemberInList                                              string `json:"common.find.member.in.list"`
					LeaderMessagingSearchRecipients                                     string `json:"leader-messaging.search-recipients"`
					CommonSuccess                                                       string `json:"common.success"`
					MenuSingleMembers                                                   string `json:"menu.single.members"`
					CalendarMinute                                                      string `json:"calendar.minute"`
					FeedbackLoveIt                                                      string `json:"feedback.love.it"`
					BirthdayListMonthsToShow                                            string `json:"birthday-list.months.to.show"`
					LettersExplanation                                                  string `json:"letters.explanation"`
					LeaderMessagingWardYouthCouncil                                     string `json:"leader-messaging.ward-youth-council"`
					RecordBirthPlace                                                    string `json:"record.birth.place"`
					MenuPriesthood                                                      string `json:"menu.priesthood"`
					MenuPrimary                                                         string `json:"menu.primary"`
					MinisteringAssignments                                              string `json:"ministering.assignments"`
					MenuSupportingCorrectionalFacilities                                string `json:"menu.supporting.correctional.facilities"`
					CommonMb                                                            string `json:"common.mb"`
					Topics1                                                             string `json:"topics.1"`
					CommonDeleting                                                      string `json:"common.deleting"`
					LettersConfirmationOfficiator                                       string `json:"letters.confirmation.officiator"`
					CommonEmailLabel                                                    string `json:"common.email.label"`
					MinisteringRsMinistersCannotHaveMales                               string `json:"ministering.rs.ministers.cannot.have.males"`
					LettersValidationBaptismOfficiatorPriesthood                        string `json:"letters.validation.baptism.officiator.priesthood"`
					RecordCity                                                          string `json:"record.city"`
					MinisteringAssignmentNotAuthorized                                  string `json:"ministering.assignment.not.authorized"`
					MenuAccessTable                                                     string `json:"menu.access.table"`
					MinisteringMinisteringBrothers                                      string `json:"ministering.ministering.brothers"`
					MenuSeniorMissionaryTraining                                        string `json:"menu.senior.missionary.training"`
					HtvtFilterSubtitleAllAll                                            string `json:"htvt.filter.subtitle.all.all"`
					CommonPleaseSelect                                                  string `json:"common.please.select"`
					MenuCreateReports                                                   string `json:"menu.create.reports"`
					LettersValidationArgumentOutOfRange                                 string `json:"letters.validation.argument.out.of.range"`
					SacramentAttendanceWarnOver100Percent                               string `json:"sacrament-attendance.warn.over.100.percent"`
					CommonIndividual                                                    string `json:"common.individual"`
					CommonMonth                                                         string `json:"common.month"`
					MinisteringAssignmentAttemptAnnotationUnitLeaderSubject             string `json:"ministering.assignment.attempt.annotation.unit.leader.subject"`
					MenuMissionPresidency                                               string `json:"menu.mission.presidency"`
					CommonMemberInfo                                                    string `json:"common.member.info"`
					CommonMrnOrNameRequired                                             string `json:"common.mrn.or.name.required"`
					MenuStakePresidency                                                 string `json:"menu.stake.presidency"`
					CommonEldersQuorumPresidency                                        string `json:"common.elders.quorum.presidency"`
					CommonCorrectWarnings                                               string `json:"common.correct.warnings"`
					MenuNewMember                                                       string `json:"menu.new.member"`
					LeaderMessagingBishopricYouthCommittee                              string `json:"leader-messaging.bishopric-youth-committee"`
					MenuEmplymentResourceServices                                       string `json:"menu.emplyment.resource.services"`
					GlobalLangNl                                                        string `json:"global.lang.nl"`
					Five00ReturnToReportForms                                           string `json:"500.return.to.report.forms"`
					HtvtFilterSubtitleAssignedVisitingTeachers                          string `json:"htvt.filter.subtitle.assigned.visiting.teachers"`
					CommonKb                                                            string `json:"common.kb"`
					BirthdayListPrimary                                                 string `json:"birthday-list.primary"`
					MenuReports                                                         string `json:"menu.reports"`
					CommonPrint                                                         string `json:"common.print"`
					CommonValidationWarning                                             string `json:"common.validation.warning"`
					CommonDate                                                          string `json:"common.date"`
					CommonError                                                         string `json:"common.error"`
					MinisteringMinisteringLabel                                         string `json:"ministering.ministering.label"`
					PefInterviewQuestions                                               string `json:"pef.interview.questions"`
					MenuMinisteringReliefSociety                                        string `json:"menu.ministering.relief.society"`
					CommonMtcPresident                                                  string `json:"common.mtc.president"`
					LettersReinstatementCompleted                                       string `json:"letters.reinstatement.completed"`
					CommonLoseChangesIfLeave                                            string `json:"common.lose.changes.if.leave"`
					MenuStakePrimary                                                    string `json:"menu.stake.primary"`
					LeaderMessagingSenderInfoHelp                                       string `json:"leader-messaging.sender-info-help"`
					LeaderMessagingNoFileChosen                                         string `json:"leader-messaging.no.file.chosen"`
					MenuRecommends                                                      string `json:"menu.recommends"`
					ProgressRecordViewDetails                                           string `json:"progress-record.view.details"`
					ChildProtectionProtectingChildrenYouth                              string `json:"child-protection.protecting.children.youth"`
					CommonSetup                                                         string `json:"common.setup"`
					MinisteringAssignmentProposalsSisters                               string `json:"ministering.assignment.proposals.sisters"`
					CommonValidationOfficiatorNameNotMatch                              string `json:"common.validation.officiator.name.not.match"`
					ClassAndQuorumAttendanceOverviewViewMore                            string `json:"class-and-quorum-attendance.overview.view.more"`
					BirthdayListYoungWomen                                              string `json:"birthday-list.young.women"`
					LettersFirstPresidencyDecisions                                     string `json:"letters.first.presidency.decisions"`
					FeedbackDoYouHaveFeedback                                           string `json:"feedback.do.you.have.feedback"`
					MinisteringYouthCompanion                                           string `json:"ministering.youth.companion"`
					MenuWelfareToolsCaring                                              string `json:"menu.welfare.tools.caring"`
					CommonDistrictYoungMenPresidency                                    string `json:"common.district.young.men.presidency"`
					CommonParentUnitNumber                                              string `json:"common.parent.unit.number"`
					MenuDonationDetail                                                  string `json:"menu.donation.detail"`
					CommonMission                                                       string `json:"common.mission"`
					LettersConfidentialDocument                                         string `json:"letters.confidential.document"`
					MinisteringDeleteDistrict                                           string `json:"ministering.delete.district"`
					LeaderMessagingAllSundaySchoolPresidencies                          string `json:"leader-messaging.all-sunday-school-presidencies"`
					CommonPrintOptions                                                  string `json:"common.print.options"`
					MinisteringMinistersRequired                                        string `json:"ministering.ministers.required"`
					MenuConfidentialInformation                                         string `json:"menu.confidential.information"`
					MenuBishopric                                                       string `json:"menu.bishopric"`
					MonthsSeptember                                                     string `json:"months.september"`
					MenuStakeFamilyHistory                                              string `json:"menu.stake.family.history"`
					LostMembersSendToAuUnit                                             string `json:"lost-members.send.to.au.unit"`
					MenuRecordConvertBaptism                                            string `json:"menu.record.convert.baptism"`
					Four04ReturnActionsInProcess                                        string `json:"404.return.actions.in.process"`
					CommonDistrict                                                      string `json:"common.district"`
					MenuWelfareAssistanceProvided                                       string `json:"menu.welfare.assistance.provided"`
					LettersLiftingOfSealingRestrictionApprovalInstructions              string `json:"letters.lifting.of.sealing.restriction.approval.instructions"`
					MenuRecipientTransactions                                           string `json:"menu.recipient.transactions"`
					LeaderMessagingAllAaronicAdultLeaders                               string `json:"leader-messaging.all-aaronic-adult-leaders"`
					HtvtFilterSubtitleAssignedHomeTeachers                              string `json:"htvt.filter.subtitle.assigned.home.teachers"`
					LettersValidationSelectPriesthoodOfficiator                         string `json:"letters.validation.select.priesthood.officiator"`
					CommonAssistantDistrictClerkMembership                              string `json:"common.assistant.district.clerk.membership"`
					LostMembersMoveToUnit                                               string `json:"lost-members.move.to.unit"`
					Five00PageTitle                                                     string `json:"500.page.title"`
					MinisteringCurrentAssignments                                       string `json:"ministering.current.assignments"`
					CommonFormatName                                                    string `json:"common.format.name"`
					CalendarDayLong2                                                    string `json:"calendar.day.long.2"`
					PefEndorsementForms                                                 string `json:"pef.endorsement.forms"`
					CalendarDayLong3                                                    string `json:"calendar.day.long.3"`
					MinisteringCompanionshipsInterviewedLabel                           string `json:"ministering.companionships.interviewed.label"`
					CommonMultipleCopies                                                string `json:"common.multiple.copies"`
					CalendarDayLong1                                                    string `json:"calendar.day.long.1"`
					CalendarDayLong6                                                    string `json:"calendar.day.long.6"`
					LostMembersMemberInUnit                                             string `json:"lost-members.member.in.unit"`
					CalendarDayLong7                                                    string `json:"calendar.day.long.7"`
					LettersSealingClearanceApprovalInstructions                         string `json:"letters.sealing.clearance.approval.instructions"`
					CalendarDayLong4                                                    string `json:"calendar.day.long.4"`
					CalendarDayLong5                                                    string `json:"calendar.day.long.5"`
					FeedbackEnhancement                                                 string `json:"feedback.enhancement"`
					LettersBaptismDate                                                  string `json:"letters.baptism.date"`
					CommonNameOrAddress                                                 string `json:"common.name.or.address"`
					PefEndorseInvalidRecommendMessage                                   string `json:"pef.endorse.invalid.recommend.message"`
					CommonAuxPresidency                                                 string `json:"common.aux.presidency"`
					CommonUnhide                                                        string `json:"common.unhide"`
					CommonGoal                                                          string `json:"common.goal"`
					MenuEnterExpenses                                                   string `json:"menu.enter.expenses"`
					CommonClearSelections                                               string `json:"common.clear.selections"`
					GlobalProxyTitle                                                    string `json:"global.proxy.title"`
					LettersConfidentialCommunications                                   string `json:"letters.confidential.communications"`
					OrdBaptismCertificate                                               string `json:"ord.baptism.certificate"`
					OrdDeaconOrdinationCertificate                                      string `json:"ord.deacon.ordination.certificate"`
					MenuRecordMelPriesthoodOrdination                                   string `json:"menu.record.mel.priesthood.ordination"`
					CommonUnassigned                                                    string `json:"common.unassigned"`
					RecordLegalName                                                     string `json:"record.legal.name"`
					LeaderMessagingAllYoungWomenPresidencies                            string `json:"leader-messaging.all-young-women-presidencies"`
					RecommendIssueNewRecommendTitle                                     string `json:"recommend.issue.new.recommend.title"`
					LettersWhoPerformedOrdination                                       string `json:"letters.who.performed.ordination"`
					CalendarMonthLong10                                                 string `json:"calendar.month.long.10"`
					CommonSubmitToMission                                               string `json:"common.submit.to.mission"`
					CalendarMonthLong12                                                 string `json:"calendar.month.long.12"`
					NewMember24Months                                                   string `json:"new-member.24.months"`
					CommonProcessing                                                    string `json:"common.processing"`
					CalendarMonthLong11                                                 string `json:"calendar.month.long.11"`
					LettersRestorationOfBlessingsDisapprovalInstructions                string `json:"letters.restoration.of.blessings.disapproval.instructions"`
					MenuWeEncourageSuggestions                                          string `json:"menu.we.encourage.suggestions"`
					MenuIncomeExpenseSummary                                            string `json:"menu.income.expense.summary"`
					FeedbackInvalidFiletype                                             string `json:"feedback.invalid.filetype"`
					CommonMembers                                                       string `json:"common.members"`
					CommonNo                                                            string `json:"common.no"`
					MinisteringInterviews                                               string `json:"ministering.interviews"`
					MenuContactUs                                                       string `json:"menu.contact.us"`
					MenuActionInterviewList                                             string `json:"menu.action.interview.list"`
					MonthsDecember                                                      string `json:"months.december"`
					MenuUnitStatistics                                                  string `json:"menu.unit.statistics"`
					MinisteringStartWithNoAssignments                                   string `json:"ministering.start.with.no.assignments"`
					CommonSubmittedDate                                                 string `json:"common.submitted.date"`
					Four04ReturnToOrganizationsCallings                                 string `json:"404.return.to.organizations.callings"`
					FeedbackNoThanks                                                    string `json:"feedback.no.thanks"`
					LeaderMessagingVirusAttachmentError                                 string `json:"leader-messaging.virus.attachment.error"`
					ChildProtectionCertification                                        string `json:"child-protection.certification"`
					MenuPatriarch                                                       string `json:"menu.patriarch"`
					MenuConductMembershipAudit                                          string `json:"menu.conduct.membership.audit"`
					MenuHomeVisitingTeachers                                            string `json:"menu.home.visiting.teachers"`
					LeaderMessagingAllMen                                               string `json:"leader-messaging.all-men"`
					MoveSelectNewHoh                                                    string `json:"move.select.new.hoh"`
					CalendarWeekShort                                                   string `json:"calendar.week.short"`
					MenuYouthRecommendReport                                            string `json:"menu.youth.recommend.report"`
					CommonLandscape                                                     string `json:"common.landscape"`
					CommonUnitInfo                                                      string `json:"common.unit.info"`
					CommonShowEmail                                                     string `json:"common.show.email"`
					ChildProtectionAllStatuses                                          string `json:"child-protection.all.statuses"`
					MenuDistrictYoungMen                                                string `json:"menu.district.young.men"`
					ChildProtectionExpired                                              string `json:"child-protection.expired"`
					MinisteringAssignmentProposals                                      string `json:"ministering.assignment.proposals"`
					LeaderMessagingAllOrganizationPresidencies                          string `json:"leader-messaging.all-organization-presidencies"`
					CommonMailingLabelInstructionsTitle                                 string `json:"common.mailing.label.instructions.title"`
					CommonPrintSingleCopy                                               string `json:"common.print.single.copy"`
					CommonMailingLabelUppercaseName                                     string `json:"common.mailing.label.uppercase.name"`
					MenuDeclarationSummary                                              string `json:"menu.declaration.summary"`
					LettersValidationSelectPriesthood                                   string `json:"letters.validation.select.priesthood"`
					MinisteringPastYear                                                 string `json:"ministering.past.year"`
					CallingsCalling                                                     string `json:"callings.calling"`
					LeaderMessagingAllReliefSocietyPresidencies                         string `json:"leader-messaging.all-relief-society-presidencies"`
					CustomReportsHomeTeachingCompanion                                  string `json:"custom-reports.home.teaching.companion"`
					MinisteringAllReliefSocieties                                       string `json:"ministering.all.relief.societies"`
					ChildProtectionTrainingStatus                                       string `json:"child-protection.training.status"`
					CommonMailingLabelInstructions                                      string `json:"common.mailing.label.instructions"`
					CommonPriesthoodApostle                                             string `json:"common.priesthood.apostle"`
					CommonCannotSubmitMelchizedekMessage                                string `json:"common.cannot.submit.melchizedek.message"`
					CalendarDayVeryShort4                                               string `json:"calendar.day.very.short.4"`
					CalendarDayVeryShort5                                               string `json:"calendar.day.very.short.5"`
					CalendarDayVeryShort6                                               string `json:"calendar.day.very.short.6"`
					MenuClassAndQuorumAttendanceOverview                                string `json:"menu.class.and.quorum.attendance.overview"`
					CalendarDayVeryShort7                                               string `json:"calendar.day.very.short.7"`
					FeedbackSelectCategory                                              string `json:"feedback.select.category"`
					CalendarDayVeryShort1                                               string `json:"calendar.day.very.short.1"`
					MinisteringMinisteringSisters                                       string `json:"ministering.ministering.sisters"`
					CalendarDayVeryShort2                                               string `json:"calendar.day.very.short.2"`
					CalendarDayVeryShort3                                               string `json:"calendar.day.very.short.3"`
					MenuDistrictSundaySchool                                            string `json:"menu.district.sunday.school"`
					MinisteringApplyAssignments                                         string `json:"ministering.apply.assignments"`
					CommonAddress                                                       string `json:"common.address"`
					MenuVpn                                                             string `json:"menu.vpn"`
					CommonDateInitiated                                                 string `json:"common.date.initiated"`
					MenuOutOfUnit                                                       string `json:"menu.out.of.unit"`
					MenuApplicationFirstPresidency                                      string `json:"menu.application.first.presidency"`
					HtvtAllHouseholds                                                   string `json:"htvt.all.households"`
					CommonSelectAnOrganization                                          string `json:"common.select.an.organization"`
					MenuOrganizations                                                   string `json:"menu.organizations"`
					MenuOtherTools                                                      string `json:"menu.other.tools"`
					MinisteringAddCompanionship                                         string `json:"ministering.add.companionship"`
					CommonMemberNotFoundInUnit                                          string `json:"common.member.not.found.in.unit"`
					MenuRecordDeath                                                     string `json:"menu.record.death"`
					MenuMergeParticipants                                               string `json:"menu.merge.participants"`
					MenuHighPriestsGroup                                                string `json:"menu.high.priests.group"`
					DashboardHandbook2                                                  string `json:"dashboard.handbook.2"`
					MenuEditMeetingStartTimes                                           string `json:"menu.edit.meeting.start.times"`
					CallingsSustained                                                   string `json:"callings.sustained"`
					LettersValidationSelectBaptism                                      string `json:"letters.validation.select.baptism"`
					DashboardHandbook1                                                  string `json:"dashboard.handbook.1"`
					Four04ReturnToHome                                                  string `json:"404.return.to.home"`
					MenuMinisteringBrothers                                             string `json:"menu.ministering.brothers"`
					CommonPercentComplete                                               string `json:"common.percent.complete"`
					MenuSiQr                                                            string `json:"menu.si.qr"`
					RecordSelectState                                                   string `json:"record.select.state"`
					MenuApproveExpenses                                                 string `json:"menu.approve.expenses"`
					FeedbackCommentsRequired                                            string `json:"feedback.comments.required"`
					MenuMemberListNew                                                   string `json:"menu.member.list.new"`
					ChildProtectionCertificationsInfo                                   string `json:"child-protection.certifications.info"`
					ProgressRecordMissionaryProgressRecord                              string `json:"progress-record.missionary.progress.record"`
					MenuTempleRecommendStatus                                           string `json:"menu.temple.recommend.status"`
					CommonMrnOrNameAndBirthdateRequired                                 string `json:"common.mrn.or.name.and.birthdate.required"`
					MenuHelp                                                            string `json:"menu.help"`
					CommonDetail                                                        string `json:"common.detail"`
					BetaClosedDetails                                                   string `json:"beta.closed.details"`
					LeaderMessagingDistrictLeaders                                      string `json:"leader-messaging.district-leaders"`
					CommonOouMemberNote                                                 string `json:"common.oou.member.note"`
					CommonGivenNames                                                    string `json:"common.given.names"`
					CommonSignatureBishopBranchPres                                     string `json:"common.signature.bishop.branch.pres"`
					LeaderMessagingClearAll                                             string `json:"leader-messaging.clear-all"`
					CommonCancel                                                        string `json:"common.cancel"`
					MenuRecordKeepingStatus                                             string `json:"menu.record.keeping.status"`
					CommonNonMemberNote                                                 string `json:"common.non.member.note"`
					MenuWithoutRecommend                                                string `json:"menu.without.recommend"`
					MinisteringAnnotationPresentMainLeader                              string `json:"ministering.annotation.present.main.leader"`
					MenuFinancialStatements                                             string `json:"menu.financial.statements"`
					CommonTeacherOrdination                                             string `json:"common.teacher.ordination"`
					MinisteringIndividualsNoCompanion                                   string `json:"ministering.individuals.no.companion"`
					LeaderMessagingSubject                                              string `json:"leader-messaging.subject"`
					CommonSignature                                                     string `json:"common.signature"`
					MenuPayeeTransactions                                               string `json:"menu.payee.transactions"`
					CommonSwitchCalling                                                 string `json:"common.switch.calling"`
					CommonSearchLabel                                                   string `json:"common.search.label"`
					CommonPriesthoodProspectiveElder                                    string `json:"common.priesthood.prospective_elder"`
					CommonPrivacyPolicy                                                 string `json:"common.privacy.policy"`
					MenuClerkResourcesShort                                             string `json:"menu.clerk.resources.short"`
					CommonMemberNotFoundPleaseSelectMember                              string `json:"common.member.not.found.please.select.member"`
					CommonBranchPresidencyCounselors                                    string `json:"common.branch.presidency.counselors"`
					MinisteringMinistersCannotHaveOppositeGenderUnlessMarried           string `json:"ministering.ministers.cannot.have.opposite.gender.unless.married"`
					MenuBranchPresidency                                                string `json:"menu.branch.presidency"`
					CommonBytes                                                         string `json:"common.bytes"`
					CommonStakeClerk                                                    string `json:"common.stake.clerk"`
					CommonNoLimit                                                       string `json:"common.no.limit"`
					MenuOrgsAndCallings                                                 string `json:"menu.orgs.and.callings"`
					BirthdayListAgeExplanation                                          string `json:"birthday-list.age.explanation"`
					MenuFourGenerations                                                 string `json:"menu.four.generations"`
					MinisteringAddDistrict                                              string `json:"ministering.add.district"`
					MenuYearEndStatements                                               string `json:"menu.year.end.statements"`
					MinisteringAllUnassigned                                            string `json:"ministering.all.unassigned"`
					CommonNameWithPlaceholders                                          string `json:"common.name.with.placeholders"`
					MenuPurchaseMaterials                                               string `json:"menu.purchase.materials"`
					MenuClerkTrainingLessons                                            string `json:"menu.clerk.training.lessons"`
					MenuManageDistricts                                                 string `json:"menu.manage.districts"`
					MenuDistrictLeadership                                              string `json:"menu.district.leadership"`
					LeaderMessagingRecipientCountPlural                                 string `json:"leader-messaging.recipient-count-plural"`
					MenuForms                                                           string `json:"menu.forms"`
					MenuWardLeadership                                                  string `json:"menu.ward.leadership"`
					MenuFeedbackLink                                                    string `json:"menu.feedback.link"`
					CommonMailingLabelFirstLast                                         string `json:"common.mailing.label.first.last"`
					MinisteringDistrictNumber                                           string `json:"ministering.district.number"`
					OrdPriestOrdinationCertificate                                      string `json:"ord.priest.ordination.certificate"`
					LettersInProcess                                                    string `json:"letters.in.process"`
					MinisteringPresidencyMember                                         string `json:"ministering.presidency.member"`
					CommonTimeagoMonth                                                  string `json:"common.timeago.month"`
					MinisteringViewHouseholds                                           string `json:"ministering.view.households"`
					CommonNoMembersFoundVerifyAndTryAgain                               string `json:"common.no.members.found.verify.and.try.again"`
					CommonCopyright                                                     string `json:"common.copyright"`
					CommonSelectDeselectAll                                             string `json:"common.select.deselect.all"`
					CommonShowGender                                                    string `json:"common.show.gender"`
					CommonMalesAndFemales                                               string `json:"common.males.and.females"`
					CommonMailingLabelHouseholdName                                     string `json:"common.mailing.label.household.name"`
					MenuManageCategories                                                string `json:"menu.manage.categories"`
					CommonRemove                                                        string `json:"common.remove"`
					MenuRequestAddRemoveOrdinanceRestriction                            string `json:"menu.request.add.remove.ordinance-restriction"`
					MonthsNovember                                                      string `json:"months.november"`
					LeaderMessagingPriesthoodExecutiveCommittee                         string `json:"leader-messaging.priesthood-executive-committee"`
					MenuLcrHome                                                         string `json:"menu.lcr.home"`
					ProgressRecordProgressRecord                                        string `json:"progress-record.progress.record"`
					CommonHighCouncilor                                                 string `json:"common.high.councilor"`
					MenuByOrganization                                                  string `json:"menu.by.organization"`
					CommonDropFilesText                                                 string `json:"common.drop.files.text"`
					LeaderMessagingDeliveryResultRejectNotice                           string `json:"leader-messaging.delivery-result-reject-notice"`
					MinisteringTotalCompanionshipsInterviewed                           string `json:"ministering.total.companionships.interviewed"`
					CommonRightsAndUse                                                  string `json:"common.rights.and.use"`
					MenuOrdinanceRecordForms                                            string `json:"menu.ordinance.record.forms"`
					ChildProtectionExpiring                                             string `json:"child-protection.expiring"`
					MenuTopicsForCoordinatingCouncils                                   string `json:"menu.topics.for.coordinating.councils"`
					CommonFormattedName                                                 string `json:"common.formatted.name"`
					MenuSingles                                                         string `json:"menu.singles"`
					CommonNameFormatterInstructions                                     string `json:"common.name.formatter.instructions"`
					MenuRecordChildRecordBaptism                                        string `json:"menu.record.child.record.baptism"`
					LeaderMessagingSecurityBlockError                                   string `json:"leader-messaging.security.block.error"`
					CommonSaveName                                                      string `json:"common.save.name"`
					CommonPriesthoodTeacher                                             string `json:"common.priesthood.teacher"`
					MinisteringReviewAndPublishAssignments                              string `json:"ministering.review.and.publish.assignments"`
					Four04UseNavigation                                                 string `json:"404.use.navigation"`
					MinisteringStartAddingDistrict                                      string `json:"ministering.start.adding.district"`
					MenuKeyIndicators                                                   string `json:"menu.key.indicators"`
					ClassAndQuorumAttendanceOverviewPaginationFractionPieceText         string `json:"class-and-quorum-attendance.overview.pagination.fraction.piece.text"`
					MenuNewReturningMember                                              string `json:"menu.new.returning.member"`
					CommonStakeYoungMenPresidency                                       string `json:"common.stake.young.men.presidency"`
					CalendarPrev                                                        string `json:"calendar.prev"`
					CommonBaptized                                                      string `json:"common.baptized"`
					CommonTimeagoHour                                                   string `json:"common.timeago.hour"`
					MenuCes                                                             string `json:"menu.ces"`
					LeaderMessagingSearchRecipientsByUnitInfoHelp                       string `json:"leader-messaging.search-recipients-by-unit-info-help"`
					MinisteringCompanionshipsInterviewed                                string `json:"ministering.companionships.interviewed"`
					PefEndorseSubmissionSuccess                                         string `json:"pef.endorse.submission.success"`
					MenuLdsToolsApp                                                     string `json:"menu.lds.tools.app"`
					MinisteringAssignmentProposalsInProgressInfo                        string `json:"ministering.assignment.proposals.in.progress.info"`
					CommonBirthdateRequired                                             string `json:"common.birthdate.required"`
					MenuLearnAboutMinistering                                           string `json:"menu.learn.about.ministering"`
					CommonMrnOrNamePlaceholder                                          string `json:"common.mrn.or.name.placeholder"`
					MenuParticipants                                                    string `json:"menu.participants"`
					CommonPriesthood1                                                   string `json:"common.priesthood.1"`
					MinisteringAllDistricts                                             string `json:"ministering.all.districts"`
					CommonPriesthood2                                                   string `json:"common.priesthood.2"`
					MinisteringDeleteAssignmentWarning                                  string `json:"ministering.delete.assignment.warning"`
					HtvtFilterSubtitleAllHomeTeachers                                   string `json:"htvt.filter.subtitle.all.home.teachers"`
					LostMembersLastKnownAddress                                         string `json:"lost-members.last.known.address"`
					CommonPriesthood3                                                   string `json:"common.priesthood.3"`
					CalendarAm                                                          string `json:"calendar.am"`
					CommonPriesthood4                                                   string `json:"common.priesthood.4"`
					CommonPriesthood5                                                   string `json:"common.priesthood.5"`
					ProgressRecordEligibleEndowment                                     string `json:"progress-record.eligible.endowment"`
					CommonPriesthood6                                                   string `json:"common.priesthood.6"`
					CommonPriesthood7                                                   string `json:"common.priesthood.7"`
					MenuPrintMailingLabels                                              string `json:"menu.print.mailing.labels"`
					CommonPriesthood8                                                   string `json:"common.priesthood.8"`
					CommonPriesthood9                                                   string `json:"common.priesthood.9"`
					MenuPaymentRequest                                                  string `json:"menu.payment.request"`
					MenuDistrictCouncil                                                 string `json:"menu.district.council"`
					CommonMissionPresidencyCounselorsProselyting                        string `json:"common.mission.presidency.counselors.proselyting"`
					CommonHideSlashShow                                                 string `json:"common.hide.slash.show"`
					ChildProtectionPastDue                                              string `json:"child-protection.past.due"`
					LeaderMessagingSelectAll                                            string `json:"leader-messaging.select-all"`
					CommonMissionarySister                                              string `json:"common.missionary.sister"`
					MenuFamilyHistory                                                   string `json:"menu.family.history"`
					ChildProtectionCertificationExpired                                 string `json:"child-protection.certification.expired"`
					CommonShowAddress                                                   string `json:"common.show.address"`
					LeaderMessagingMessageSentSuccess                                   string `json:"leader-messaging.message-sent-success"`
					LostMembersNotFoundContactResidence                                 string `json:"lost-members.not.found.contact.residence"`
					MinisteringMinisterMustHavePriesthood                               string `json:"ministering.minister.must.have.priesthood"`
					CommonResume                                                        string `json:"common.resume"`
					AccessAccessDeniedMissionPresident                                  string `json:"access.access.denied.mission.president"`
					LettersValidationInterviewDate                                      string `json:"letters.validation.interview.date"`
					LeaderMessagingEmailIconHelp                                        string `json:"leader-messaging.email-icon-help"`
					MenuSeminaryAndInstituteAttendance                                  string `json:"menu.seminary.and.institute.attendance"`
					LettersFirstPresidencyDecision                                      string `json:"letters.first.presidency.decision"`
					ChildProtectionExpiration                                           string `json:"child-protection.expiration"`
					HtvtFilterSubtitleUnassignedVisitingTeachers                        string `json:"htvt.filter.subtitle.unassigned.visiting.teachers"`
					CommonSearchPlaceholder                                             string `json:"common.search.placeholder"`
					MenuWardAndBranchLeadership                                         string `json:"menu.ward.and.branch.leadership"`
					MenuChurchServiceMissionarySystem                                   string `json:"menu.church.service.missionary.system"`
					LeaderMessagingParentsYoungMen                                      string `json:"leader-messaging.parents-young-men"`
					CommonPriesthoodSeventy                                             string `json:"common.priesthood.seventy"`
					LettersConfidentialActions                                          string `json:"letters.confidential.actions"`
					Four04PageTitle                                                     string `json:"404.page.title"`
					CalendarMonthShort9                                                 string `json:"calendar.month.short.9"`
					CalendarMonthShort8                                                 string `json:"calendar.month.short.8"`
					CalendarMonthShort7                                                 string `json:"calendar.month.short.7"`
					MenuStakeQuarterlyReport                                            string `json:"menu.stake.quarterly.report"`
					CalendarMonthShort6                                                 string `json:"calendar.month.short.6"`
					CalendarMonthShort5                                                 string `json:"calendar.month.short.5"`
					CalendarMonthShort4                                                 string `json:"calendar.month.short.4"`
					CalendarMonthShort3                                                 string `json:"calendar.month.short.3"`
					CalendarMonthShort2                                                 string `json:"calendar.month.short.2"`
					CalendarMonthShort1                                                 string `json:"calendar.month.short.1"`
					MenuRequestMinutes                                                  string `json:"menu.request.minutes"`
					LeaderMessagingAllBranchPresidencies                                string `json:"leader-messaging.all-branch-presidencies"`
					MenuMissionLeadership                                               string `json:"menu.mission.leadership"`
					MinisteringEditDistricts                                            string `json:"ministering.edit.districts"`
					MonthsMay                                                           string `json:"months.may"`
					MenuMinisteringElders                                               string `json:"menu.ministering.elders"`
					MenuDonationAdjustment                                              string `json:"menu.donation.adjustment"`
					CommonShowAge                                                       string `json:"common.show.age"`
					CommonShowBirthDate                                                 string `json:"common.show.birth.date"`
					CommonReturnToLcr                                                   string `json:"common.return.to.lcr"`
					MenuManageOouMembers                                                string `json:"menu.manage.oou.members"`
					CommonShowOnlyLabel                                                 string `json:"common.show.only.label"`
					LeaderMessagingClearRecipients                                      string `json:"leader-messaging.clear-recipients"`
					CommonChooseFilesText                                               string `json:"common.choose.files.text"`
					MenuConfidential                                                    string `json:"menu.confidential"`
					RecordRelationship                                                  string `json:"record.relationship"`
					LeaderMessagingAddAttachments                                       string `json:"leader-messaging.add.attachments"`
					MenuExpenseSummary                                                  string `json:"menu.expense.summary"`
					MenuAssignBudget                                                    string `json:"menu.assign.budget"`
					LeaderMessagingErrorIndividualHaveNoEmail                           string `json:"leader-messaging.error.individual.have.no.email"`
					CommonNonmembers                                                    string `json:"common.nonmembers"`
					MenuInterviews                                                      string `json:"menu.interviews"`
					LeaderMessagingAllCallings                                          string `json:"leader-messaging.all-callings"`
					CommonMissionaryElder                                               string `json:"common.missionary.elder"`
					ChildProtectionAddCertification                                     string `json:"child-protection.add.certification"`
					CommonPeriod                                                        string `json:"common.period"`
					CalendarMonthShort11                                                string `json:"calendar.month.short.11"`
					CalendarMonthShort12                                                string `json:"calendar.month.short.12"`
					MenuTempleEntrySystem                                               string `json:"menu.temple.entry.system"`
					CommonMissionPresidentProselyting                                   string `json:"common.mission.president.proselyting"`
					MenuOnlyBishopsHaveAccess                                           string `json:"menu.only.bishops.have.access"`
					MenuMergeDuplicate                                                  string `json:"menu.merge.duplicate"`
					ChildProtectionStarted                                              string `json:"child-protection.started"`
					LettersLiftingOfFormalMembershipRestrictionsDate                    string `json:"letters.lifting.of.formal.membership.restrictions.date"`
					CommonMissionaries                                                  string `json:"common.missionaries"`
					CalendarMonthShort10                                                string `json:"calendar.month.short.10"`
					LettersLiftingOfSealingRestrictionDecision                          string `json:"letters.lifting.of.sealing.restriction.decision"`
					CommonGoBack                                                        string `json:"common.go.back"`
					ChildProtectionCertificationName                                    string `json:"child-protection.certification.name"`
					MinisteringNoDuplicateAssignments                                   string `json:"ministering.no.duplicate.assignments"`
					CommonAssistantStakeClerk                                           string `json:"common.assistant.stake.clerk"`
					MinisteringNoCompanionshipsCreated                                  string `json:"ministering.no.companionships.created"`
					ChildProtectionCompleted                                            string `json:"child-protection.completed"`
					MenuLufas                                                           string `json:"menu.lufas"`
					CommonLeader                                                        string `json:"common.leader"`
					MinisteringPendingAssignments                                       string `json:"ministering.pending.assignments"`
					MenuRequestRecords                                                  string `json:"menu.request.records"`
					LettersReadmissionWithdrawnInstructions                             string `json:"letters.readmission.withdrawn.instructions"`
					MenuConfidentialMemberInformationReport                             string `json:"menu.confidential.member.information.report"`
					CommonClass                                                         string `json:"common.class"`
					MenuFindIndividual                                                  string `json:"menu.find.individual"`
					LeaderMessagingAllBishoprics                                        string `json:"leader-messaging.all-bishoprics"`
					CommonPriesthood4Plural                                             string `json:"common.priesthood.4.plural"`
					CommonDistrictPresidentTitle                                        string `json:"common.district_president.title"`
					CommonOptions                                                       string `json:"common.options"`
					LeaderMessagingSingleAdults                                         string `json:"leader-messaging.single-adults"`
					MenuDistrictReliefSociety                                           string `json:"menu.district.relief.society"`
					CommonGenericFootUsage                                              string `json:"common.generic.foot.usage"`
					MenuMeetinghouseTechnologyDocs                                      string `json:"menu.meetinghouse.technology.docs"`
					MinisteringSelectedCompanionships                                   string `json:"ministering.selected.companionships"`
					MenuOtherCallings                                                   string `json:"menu.other.callings"`
					CommonOrientation                                                   string `json:"common.orientation"`
					LettersBaptismOfficiator                                            string `json:"letters.baptism.officiator"`
					LettersDidNotConductInterview                                       string `json:"letters.did.not.conduct.interview"`
					MenuWelfareTools                                                    string `json:"menu.welfare.tools"`
					MinisteringStartOver                                                string `json:"ministering.start.over"`
					LeaderMessagingAllYoungWomenClassPresidencies                       string `json:"leader-messaging.all-young-women-class-presidencies"`
					MenuExpenses                                                        string `json:"menu.expenses"`
					BirthdayListFirstMonthToShow                                        string `json:"birthday-list.first.month.to.show"`
					LeaderMessagingAllWardYsaLeaders                                    string `json:"leader-messaging.all-ward-ysa-leaders"`
					MinisteringUnassignedSisters                                        string `json:"ministering.unassigned.sisters"`
					MinisteringPublishAssignments                                       string `json:"ministering.publish.assignments"`
					CommonPendingRecordTitle                                            string `json:"common.pending.record.title"`
					CommonUploadExceedsMb                                               string `json:"common.upload.exceeds.mb"`
					CommonPriesthoodDeacon                                              string `json:"common.priesthood.deacon"`
					MenuRecommendTempleWorkers                                          string `json:"menu.recommend.temple.workers"`
					MonthsMarch                                                         string `json:"months.march"`
					ChildProtectionSearchTable                                          string `json:"child-protection.search.table"`
					RecommendActive                                                     string `json:"recommend.active"`
					LettersRestorationOfBlessingsApprovalInstructions                   string `json:"letters.restoration.of.blessings.approval.instructions"`
					CommonBack                                                          string `json:"common.back"`
					MonthsApril                                                         string `json:"months.april"`
					MenuByuHawaii                                                       string `json:"menu.byu.hawaii"`
					MenuPriesthoodAuxiliaries                                           string `json:"menu.priesthood.auxiliaries"`
					ProgressRecordNotYetGivenCalling                                    string `json:"progress-record.not.yet.given.calling"`
					MenuMsr                                                             string `json:"menu.msr"`
					LeaderMessagingAttachments                                          string `json:"leader-messaging.attachments"`
					LeaderMessagingErrorEnterMessage                                    string `json:"leader-messaging.error-enter-message"`
					LeaderMessagingAllWomen                                             string `json:"leader-messaging.all-women"`
					MenuBranchLeadership                                                string `json:"menu.branch.leadership"`
					CommonFamilyName                                                    string `json:"common.family.name"`
					PefEndorsementConfirmation                                          string `json:"pef.endorsement.confirmation"`
					MinisteringAssignmentAttemptAnnotationUnitLeaderBody                string `json:"ministering.assignment.attempt.annotation.unit.leader.body"`
					CommonBranchExecutiveSecretary                                      string `json:"common.branch.executive.secretary"`
					CommonNonMember                                                     string `json:"common.non.member"`
					CommonBirthDate                                                     string `json:"common.birth.date"`
					LeaderMessagingAllBranchMissionLeaders                              string `json:"leader-messaging.all-branch-mission-leaders"`
					LettersValidationSelectBaptismOfficiator                            string `json:"letters.validation.select.baptism.officiator"`
					CommonRecordNumberOrBirthDate                                       string `json:"common.record.number.or.birth.date"`
					OrdWhoPerformedOrdination                                           string `json:"ord.who.performed.ordination"`
					MenuMemberListIndividuals                                           string `json:"menu.member.list.individuals"`
					LeaderMessagingTeaserDescription                                    string `json:"leader-messaging.teaser.description"`
					MinisteringNoAssignment                                             string `json:"ministering.no.assignment"`
					MenuRecordVisits                                                    string `json:"menu.record.visits"`
					CommonWardExecutiveSecretary                                        string `json:"common.ward.executive.secretary"`
					LeaderMessagingDistrictPec                                          string `json:"leader-messaging.district-pec"`
					LeaderMessagingAllClerks                                            string `json:"leader-messaging.all-clerks"`
					CommonCellPhone                                                     string `json:"common.cell.phone"`
					LeaderMessagingRecipientCountFiltered                               string `json:"leader-messaging.recipient-count-filtered"`
					LeaderMessagingWardLeaders                                          string `json:"leader-messaging.ward-leaders"`
					LettersCancellationOfSealingDisapprovalInstructions                 string `json:"letters.cancellation.of.sealing.disapproval.instructions"`
					MinisteringShowIndividualsLabel                                     string `json:"ministering.show.individuals.label"`
					FeedbackThanksDetailed                                              string `json:"feedback.thanks.detailed"`
					MinisteringStartWithCurrent                                         string `json:"ministering.start.with.current"`
					HtvtVisitingTeachers                                                string `json:"htvt.visiting.teachers"`
					MenuManageAssignments                                               string `json:"menu.manage.assignments"`
					MenuAverageSacramentMeetingAttendance                               string `json:"menu.average.sacrament.meeting.attendance"`
					CommonTimeagoMinute                                                 string `json:"common.timeago.minute"`
					MenuDeleteMemberOfRecord                                            string `json:"menu.delete.member.of.record"`
					PefPefEndorsement                                                   string `json:"pef.pef.endorsement"`
					MenuApplications                                                    string `json:"menu.applications"`
					HtvtAllOrganizations                                                string `json:"htvt.all.organizations"`
					LostMembersEmailAddress                                             string `json:"lost-members.email.address"`
					MinisteringShowIndividualsInfoEq                                    string `json:"ministering.show.individuals.info.eq"`
					MinisteringCompanionshipsNotInterviewed                             string `json:"ministering.companionships.not.interviewed"`
					CommonTableNoRecords                                                string `json:"common.table.no.records"`
					CommonCertificateLabel                                              string `json:"common.certificate.label"`
					CommonPassword                                                      string `json:"common.password"`
					LettersDoctype108                                                   string `json:"letters.doctype.108"`
					FeedbackScreenshot                                                  string `json:"feedback.screenshot"`
					LettersDoctype102                                                   string `json:"letters.doctype.102"`
					MenuManageCallings                                                  string `json:"menu.manage.callings"`
					LettersFirstPresidencyType20                                        string `json:"letters.first.presidency.type.20"`
					MenuStakeReliefSociety                                              string `json:"menu.stake.relief.society"`
					LettersFirstPresidencyType22                                        string `json:"letters.first.presidency.type.22"`
					LettersFirstPresidencyType21                                        string `json:"letters.first.presidency.type.21"`
					LettersFirstPresidencyType26                                        string `json:"letters.first.presidency.type.26"`
					CommonPortrait                                                      string `json:"common.portrait"`
					LettersValidationSelectOrdination                                   string `json:"letters.validation.select.ordination"`
					ChildProtectionCertificationNumber                                  string `json:"child-protection.certification.number"`
					RecordBirthCountry                                                  string `json:"record.birth.country"`
					LettersFirstPresidencyType27                                        string `json:"letters.first.presidency.type.27"`
					MenuNewBishopRecommendation                                         string `json:"menu.new.bishop.recommendation"`
					CommonBranch                                                        string `json:"common.branch"`
					LettersFirstPresidencyType29                                        string `json:"letters.first.presidency.type.29"`
					MenuStakeConferences                                                string `json:"menu.stake.conferences"`
					CommonStakeSundaySchoolPresidency                                   string `json:"common.stake.sunday.school.presidency"`
					CommonStakePresident                                                string `json:"common.stake.president"`
					MenuYouthWebsite                                                    string `json:"menu.youth.website"`
					MenuTithingSettlement                                               string `json:"menu.tithing.settlement"`
					LettersSuccess                                                      string `json:"letters.success"`
					MonthsFebruary                                                      string `json:"months.february"`
					LettersReinstatementInterviewNotRestore                             string `json:"letters.reinstatement.interview.not.restore"`
					LeaderMessagingStakePriesthoodLeadershipMeeting                     string `json:"leader-messaging.stake-priesthood-leadership-meeting"`
					MenuYoungMen                                                        string `json:"menu.young.men"`
					MenuSwitchCalling                                                   string `json:"menu.switch.calling"`
					CommonHide                                                          string `json:"common.hide"`
					MenuMeetinghouseTechnologyPolicies                                  string `json:"menu.meetinghouse.technology.policies"`
					LettersReadmissionDisapprovalInstructions                           string `json:"letters.readmission.disapproval.instructions"`
					CalendarNext                                                        string `json:"calendar.next"`
					CommonTimeagoMonths                                                 string `json:"common.timeago.months"`
					MinisteringPrintInterviews                                          string `json:"ministering.print.interviews"`
					ProgressRecordEligibleMelchizedek                                   string `json:"progress-record.eligible.melchizedek"`
					CommonFilterBy                                                      string `json:"common.filter.by"`
					MenuAuthorizeExpenses                                               string `json:"menu.authorize.expenses"`
					LettersFirstPresidencyType19                                        string `json:"letters.first.presidency.type.19"`
					LettersFirstPresidencyType18                                        string `json:"letters.first.presidency.type.18"`
					AccessAccessDeniedNonLcrUser                                        string `json:"access.access.denied.non.lcr.user"`
					CommonPresidentX                                                    string `json:"common.president.x"`
					MenuEcclesiasticalEndorsement                                       string `json:"menu.ecclesiastical.endorsement"`
					CommonStakePresidencyCounselors                                     string `json:"common.stake.presidency.counselors"`
					MinisteringAnnotationPresentOthers                                  string `json:"ministering.annotation.present.others"`
					LettersDoctype1                                                     string `json:"letters.doctype.1"`
					Months7                                                             string `json:"months.7"`
					Months8                                                             string `json:"months.8"`
					LeaderMessagingSearchRecipientsByCallingInfoHelp                    string `json:"leader-messaging.search-recipients-by-calling-info-help"`
					MenuConfidentialActionsProcess                                      string `json:"menu.confidential.actions.process"`
					ProgressRecordNotYetAaronicPriesthood                               string `json:"progress-record.not.yet.aaronic.priesthood"`
					Months9                                                             string `json:"months.9"`
					MenuRecords                                                         string `json:"menu.records"`
					LettersDoctype4                                                     string `json:"letters.doctype.4"`
					Months3                                                             string `json:"months.3"`
					LettersDoctype3                                                     string `json:"letters.doctype.3"`
					Months4                                                             string `json:"months.4"`
					CommonMaleLongLabel                                                 string `json:"common.male.long.label"`
					LettersDoctype2                                                     string `json:"letters.doctype.2"`
					Months5                                                             string `json:"months.5"`
					MenuFormsCertificates                                               string `json:"menu.forms.certificates"`
					Months6                                                             string `json:"months.6"`
					LettersDoctype8                                                     string `json:"letters.doctype.8"`
					LettersDoctype7                                                     string `json:"letters.doctype.7"`
					Months1                                                             string `json:"months.1"`
					LettersDoctype6                                                     string `json:"letters.doctype.6"`
					CommonWard                                                          string `json:"common.ward"`
					MenuOfficersSustained                                               string `json:"menu.officers.sustained"`
					LettersDoctype5                                                     string `json:"letters.doctype.5"`
					Months2                                                             string `json:"months.2"`
					CommonEligible                                                      string `json:"common.eligible"`
					NewMember12Months                                                   string `json:"new-member.12.months"`
					MinisteringIndividualsNotInterviewed                                string `json:"ministering.individuals.not.interviewed"`
					MenuMembersWithCallings                                             string `json:"menu.members.with.callings"`
					MenuAttendanceRolls                                                 string `json:"menu.attendance.rolls"`
					MinisteringAssignmentEldersInfo                                     string `json:"ministering.assignment.elders.info"`
					CommonTimeagoMinutes                                                string `json:"common.timeago.minutes"`
					LeaderMessagingErrorEnterSubject                                    string `json:"leader-messaging.error-enter-subject"`
					CommonFax                                                           string `json:"common.fax"`
					MinisteringPastDay                                                  string `json:"ministering.past.day"`
					LettersValidationSelectOutcome                                      string `json:"letters.validation.select.outcome"`
					LostMembersInfoStep4                                                string `json:"lost-members.info.step4"`
					CommonAssigned                                                      string `json:"common.assigned"`
					ClassAndQuorumAttendanceDetailsBackButtonTitle                      string `json:"class-and-quorum-attendance.details.back.button.title"`
					LostMembersInfoStep2                                                string `json:"lost-members.info.step2"`
					LostMembersInfoStep3                                                string `json:"lost-members.info.step3"`
					MenuUnitMessagesTitle                                               string `json:"menu.unit.messages.title"`
					CommonStakeSecondCounselor                                          string `json:"common.stake.second.counselor"`
					LostMembersInfoStep1                                                string `json:"lost-members.info.step1"`
					MenuPendingRecordTitle                                              string `json:"menu.pending.record.title"`
					Four04ReturnToMembership                                            string `json:"404.return.to.membership"`
					DashboardBetaAvailable                                              string `json:"dashboard.beta.available"`
					MenuByu                                                             string `json:"menu.byu"`
					FeedbackCategory                                                    string `json:"feedback.category"`
					CommonGenderLabel                                                   string `json:"common.gender.label"`
					MinisteringAllEldersQuorums                                         string `json:"ministering.all.elders.quorums"`
					MenuNotEndowed                                                      string `json:"menu.not.endowed"`
					ChildProtectionIncludeYouth                                         string `json:"child-protection.include.youth"`
					ChildProtectionAreYouSureDelete                                     string `json:"child-protection.are.you.sure.delete"`
					LostMembersViewMemberInformation                                    string `json:"lost-members.view.member.information"`
					RecordIndividualPhone                                               string `json:"record.individual.phone"`
					LettersReadmissionDecision                                          string `json:"letters.readmission.decision"`
					CommonStakeFirstCounselor                                           string `json:"common.stake.first.counselor"`
					ChildProtectionExpirationDate                                       string `json:"child-protection.expiration.date"`
					MenuManagePhotos                                                    string `json:"menu.manage.photos"`
					CommonAssistantDistrictClerk                                        string `json:"common.assistant.district.clerk"`
					CommonMtcExecutiveSecretary                                         string `json:"common.mtc.executive.secretary"`
					CommonSundaySchoolPresidency                                        string `json:"common.sunday.school.presidency"`
					CommonMailingLabelLastFirst                                         string `json:"common.mailing.label.last.first"`
					CommonNotAccountable                                                string `json:"common.not.accountable"`
					GlobalAccessDenied                                                  string `json:"global.access.denied"`
					FeedbackDevTeamFeedback                                             string `json:"feedback.dev.team.feedback"`
					OrdHighPriestOrdinationCertificate                                  string `json:"ord.high.priest.ordination.certificate"`
					MenuFindingLostMembers                                              string `json:"menu.finding.lost.members"`
					CommonApprove                                                       string `json:"common.approve"`
					CommonDeathDate                                                     string `json:"common.death.date"`
					MenuHome                                                            string `json:"menu.home"`
					LeaderMessagingAllBranchCouncils                                    string `json:"leader-messaging.all-branch-councils"`
					MinisteringOouCannotBeAssigned                                      string `json:"ministering.oou.cannot.be.assigned"`
					CommonMissionPresidentTitle                                         string `json:"common.mission_president.title"`
					CommonCanceling                                                     string `json:"common.canceling"`
					CommonValidationMrnNotValid                                         string `json:"common.validation.mrn.not.valid"`
					FeedbackImportance                                                  string `json:"feedback.importance"`
					CommonTimeagoSeconds                                                string `json:"common.timeago.seconds"`
					LettersSealingClearanceWithdrawnInstructions                        string `json:"letters.sealing.clearance.withdrawn.instructions"`
					LostMembersNotFoundInstructions                                     string `json:"lost-members.not.found.instructions"`
					LeaderMessagingSendAssignments                                      string `json:"leader-messaging.send-assignments"`
					LeaderMessagingSearchForRecipients                                  string `json:"leader-messaging.search-for-recipients"`
					RecordMale                                                          string `json:"record.male"`
					CommonView                                                          string `json:"common.view"`
					LettersConfirmationDate                                             string `json:"letters.confirmation.date"`
					LeaderMessagingHighCouncilMeeting                                   string `json:"leader-messaging.high-council-meeting"`
					CommonMoveDate                                                      string `json:"common.move.date"`
					RecommendLostOrStolen                                               string `json:"recommend.lost.or.stolen"`
					StatsIndividuals                                                    string `json:"stats.individuals"`
					LeaderMessagingDeliveryResultMessageSent                            string `json:"leader-messaging.delivery-result-message-sent"`
					CommonBaptismConfirmation                                           string `json:"common.baptism.confirmation"`
					CommonMoreDotDotDot                                                 string `json:"common.more.dot.dot.dot"`
					ChildProtectionChildYouthProtection                                 string `json:"child-protection.child.youth.protection"`
					MinisteringNotGenerallyAssigned                                     string `json:"ministering.not.generally.assigned"`
					LeaderMessagingRecipients                                           string `json:"leader-messaging.recipients"`
					MenuStakeStatistics                                                 string `json:"menu.stake.statistics"`
					CommonNameLabel                                                     string `json:"common.name.label"`
					MenuGeneralHelp                                                     string `json:"menu.general.help"`
					MenuCreateRecord                                                    string `json:"menu.create.record"`
					MemberLookupPhoneLabel                                              string `json:"member-lookup.phone.label"`
					CommonSearchTablePlaceholder                                        string `json:"common.search.table.placeholder"`
					LettersLiftingOfFormalMembershipRestrictionsDecision                string `json:"letters.lifting.of.formal.membership.restrictions.decision"`
					ChildProtectionNotStarted                                           string `json:"child-protection.not.started"`
					LettersValidationDateBeforeDecisionDate                             string `json:"letters.validation.date.before.decision.date"`
					MinisteringUnassignedMinisteringHouseholds                          string `json:"ministering.unassigned.ministering.households"`
					LeaderMessagingAllMembers                                           string `json:"leader-messaging.all-members"`
					MenuClerkResourcesPageTitle                                         string `json:"menu.clerk.resources.page.title"`
					RecordSelectCountry                                                 string `json:"record.select.country"`
					CommonBranches                                                      string `json:"common.branches"`
					MenuLessons                                                         string `json:"menu.lessons"`
					Five00UserBrowserBackButton                                         string `json:"500.user.browser.back.button"`
					MenuEditMemberClassAssignments                                      string `json:"menu.edit.member.class.assignments"`
					MinisteringStartOverInfo                                            string `json:"ministering.start.over.info"`
					CommonSubmit                                                        string `json:"common.submit"`
					MenuParticipantDetails                                              string `json:"menu.participant.details"`
					MenuMembersMovedIn                                                  string `json:"menu.members.moved.in"`
					CommonToday                                                         string `json:"common.today"`
					LettersRestorationOfBlessingsCompleted                              string `json:"letters.restoration.of.blessings.completed"`
					LeaderMessagingErrorSelectRecipients                                string `json:"leader-messaging.error-select-recipients"`
					MenuHasteningTheWork                                                string `json:"menu.hastening.the.work"`
					MenuOrdinances                                                      string `json:"menu.ordinances"`
					CommonStakePresidentTitle                                           string `json:"common.stake_president.title"`
					CommonSelectMonth                                                   string `json:"common.select.month"`
					CommonSubmitting                                                    string `json:"common.submitting"`
					CommonHighPriestsGroupLeadership                                    string `json:"common.high.priests.group.leadership"`
					MoveAddressIncomplete                                               string `json:"move.address.incomplete"`
					MenuProgressRecord                                                  string `json:"menu.progress.record"`
					MinisteringInterviewPastYearInfo                                    string `json:"ministering.interview.past.year.info"`
					CommonTimeagoDay                                                    string `json:"common.timeago.day"`
					OrdMemberOfOtherStake                                               string `json:"ord.member.of.other.stake"`
					CalendarPm                                                          string `json:"calendar.pm"`
					MinisteringAssignmentProposalsBrothers                              string `json:"ministering.assignment.proposals.brothers"`
					RecordFather                                                        string `json:"record.father"`
					LeaderMessagingInvalidEmailAddressPopup                             string `json:"leader-messaging.invalid-email-address-popup"`
					LettersWhoPerformedConfirmation                                     string `json:"letters.who.performed.confirmation"`
					MenuDistrictFamilyHistory                                           string `json:"menu.district.family.history"`
					ChildProtectionCertificationNumberOptional                          string `json:"child-protection.certification.number.optional"`
					LettersCancellationOfSealingWithdrawnInstructions                   string `json:"letters.cancellation.of.sealing.withdrawn.instructions"`
					CommonResubmit                                                      string `json:"common.resubmit"`
					MenuMenu                                                            string `json:"menu.menu"`
					CommonAssistantWardClerkMembership                                  string `json:"common.assistant.ward.clerk.membership"`
					CommonMelchizedek                                                   string `json:"common.melchizedek"`
					CommonTimeagoYear                                                   string `json:"common.timeago.year"`
					CommonClose                                                         string `json:"common.close"`
					PefEndorseSubmissionFailure                                         string `json:"pef.endorse.submission.failure"`
					ChildProtectionSustained                                            string `json:"child-protection.sustained"`
					MenuFamilyHistoryActivityReport                                     string `json:"menu.family.history.activity.report"`
					CommonSingleCopy                                                    string `json:"common.single.copy"`
					LettersDoctype23                                                    string `json:"letters.doctype.23"`
					LettersDoctype24                                                    string `json:"letters.doctype.24"`
					BetaExitBeta                                                        string `json:"beta.exit.beta"`
					MenuAdjustExpenses                                                  string `json:"menu.adjust.expenses"`
					MenuBoundaryLeadershipChange                                        string `json:"menu.boundary.leadership.change"`
					CommonStewardshipInfo                                               string `json:"common.stewardship.info"`
					MinisteringPresidencyMemberTooltipEq                                string `json:"ministering.presidency.member.tooltip.eq"`
					CommonStatusLabel                                                   string `json:"common.status.label"`
					MenuOtherReports                                                    string `json:"menu.other.reports"`
					CommonPrintForm                                                     string `json:"common.print.form"`
					CommonThisWardOrBranch                                              string `json:"common.this.ward.or.branch"`
					CommonDistrictReliefSocietyPresidency                               string `json:"common.district.relief.society.presidency"`
					MenuBetaOverview                                                    string `json:"menu.beta.overview"`
					MenuSeminaryAndInstituteEnrollment                                  string `json:"menu.seminary.and.institute.enrollment"`
					LostMembersNotFoundContactMember                                    string `json:"lost-members.not.found.contact.member"`
					LettersRestorationOfBlessingsDecision                               string `json:"letters.restoration.of.blessings.decision"`
					MenuRecordMemberOfRecordBaptism                                     string `json:"menu.record.member.of.record.baptism"`
					MenuDistrictYoungWomen                                              string `json:"menu.district.young.women"`
					MemberLookupEmailLabel                                              string `json:"member-lookup.email.label"`
					MenuDistrictAndBranchLeadership                                     string `json:"menu.district.and.branch.leadership"`
					LettersValidationOrdinationOfficiatorPriesthood                     string `json:"letters.validation.ordination.officiator.priesthood"`
					CommonYes                                                           string `json:"common.yes"`
					MinisteringUnassignedMinisteringSisters                             string `json:"ministering.unassigned.ministering.sisters"`
					MinisteringAssignedSisters                                          string `json:"ministering.assigned.sisters"`
					LettersDoctype12                                                    string `json:"letters.doctype.12"`
					CommonConfirmDelete                                                 string `json:"common.confirm.delete"`
					FeedbackClerkResourcesCommunication                                 string `json:"feedback.clerk.resources.communication"`
					MenuLdsBusinessCollege                                              string `json:"menu.lds.business.college"`
					RecordStreet1                                                       string `json:"record.street1"`
					LeaderMessagingHighPriests                                          string `json:"leader-messaging.high-priests"`
					RecordStreet2                                                       string `json:"record.street2"`
					ProgressRecordErrorFriendsMutation                                  string `json:"progress-record.error.friends.mutation"`
					CommonSelectMemberFromUnit                                          string `json:"common.select.member.from.unit"`
					MenuNewAndReturningMember                                           string `json:"menu.new.and.returning.member"`
					CommonAaronic                                                       string `json:"common.aaronic"`
					CommonCharactersLeft                                                string `json:"common.characters.left"`
					CommonSortBy                                                        string `json:"common.sort.by"`
					CommonParentName                                                    string `json:"common.parent.name"`
					CommonWorkPhone                                                     string `json:"common.work.phone"`
					LeaderMessagingStakeCouncil                                         string `json:"leader-messaging.stake-council"`
					MinisteringAllAssignments                                           string `json:"ministering.all.assignments"`
					MenuMemberUnitStats                                                 string `json:"menu.member.unit.stats"`
					ClassAndQuorumAttendanceOverviewTitle                               string `json:"class-and-quorum-attendance.overview.title"`
					MenuByuIdaho                                                        string `json:"menu.byu.idaho"`
					CommonSaved                                                         string `json:"common.saved"`
					CommonDistrictAuxPresidency                                         string `json:"common.district.aux.presidency"`
					CommonDistrictYoungWomenPresidency                                  string `json:"common.district.young.women.presidency"`
					MenuMinisteringResources                                            string `json:"menu.ministering.resources"`
					MenuOfficersSustainedForm                                           string `json:"menu.officers.sustained.form"`
					CommonContact                                                       string `json:"common.contact"`
					CommonGenderColon                                                   string `json:"common.gender.colon"`
					MenuHomeAndVisitingTeaching                                         string `json:"menu.home.and.visiting.teaching"`
					CommonMember                                                        string `json:"common.member"`
					LettersLiftingOfSealingWithdrawnDisapprovalInstructions             string `json:"letters.lifting.of.sealing.withdrawn.disapproval.instructions"`
					LeaderMessagingStakeLeaders                                         string `json:"leader-messaging.stake-leaders"`
					MemberLookupCurrentUnit                                             string `json:"member-lookup.current.unit"`
					MenuCallings                                                        string `json:"menu.callings"`
					MinisteringSplitFilterWarning                                       string `json:"ministering.split.filter.warning"`
					FeedbackFeedback                                                    string `json:"feedback.feedback"`
					MenuMinistering                                                     string `json:"menu.ministering"`
					LeaderMessagingMessage                                              string `json:"leader-messaging.message"`
					LeaderMessagingAllHighPriestsGroupLeaderships                       string `json:"leader-messaging.all-high-priests-group-leaderships"`
					MenuBoundaryProposals                                               string `json:"menu.boundary.proposals"`
					MenuViewMemberProfiles                                              string `json:"menu.view.member.profiles"`
					MenuBetaEmail                                                       string `json:"menu.beta.email"`
					MinisteringPresidencyMemberTooltipRs                                string `json:"ministering.presidency.member.tooltip.rs"`
					CommonDone                                                          string `json:"common.done"`
					CommonFatherNotFound                                                string `json:"common.father.not.found"`
					MenuRecordChildBlessing                                             string `json:"menu.record.child.blessing"`
					CommonMoreDetailsDotDotDot                                          string `json:"common.more.details.dot.dot.dot"`
					CommonNameFormatter                                                 string `json:"common.name.formatter"`
					CommonDistrictSundaySchoolPresidency                                string `json:"common.district.sunday.school.presidency"`
					CommonHighPriestOrdination                                          string `json:"common.high.priest.ordination"`
					MinisteringEqAssignmentMustBeHoh                                    string `json:"ministering.eq.assignment.must.be.hoh"`
					CommonFemaleLongLabel                                               string `json:"common.female.long.label"`
					LettersPasswordProtected                                            string `json:"letters.password.protected"`
					CommonHideDotDotDot                                                 string `json:"common.hide.dot.dot.dot"`
					CommonTimeagoDays                                                   string `json:"common.timeago.days"`
					CommonDistrictExecutiveSecretary                                    string `json:"common.district.executive.secretary"`
					ProgressRecordNotYetReceivedMinisteringAssignment                   string `json:"progress-record.not.yet.received.ministering.assignment"`
					LeaderMessagingDeliveryResultSubject                                string `json:"leader-messaging.delivery-result-subject"`
					LeaderMessagingSending                                              string `json:"leader-messaging.sending"`
					MenuYoungSingleAdults                                               string `json:"menu.young.single.adults"`
					CommonStakeAuxPresidency                                            string `json:"common.stake.aux.presidency"`
					CommonInitiatedBy                                                   string `json:"common.initiated.by"`
					CommonConfirmed                                                     string `json:"common.confirmed"`
					MinisteringCompanionships                                           string `json:"ministering.companionships"`
					MenuMemberListHouseholds                                            string `json:"menu.member.list.households"`
					CommonDeaconOrdination                                              string `json:"common.deacon.ordination"`
					CommonDoYouWantToContinue                                           string `json:"common.do.you.want.to.continue"`
					CommonContactUs                                                     string `json:"common.contact.us"`
					MinisteringCurrentlyNoProposedAssignments                           string `json:"ministering.currently.no.proposed.assignments"`
					LettersInterviewDate                                                string `json:"letters.interview.date"`
					FeedbackUsabilityIssue                                              string `json:"feedback.usability.issue"`
					MenuMembership                                                      string `json:"menu.membership"`
					CalendarToday                                                       string `json:"calendar.today"`
					MinisteringAssignedCurrentQuarterWithPendingInfo                    string `json:"ministering.assigned.current.quarter.with.pending.info"`
					CommonNotes                                                         string `json:"common.notes"`
					MenuCdol                                                            string `json:"menu.cdol"`
					MinisteringDeleteDistrictWarning                                    string `json:"ministering.delete.district.warning"`
					CommonSignatureBishopricOrBranchPresidency                          string `json:"common.signature.bishopric.or.branch.presidency"`
					CommonDifferentWardOrBranch                                         string `json:"common.different.ward.or.branch"`
					CommonPriesthoodOfficeLabel                                         string `json:"common.priesthood.office.label"`
					LettersDoctype53                                                    string `json:"letters.doctype.53"`
					LettersReadLetterCommunicatedMember                                 string `json:"letters.read.letter.communicated.member"`
					LettersWhoPerformedBaptism                                          string `json:"letters.who.performed.baptism"`
					CommonBirthdateLabel                                                string `json:"common.birthdate.label"`
					HtvtFilterSubtitleAssignedAll                                       string `json:"htvt.filter.subtitle.assigned.all"`
					LettersDoctype56                                                    string `json:"letters.doctype.56"`
					CommonDismiss                                                       string `json:"common.dismiss"`
					CommonWardsBranches                                                 string `json:"common.wards.branches"`
					CommonBishop                                                        string `json:"common.bishop"`
					MonthsOctober                                                       string `json:"months.october"`
					SelfRelianceMemberSelfReliance                                      string `json:"self-reliance.member.self.reliance"`
					CommonShowingXResults                                               string `json:"common.showing.x.results"`
					ClassAndQuorumAttendanceOverviewFilterByQuorumClassOptionAllClasses string `json:"class-and-quorum-attendance.overview.filter.by.quorum.class.option.all.classes"`
					LettersReadmissionApprovalInstructions                              string `json:"letters.readmission.approval.instructions"`
					SelfRelianceStakeSelfReliance                                       string `json:"self-reliance.stake.self.reliance"`
					LettersValidationResponseAlreadyPosted                              string `json:"letters.validation.response.already.posted"`
					MinisteringAlreadyHasMinisters                                      string `json:"ministering.already.has.ministers"`
					MenuLeaderResources                                                 string `json:"menu.leader.resources"`
					CommonMailingLabelIndividualName                                    string `json:"common.mailing.label.individual.name"`
					MenuLdsMail                                                         string `json:"menu.lds.mail"`
					LeaderMessagingAllYoungWomenLeaders                                 string `json:"leader-messaging.all-young-women-leaders"`
					CommonDay                                                           string `json:"common.day"`
					MinisteringAssignedToEachOther                                      string `json:"ministering.assigned.to.each.other"`
					CommonStakeYoungWomenPresidency                                     string `json:"common.stake.young.women.presidency"`
					HtvtFilterSubtitleAllVisitingTeachers                               string `json:"htvt.filter.subtitle.all.visiting.teachers"`
					CommonIUnderstand                                                   string `json:"common.i.understand"`
					CommonBishopTitle                                                   string `json:"common.bishop.title"`
					FeedbackTranslation                                                 string `json:"feedback.translation"`
					CommonRecordWithWarnings                                            string `json:"common.record.with.warnings"`
					LeaderMessagingYoungWomen                                           string `json:"leader-messaging.young-women"`
					MenuDonationReports                                                 string `json:"menu.donation.reports"`
					MenuMissionary                                                      string `json:"menu.missionary"`
					MenuAdultMemberSelfReliance                                         string `json:"menu.adult.member.self.reliance"`
					LeaderMessagingParentsPrimaryChildren                               string `json:"leader-messaging.parents-primary-children"`
					CommonListLabel                                                     string `json:"common.list.label"`
					LeaderMessagingSendMessage                                          string `json:"leader-messaging.send-message"`
					CommonMailingLabelHeadOfHouseName                                   string `json:"common.mailing.label.head.of.house.name"`
					LettersExpirationDate                                               string `json:"letters.expiration.date"`
					LettersPriesthoodOfficiator                                         string `json:"letters.priesthood.officiator"`
					MenuOverview                                                        string `json:"menu.overview"`
					MinisteringShowPhotos                                               string `json:"ministering.show.photos"`
					CommonShow                                                          string `json:"common.show"`
					CommonFLongLabel                                                    string `json:"common.f.long.label"`
					LeaderMessagingAllWardCouncils                                      string `json:"leader-messaging.all-ward-councils"`
					MinisteringAssignmentProposalsApplyInfo                             string `json:"ministering.assignment.proposals.apply.info"`
					CommonWards                                                         string `json:"common.wards"`
					NewMemberShowForPast                                                string `json:"new-member.show.for.past"`
					LeaderMessagingMessageSentConfirmationEmail                         string `json:"leader-messaging.message-sent-confirmation-email"`
					CommonDeleteMessage                                                 string `json:"common.delete.message"`
					CommonMoreActions                                                   string `json:"common.more.actions"`
					LettersValidationSelectLiftingOfFormalMembershipRestrictionsDate    string `json:"letters.validation.select.lifting.of.formal.membership.restrictions.date"`
					MenuEditMemberCalling                                               string `json:"menu.edit.member.calling"`
					CommonMissionPresidentCompanion                                     string `json:"common.mission.president.companion"`
					MenuPatriarchalBlessingSubmission                                   string `json:"menu.patriarchal.blessing.submission"`
					FeedbackClerkResources                                              string `json:"feedback.clerk.resources"`
					CommonAction                                                        string `json:"common.action"`
					MenuFsy                                                             string `json:"menu.fsy"`
					LettersSealingClearanceDecision                                     string `json:"letters.sealing.clearance.decision"`
					MenuOnlyBishopsHaveAccessTraining                                   string `json:"menu.only.bishops.have.access.training"`
					MenuMoveOut                                                         string `json:"menu.move.out"`
					ClassAndQuorumAttendanceOverviewPaginationItemsPerPageTitle         string `json:"class-and-quorum-attendance.overview.pagination.items.per.page.title"`
					LeaderMessagingSearchRecipientsInfoHelp                             string `json:"leader-messaging.search-recipients-info-help"`
					ChildProtectionGovernmentCertifications                             string `json:"child-protection.government.certifications"`
					PefEndorseMember                                                    string `json:"pef.endorse.member"`
					OrdElderOrdinationCertificate                                       string `json:"ord.elder.ordination.certificate"`
					CommonMinAgeX                                                       string `json:"common.min.age.x"`
					CommonAllSections                                                   string `json:"common.all.sections"`
					CommonFullName                                                      string `json:"common.full.name"`
					CommonTimeagoPrefixAgo                                              string `json:"common.timeago.prefix.ago"`
					MenuEditUnitAbbreviations                                           string `json:"menu.edit.unit.abbreviations"`
					MenuWelcomeToOrgsAndCallings                                        string `json:"menu.welcome.to.orgs.and.callings"`
					MenuNewStakeCounselorRecommendation                                 string `json:"menu.new.stake.counselor.recommendation"`
					MinisteringProposedAssignments                                      string `json:"ministering.proposed.assignments"`
					CommonUsername                                                      string `json:"common.username"`
					LeaderMessagingAddRecipients                                        string `json:"leader-messaging.add-recipients"`
					MenuAllocationPercent                                               string `json:"menu.allocation.percent"`
					RecommendCancelRecommend                                            string `json:"recommend.cancel.recommend"`
					CommonPhoneNumberLabel                                              string `json:"common.phone.number.label"`
					CommonMailingLabelOtherOptions                                      string `json:"common.mailing.label.other.options"`
					LeaderMessagingBranchCouncil                                        string `json:"leader-messaging.branch-council"`
					ChildProtectionPageTitle                                            string `json:"child-protection.page.title"`
					MenuTransferSummary                                                 string `json:"menu.transfer.summary"`
					MenuTransfers                                                       string `json:"menu.transfers"`
					CommonTableCount                                                    string `json:"common.table.count"`
					MenuBetaAdministration                                              string `json:"menu.beta.administration"`
					LettersUnread                                                       string `json:"letters.unread"`
					LeaderMessagingAllYoungMenPresidencies                              string `json:"leader-messaging.all-young-men-presidencies"`
					CommonUnordained                                                    string `json:"common.unordained"`
					MenuWelfareHelpLine                                                 string `json:"menu.welfare.help.line"`
					MenuOcl                                                             string `json:"menu.ocl"`
					MenuBoundaryRealignment                                             string `json:"menu.boundary.realignment"`
					CommonMissionPresidentEcclesiastical                                string `json:"common.mission.president.ecclesiastical"`
				} `json:"translations"`
```
-->
