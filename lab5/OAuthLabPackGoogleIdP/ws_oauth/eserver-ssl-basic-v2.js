require("dotenv").config()

const express = require("express")
const path = require("path")
const ip = require("ip")
const https = require("https")
const fs = require("fs")

let calendarEvents = []

run()

function run() {
    const app = express()

    app.use(express.json())
    app.use(express.static("public"))

    const options = {
        key: fs.readFileSync(path.join(__dirname, "private.key")),
        cert: fs.readFileSync(path.join(__dirname, "server.crt")),
    }

    const server = https.createServer(options, app)
    server.listen(process.env.PORT_P3, () => {
        console.log(`eserver running @ ${ip.address()}:${process.env.PORT_P3}/`)
    })

    app.get("/", (req, res) => {
        res.sendFile(path.join(__dirname, "/eindex.html"))
    })

    app.get("/events", (req, res) => {
        res.send(calendarEvents)
    })

    // Challenge Task 1: only add/delete require authentication.
    app.post("/events", authentication, (req, res) => {
        const eevent = req.body
        eevent.eventid = uuidv4()
        calendarEvents.push(eevent)
        persistEvents()
        res.send({ message: `New event ${eevent.eventid} was added to the list` })
    })

    app.delete("/events", authentication, (req, res) => {
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

function authentication(req, res, next) {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith("Basic ")) {
        res.setHeader("WWW-Authenticate", "Basic")
        return res.status(401).send("Basic authentication required")
    }

    const [user, pass] = Buffer.from(authHeader.split(" ")[1], "base64")
        .toString()
        .split(":")

    if (user === process.env.username && pass === process.env.password) {
        return next()
    }

    res.setHeader("WWW-Authenticate", "Basic")
    return res.status(401).send("Invalid username or password")
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
