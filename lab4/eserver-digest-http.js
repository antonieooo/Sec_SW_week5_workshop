require("dotenv").config()

const express = require("express")
const path = require("path")
const ip = require("ip")
const http = require("http")
const fs = require("fs")
const crypto = require("crypto")

const realm = "Protected Endpoint"
const users = {}
users[process.env.username1] = process.env.password1
users[process.env.username2] = process.env.password2
users[process.env.username3] = process.env.password3

let calendarEvents = []

run()

function run() {
    const app = express()

    app.use(authentication)
    app.use(express.json())
    app.use(express.static("public"))

    const port = process.env.PORT_P2_HTTP || 3005
    const server = http.createServer(app)

    server.listen(port, () => {
        console.log(`digest-http server running @ ${ip.address()}:${port}/`)
    })

    app.get("/", (req, res) => {
        res.sendFile(path.join(__dirname, "/eindex.html"))
    })

    app.get("/events", (req, res) => {
        res.send(calendarEvents)
    })

    app.post("/events", (req, res) => {
        const eevent = req.body
        eevent.eventid = uuidv4()
        calendarEvents.push(eevent)
        persistEvents()
        res.send({ message: `New event ${eevent.eventid} was added to the list` })
    })

    app.delete("/events", (req, res) => {
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
    const unauthorized = (message) =>
        res
            .status(401)
            .header("WWW-Authenticate", `Digest realm="${realm}", qop="auth", nonce="${generateNonce()}"`)
            .send(message)

    if (!req.headers.authorization) {
        return unauthorized("Authorization required")
    }

    const auth = parseDigestAuth(req.headers.authorization)
    if (!auth || !auth.username || !users[auth.username]) {
        return unauthorized("Invalid credentials")
    }

    const ha1 = crypto.createHash("md5").update(`${auth.username}:${realm}:${users[auth.username]}`).digest("hex")
    const ha2 = crypto.createHash("md5").update(`${req.method}:${auth.uri}`).digest("hex")
    const expected = crypto
        .createHash("md5")
        .update(`${ha1}:${auth.nonce}:${auth.nc}:${auth.cnonce}:${auth.qop}:${ha2}`)
        .digest("hex")

    if (expected !== auth.response) {
        return unauthorized("Invalid credentials")
    }

    next()
}

function generateNonce() {
    return crypto.randomBytes(16).toString("hex")
}

function parseDigestAuth(authHeader) {
    if (!authHeader.startsWith("Digest ")) {
        return null
    }

    const auth = {}
    const parts = authHeader.replace("Digest ", "").split(", ")

    for (const part of parts) {
        const firstEq = part.indexOf("=")
        if (firstEq === -1) continue
        const key = part.slice(0, firstEq)
        const value = part.slice(firstEq + 1)
        auth[key] = value.replace(/"/g, "")
    }

    return auth
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
