require("dotenv").config()

const express = require('express')
const path = require('path')
const ip = require('ip');
const https = require("https");
var fs = require('fs');

const crypto = require('crypto');

const realm = 'Protected Endpoint';

const users = {}
users[process.env.username1] = process.env.password1
users[process.env.username2] = process.env.password2
users[process.env.username3] = process.env.password3

var calendarEvents = []
const sseClients = new Set()

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
    server.listen(process.env.PORT_P2, () => {
        console.log(`eserver running @ ${ip.address()}:${process.env.PORT_P2}/`)
    });

    app.get("/", (request, response) => {
        response.sendFile(path.join(__dirname, '/eindex.html'))

    })
    app.get("/events", (request, response) => {
        response.send(calendarEvents);
    })

    app.get("/events/stream", (req, res) => {
        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')
        res.flushHeaders?.()

        res.write(`event: connected\n`)
        res.write(`data: ${JSON.stringify({ message: 'SSE connected' })}\n\n`)

        sseClients.add(res)

        const heartbeat = setInterval(() => {
            res.write(`: heartbeat\n\n`)
        }, 25000)

        req.on('close', () => {
            clearInterval(heartbeat)
            sseClients.delete(res)
            res.end()
        })
    })

    app.post("/events", (req, res) => {
        const eevent = req.body
        eevent.eventid = uuidv4()
        calendarEvents.push(eevent)

        fs.writeFileSync('temp.json', JSON.stringify(calendarEvents), { encoding: 'utf8', flag: 'w' })
        broadcastEventsUpdate('created', eevent.eventid)
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
        broadcastEventsUpdate('deleted', eventid)

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

function authentication(req, res, next) {
    if (!req.headers.authorization) {
        return res.status(401).header('WWW-Authenticate', `Digest realm="${realm}", qop="auth", nonce="${generateNonce()}"`).send('Authorization required');
    }

    const auth = parseDigestAuth(req.headers.authorization);

    if (!auth || !users[auth.username]) {
        return res.status(401).header('WWW-Authenticate', `Digest realm="${realm}", qop="auth", nonce="${generateNonce()}"`).send('Invalid credentials');
    }

    const ha1 = crypto.createHash('md5').update(`${auth.username}:${realm}:${users[auth.username]}`).digest('hex');
    const ha2 = crypto.createHash('md5').update(`${req.method}:${auth.uri}`).digest('hex');
    const response = crypto.createHash('md5').update(`${ha1}:${auth.nonce}:${auth.nc}:${auth.cnonce}:${auth.qop}:${ha2}`).digest('hex');

    if (response !== auth.response) {
        return res.status(401).header('WWW-Authenticate', `Digest realm="${realm}", qop="auth", nonce="${generateNonce()}"`).send('Invalid credentials');
    }

    next();
}

function generateNonce() {
    return crypto.randomBytes(16).toString('hex');
}

function broadcastEventsUpdate(action, eventid) {
    const payload = JSON.stringify({
        action,
        eventid,
        total: calendarEvents.length,
        at: new Date().toISOString(),
    })

    for (const client of sseClients) {
        client.write(`event: events-updated\n`)
        client.write(`data: ${payload}\n\n`)
    }
}


function parseDigestAuth(authHeader) {
    if (!authHeader.startsWith('Digest ')) {
        return null;
    }

    const auth = {};
    const parts = authHeader.replace('Digest ', '').split(', ');

    for (let part of parts) {
        const firstEq = part.indexOf('=');
        if (firstEq === -1) continue;
        const key = part.slice(0, firstEq);
        const value = part.slice(firstEq + 1);
        auth[key] = value.replace(/"/g, '');
    }

    return auth;
}
