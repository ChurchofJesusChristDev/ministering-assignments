# Send Ministering Assignments

Send a friend email for all assignments with plain-text contact information

> Most people don't know where to check their ministering assignment,
> and don't know when it has changed.
> 
> We want to periodically send a church email (and eventually texts)
> showing assignments in a simple way, and with a call to action.

https://lcr.churchofjesuschrist.org/ministering?lang=eng&type=EQ&tab=assigned

## Notes

```js
var data = JSON.parse($('script[type="application/json"]').innerText);

// Misnomer, these are Ministering Districts
data.props.pageProps.initialState.ministeringData.elders

// Sadly, no ID
data.props.pageProps.initialState.ministeringData.elders[0].supervisorName

// Individual ID and email, but no phone number
data.props.pageProps.initialState.ministeringData.elders[0].companionships[0].ministers[0].legacyCmisId
// Individual ID, but no contact info
data.props.pageProps.initialState.ministeringData.elders[0].companionships[0].assignments[0].legacyCmisId
```
