
require('dotenv').config();
let crypto = require('crypto');
const nodemailer = require('nodemailer');
const express = require('express');
//handle POST from shopify webhook
const bodyParser = require('body-parser');
let getRawBody = require('raw-body')
let fs = require('fs');
const path = require('path');
const SERVER_PORT = process.env.PORT || 5000;
//set in heroku https://devcenter.heroku.com/articles/config-vars using https://www.sendowl.com/settings/api_credentials
let SOKEY = process.env.SO_KEY;
let SOSECRET = process.env.SO_SECRET;
const SHOPSECRET = process.env.SHOPIFY_SHARED_SECRET;
//only set locally
const ISLOCAL = process.env.LOCAL;
const EMAIL = process.env.EMAIL_USER;
const EPASS = process.env.EMAIL_PASS;
const GMAIL = process.env.GMAIL_USER;
const GPASS = process.env.GMAIL_PASS;
const WRITEFILE = false;
const RUNTEST = 0;


///SETUP Email service
///with google
const gmail_transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: GMAIL,
        pass: GPASS
    }
});

// setup email data
const gmailOptions = {
    from: '"Sensel - Your Free Software" <peter@sensel.com>', // sender address
    to: 'p@nbor.us', // list of receivers
    subject: 'From Node App', // Subject line
    text: 'Hello world', // plain text body
};

async function sendEmail(data){
  gmailOptions.text = data;
  console.log("======================>");
  gmail_transporter.sendMail(gmailOptions, function (err, info) {
      if (err) {
          console.log(err);
      } else {
          console.log('Message sent: ' + info.response);
      }
  });
}

async function process_get(req, res) {
  console.log('We got an order!...');
  for(let i in req){
    // console.log(`i: ${i}`);
  }
  console.log(`--rawbody: ${req.rawbody}`)
  // We'll compare the hmac to our own hash
  const hmac = req.get('X-Shopify-Hmac-Sha256');
  console.log(`hmac: ${hmac}`);
  // Use raw-body to get the body (buffer)
  const body = JSON.stringify(req.body);
  // Create a hash using the body and our key
  const hash = crypto
    .createHmac('sha256', SHOPSECRET)
    .update(req.rawbody, 'utf8', 'hex')
    .digest('base64');

  // Compare our hash to Shopify's hash
  if (hash === hmac) {
    // It's a match! All good
    console.log('Phew, it came from Shopify!');
    console.log(`email fields ${req.body.customer.email} ${req.body.contact_email}`);
    for (let i in req.body.line_items){
      var title = req.body.line_items[i]['title'];
      var sku = req.body.line_items[i]['sku'];
      console.log(`skus ${sku} title ${title}`)
    }
    var json = JSON.stringify(req.body);
    sendEmail(json);
    if(WRITEFILE){
      fs.writeFile('ShopifyExample.json', json, (err) => {
        // throws an error, you could also catch it here
        if (err) throw err;
        // success case, the file was saved
        console.log('Order JSON saved!');
      });
    }
    res.sendStatus(200);
  } else {
    // No match! This request didn't originate from Shopify
    console.log('Danger! Not from Shopify!');
    res.sendStatus(403);
  }
}

async function parseOrderInfo (req,res){
  let email = req.body.contact_email;
  console.log(`email fields ${req.body.customer.email} ${req.body.contact_email}`)
  //if app isn't live, send to me, not customer.
  if(ISLIVE==0){
    email = TESTMAIL;
  }
  const order_num = req.body.name;
  const first_name = req.body.customer.first_name;
  const last_name = req.body.customer.last_name;
  //when order is scanned, we store counts of auths to send out
  let auths_needed = {'bitwig_8ts':0, 'arturia_all':0};
// `-----done scanning order. need ${auths_needed.arturia_all} Artu
  console.log(`** Order # ${order_num} from: ${req.body.contact_email} name: ${first_name} ${last_name}`);

        if(ISLIVE==1 || req.body.contact_email==='jon@doe.ca'){
            //Morph + MP,             Piano,          Drum,        Innovator,        Buchla,      MM Bundle
            let all_and_bw8ts = (sku==='S4008' || sku==='S4009' || sku==='S4010' || sku==='S4002' || sku==='S4013' || sku ==='S4001');
            let all_only = (sku === "S4007" || sku === "S4011" || sku === "S4003" || sku === "S4004" || sku === "S4005" || sku === "S0002")
            if(all_and_bw8ts){
              //provide Arturia and Bitwig code
              auths_needed.bitwig_8ts = auths_needed.bitwig_8ts + quantity;
              auths_needed.arturia_all = auths_needed.arturia_all + quantity;
            //Morph +      VEO            Gaming         QWERTY        AZERTY        DVORAK           No Overlay
          }else if(all_only){
              //provide only Arturia
              auths_needed.arturia_all = auths_needed.arturia_all + quantity;
            }
        }

}


function main() {
  // create a server that listens for URLs with order info.
  express()
    .use(express.static(path.join(__dirname, 'public')))
    .use(bodyParser.json({
        type:'application/json',
        limit: '50mb',
        verify: function(req, res, buf) {
            if (req.url.startsWith('/')){
              req.rawbody = buf;
            }
        }
    })
    )
    .use(bodyParser.urlencoded({ extended: true }))

    .get('/', function(req, res) {
      console.log('get it');
      res.send('SENSEL').status(200);
    })

    .post('/shopify/webhook', async function(req, res){
      process_get(req,res)
    })
    .post('/', async function(req, res){
      process_get(req,res)
    })

    .listen(SERVER_PORT, () => console.log(`Sensel: We're listening on ${ SERVER_PORT }`));
}
main();
