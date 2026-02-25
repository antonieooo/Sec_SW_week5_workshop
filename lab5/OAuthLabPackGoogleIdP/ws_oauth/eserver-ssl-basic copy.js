require("dotenv").config()

const express = require('express')
const path = require('path')
const ip = require('ip');
const https = require("https");
var fs = require('fs');


var calendarEvents = []

run()
function run() {
    const app = express()

    // First step is the authentication of the client
    app.use(authentication)

    app.use(express.json())
    app.use(express.static('public'))

    // Read SSL certificate and key files
    const options = {
        key: fs.readFileSync(path.join(__dirname, "private.key")),
        cert: fs.readFileSync(path.join(__dirname, "server.crt")),
    };

    // Create HTTPS server
    const server = https.createServer(options, app);
    server.listen(process.env.PORT_P3, () => {
        console.log(`eserver running @ ${ip.address()}:${process.env.PORT_P3}/`)
    });

    app.get("/", (request, response) => {
        response.setHeader('WWW-Authenticate', 'Basic');
        response.sendFile(path.join(__dirname, '/eindex.html'))
    })
    app.get("/events", (request, response) => {
        response.send(calendarEvents);
    })

    app.post("/events", (req, res) => {
        const eevent = req.body
        eevent.eventid = uuidv4()
        calendarEvents.push(eevent)

        fs.writeFileSync('temp.json', JSON.stringify(calendarEvents), { encoding: 'utf8', flag: 'w' })
        res.send({
            message: `New event ${eevent.eventid} was added to the list`,
        });
    });

    app.delete("/events", (req, res) => {
        const eventid = req.body.eventid

        for (let i = 0; i < calendarEvents.length; i++) {
            cevent = calendarEvents[i]
            if (cevent.eventid === eventid) {
                calendarEvents.splice(i, 1);
                break
            }
        }
        fs.writeFileSync('temp.json', JSON.stringify(calendarEvents), { encoding: 'utf8', flag: 'w' })

        res.send({
            message: `event ${eventid} was removed from the list`,
        });
    });

    loadEvents()
}


function authentication(req, res, next) {
    const authheader = req.headers.authorization;
    console.log(req.headers);

    if (!authheader) {
        let err = new Error('You are not authenticated');
        res.setHeader('WWW-Authenticate', 'Basic');
        err.status = 401;
        return next(err)
    }

    const auth = new Buffer.from(authheader.split(' ')[1], 'base64').toString().split(':');
    const user = auth[0];
    const pass = auth[1];

    if (user == process.env.username && pass == process.env.password) {

        // If Authorized user
        next();
    } else {
        let err = new Error('You are not authenticated');
        res.setHeader('WWW-Authenticate', 'Basic');
        err.status = 401;
        return next(err);
    }

}

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}


function loadEvents() {
    if(fs.existsSync('temp.json')){
        fs.readFile('temp.json', 'utf8', (err, data) => {
            if (err) {
                console.error(err);
                return;
            }
            calendarEvents = JSON.parse(data)
        });
    }    
}