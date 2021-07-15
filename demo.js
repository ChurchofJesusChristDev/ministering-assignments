function $(sel, el) {
  return (el || document.body).querySelector(sel);
}

function $$(sel, el) {
  return (el || document.body).querySelectorAll(sel);
}

async function sleep(delay = 100) {
  return new Promise(function (resolve) {
    setTimeout(resolve, delay);
  });
}

(async function main() {
  'use strict';

  let now = Date.now();
  await Promise.all(
    [
      "https://churchofjesuschristdev.github.io/send-ministering-assignments/transform.js?" + now,
      "https://churchofjesuschristdev.github.io/send-ministering-assignments/template.js?" + now,
      "https://churchofjesuschristdev.github.io/send-ministering-assignments/email.js?" + now,
    ].map(loadScript)
  );

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src =  src;
      //script.async = false;
      script.onload = resolve;
      script.onerror = reject;
      document.body.append(script);
    });
  }

  let data = JSON.parse($('script[type="application/json"]').innerText);
  console.info("Initial Page Load Data:");
  console.info(data);
  console.info();
 
  document.body = document.createElement('body');
  document.body.style = null;
  document.body.style.fontSize = '8pt';
  
  console.info("Initializing ...");
  await CJCD.init(data);
  
  let len = Object.keys(CJCD.ids).length;
  // Each assignment contains at least 3 people, probably more
  let max = len;
  let offset = Math.round(max * 0.05);
  document.body.innerHTML = `
    <style>
        @media print {
            header {
                display: none;
            }
        }
    </style>
    <header>
      <h1>Loading...</h1>
      <h2>
          <progress max="${max}" value="${offset}"></progress>
          <a href="#"
              onclick="
                  var tmp = this.innerHTML;
                  this.innerText = 'Loading...';
                  this.disabled = true;
                  window.CJCD.download();
                  this.innerHTML = tmp;
                  this.disabled = true;
                  return false;
              " hidden><i>Download JSON</i></a>
          <a href="#"
              onclick="
                  var tmp = this.innerHTML;
                  this.innerText = 'Loading...';
                  this.disabled = true;
                  window.print();
                  this.innerHTML = tmp;
                  this.disabled = true;
                  return false;
              " hidden><i>Print to PDF</i></a>
      </h2>
      <div style="page-break-after: always;"></div>
    </header>
    <main>
    </main>
  `;
  
  // running in parallel (not conflicting or doubling)
  console.info("Loading missing information (photo, email, address, etc) ...");
  let lastRender = 0;
  let updates = [];
  await sleep(500); // TODO make better initializers for the template stuff
  await Object.keys(CJCD.ids).reverse().reduce(function (promise, id, i, arr) {
      return promise.then(async function () {
          console.log('[DEBUG]', i);
          let assignment = await CJCD.getAssignment(id);
          console.info(i, assignment.member.nickname);
          $('progress').value = offset + i;
          if (!assignment.assignments.length) {
              console.debug('(no assignment)');
              return;
          }
          console.info(assignment);
        
          let table = CJCD.renderAssignment(assignment);
          let now = Date.now();
          let isLast = i === arr.length - 1;
          // throttle redendering so that progress will update even when this gets large
          updates.push(table + '<div style="page-break-after: always;"></div>');
          if (now - lastRender >= 2000 || isLast) {
            console.log('[DEBUG] Render', i);
            lastRender = now;
            $('main').innerHTML = updates.reverse().join('\n\n') + $('main').innerHTML;
            updates = [];
          } else {
            console.log('[DEBUG] Skip', i, updates.length);
          }
      });
  }, Promise.resolve());
  
  console.info("Done.");
  $('header h1').innerText = 'Ready!';
  // TODO JSON & CSV Download
  $('header h2 progress').hidden = true;
  $$('header h2 a').forEach(function (el) { el.hidden = false; });
  console.info();
  
  console.info("Ministering Assignments (sensibly organized):");
  // TODO: toCSV()
  console.info("run `CJCD.toJSON();` to view or `CJCD.download();` to download to your computer");
}().catch(function (err) {
  console.error("Error:");
  console.error(err.stack || err.message || err);
}));
