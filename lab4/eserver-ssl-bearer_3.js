require("dotenv").config()

const express = require("express")
const path = require("path")
const ip = require("ip")
const https = require("https")
const fs = require("fs")
const jwt = require("jsonwebtoken")
const crypto = require("crypto")

let calendarEvents = []

run()

function run() {
    const app = express()
    const secretkey = crypto.randomBytes(32).toString("hex")

    app.use(express.json())
    app.use(express.static("public"))

    // Challenge Task 3 suggestion #2: progressive slowdown for high-frequency clients.
    const slowdown = createProgressiveSlowdown({
        windowMs: 30 * 1000,
        freeRequests: 20,
        delayStepMs: 200,
        maxDelayMs: 3000,
    })
    app.use("/login", slowdown)
    app.use("/events", slowdown)

    const options = {
        key: fs.readFileSync(path.join(__dirname, "private.key")),
        cert: fs.readFileSync(path.join(__dirname, "server.crt")),
    }

    const server = https.createServer(options, app)
    server.listen(process.env.PORT_P2, () => {
        console.log(`eserver running @ ${ip.address()}:${process.env.PORT_P2}/`)
    })

    app.post("/login", (req, res) => {
        const { username, password } = req.body

        if (username === process.env.username3 && password === process.env.password3) {
            const token = jwt.sign({ username }, secretkey, { expiresIn: "1h" })
            return res.json({ token })
        }

        res.status(401).json({ error: "Invalid credentials" })
    })

    app.get("/", (req, res) => {
        res.sendFile(path.join(__dirname, "/eindex-bearer.html"))
    })

    app.get("/events", authenticateToken(secretkey), (req, res) => {
        res.send(calendarEvents)
    })

    app.post("/events", authenticateToken(secretkey), (req, res) => {
        const eevent = req.body
        eevent.eventid = uuidv4()
        calendarEvents.push(eevent)
        persistEvents()
        res.send({ message: `New event ${eevent.eventid} was added to the list` })
    })

    app.delete("/events", authenticateToken(secretkey), (req, res) => {
        const eventid = req.body.eventid

        for (let i = 0; i < calendarEvents.length; i++) {
            const cevent = calendarEvents[i]
            if (cevent.eventid === eventid) {
                calendarEvents.splice(i, 1)
                break
            }
        }

        persistEvents()
        res.send({ message: `event ${eventid} was removed from the list` })
    })

    loadEvents()
}

function authenticateToken(secretkey) {
    return (req, res, next) => {
        const authHeader = req.headers.authorization
        const token = authHeader && authHeader.split(" ")[1]

        if (!token) {
            return res.sendStatus(401)
        }

        jwt.verify(token, secretkey, (err, user) => {
            if (err) {
                return res.sendStatus(403)
            }
            req.user = user
            next()
        })
    }
}

function createProgressiveSlowdown({ windowMs, freeRequests, delayStepMs, maxDelayMs }) {
    const buckets = new Map()

    return (req, res, next) => {
        const key = req.ip
        const now = Date.now()
        const current = buckets.get(key)

        if (!current || now - current.windowStart >= windowMs) {
            buckets.set(key, { count: 1, windowStart: now })
            return next()
        }

        current.count += 1

        if (current.count <= freeRequests) {
            return next()
        }

        const over = current.count - freeRequests
        const delay = Math.min(over * delayStepMs, maxDelayMs)

        return setTimeout(next, delay)
    }
}

function persistEvents() {
    fs.writeFileSync("temp.json", JSON.stringify(calendarEvents), { encoding: "utf8", flag: "w" })
}

function uuidv4() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0
        const v = c === "x" ? r : (r & 0x3 | 0x8)
        return v.toString(16)
    })
}

function loadEvents() {
    if (fs.existsSync("temp.json")) {
        fs.readFile("temp.json", "utf8", (err, data) => {
            if (err) {
                console.error(err)
                return
            }
            calendarEvents = JSON.parse(data)
        })
    }
}
