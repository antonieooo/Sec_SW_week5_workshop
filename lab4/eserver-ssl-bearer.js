require("dotenv").config()

const express = require('express')
const path = require('path')
const ip = require('ip');
const https = require("https");
var fs = require('fs');

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

var calendarEvents = []

run()
function run() {
    const app = express()

    app.use(express.json())
    app.use(express.static('public'))

    // Read SSL certificate and key files
    const options = {
        key: fs.readFileSync(path.join(__dirname, "private.key")),
        cert: fs.readFileSync(path.join(__dirname, "server.crt")),
    };

    // Create HTTPS server
    const server = https.createServer(options, app);
    server.listen(process.env.PORT_P2, () => {
        console.log(`eserver running @ ${ip.address()}:${process.env.PORT_P2}/`)
    });

    //creating secret-key for jwt token generation
    const secretkey = crypto.randomBytes(32).toString('hex'); // Generates 32 bytes of random data as hex string

    //Create a token generation endpoint:
    app.post('/login', (req, res) => {
        const { username, password } = req.body;

        // Validate user credentials
        if (username === process.env.username3 && password === process.env.password3) {
            const token = jwt.sign({ username }, secretkey, { expiresIn: '1h' }); 
            res.json({ token });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    });

    // Create function to verify tokens:
    const authenticateToken = (req, res, next) => {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) return res.sendStatus(401);

        jwt.verify(token, secretkey, (err, user) => {
            if (err) return res.sendStatus(403);
            req.user = user;
            next();
        });
    };

    app.get("/", (request, response) => {
        response.sendFile(path.join(__dirname, '/eindex-bearer.html'))

    })
    app.get("/events", authenticateToken, (request, response) => {
        response.send(calendarEvents);
    })

    app.post("/events", authenticateToken,(req, res) => {
        const eevent = req.body
        eevent.eventid = uuidv4()
        calendarEvents.push(eevent)

        fs.writeFileSync('temp.json', JSON.stringify(calendarEvents), { encoding: 'utf8', flag: 'w' })
        res.send({
            message: `New event ${eevent.eventid} was added to the list`,
        });
    });

    app.delete("/events",authenticateToken, (req, res) => {
        const eventid = req.body.eventid

        for (let i = 0; i < calendarEvents.length; i++) {
            const cevent = calendarEvents[i]
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

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function loadEvents() {
    if (fs.existsSync('temp.json')) {
        fs.readFile('temp.json', 'utf8', (err, data) => {
            if (err) {
                console.error(err);
                return;
            }
            calendarEvents = JSON.parse(data)
        });
    }
}
