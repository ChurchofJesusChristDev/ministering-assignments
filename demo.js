(async function main() {
  'use strict';

  let now = Date.now();
  await Promise.all(
    [
      "https://churchofjesuschristdev.github.io/send-ministering-assignments/transform.js?" + now,
      "https://churchofjesuschristdev.github.io/send-ministering-assignments/template.js?" + now,
      "https://churchofjesuschristdev.github.io/send-ministering-assignments/email.js?" + now,
    ].map(function (src) {
      return new Promise(function (resolve, reject) {
        var script = document.createElement('script');
        script.src =  src;
        //script.async = false;
        script.onload = resolve;
        script.onerror = reject;
        document.body.append(script);
      });
    })
  );
  
  function $(sel, el) {
    return (el || document.body).querySelector(sel);
  }

  let data = JSON.parse($('script[type="application/json"]').innerText);
  console.info("Initial Page Load Data:");
  console.info(data);
  console.info();
  
  console.info("Loading missing information (email, address, etc) ...");
  await CJCD.init(data);
  console.info("Done.");
  console.info();
  
  console.info("Ministering Assignments (sensibly organized):");
  console.info(
    JSON.stringify(CJCD.toJSON(), function (key) {
      if ('imageDataUrl' === key) {
        return '';
      }
    }, 2)
  );
  
  document.body.innerHTML = '<table>' + CJCD.toJSON().map(function (assignment) {
  return `
    <tr>
      <td><img src="${assignment.member.imageDataUrl}" width="100px" /></td>
      <td>${assignment.member.nickname}</td>
      <td>${assignment.member.age}</td>
      <td>${assignment.member.gender}</td>
      <td>${assignment.member.phone}</td>
      <td>${assignment.member.email}</td>
      <td>${assignment.member.address?.join('<br>')}</td>
    </tr>
  `;
}).join('\n') + '</table>';
}().catch(function (err) {
  console.error("Error:");
  console.error(err.stack || err.message || err);
}));
