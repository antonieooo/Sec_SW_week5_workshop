require("dotenv").config()

const express = require('express')
const fs = require('fs')
const https = require('https')
const path = require('path')
const WebSocket = require('ws');

const clients = new Map()
const bindHost = process.env.BIND_HOST || '127.0.0.1'
const publicHost = process.env.PUBLIC_HOST || 'localhost'
const tlsKeyPath = process.env.TLS_KEY_PATH || path.join(__dirname, 'certs', 'localhost-key.pem')
const tlsCertPath = process.env.TLS_CERT_PATH || path.join(__dirname, 'certs', 'localhost-cert.pem')

function getTLSOptions() {
    return {
        key: fs.readFileSync(tlsKeyPath),
        cert: fs.readFileSync(tlsCertPath),
    }
}

// Start SSE-Forum
const start = async function () {
    await initWS()
    sendWSEndpoint()
}
start()

// Implement websockets protocol to persist the information flow channel 
// between the client and server. These include listening to  message 
// requests from clients, broadcasting message to all clients and
// web socket close events
async function initWS() {

    return new Promise(async (resolve, reject) => {

        const wsHttpsServer = https.createServer(getTLSOptions())
        const wss = new WebSocket.Server({ server: wsHttpsServer });
        wsHttpsServer.on('error', reject)
        wss.on('error', reject)
        wsHttpsServer.on('listening', () => {
            console.log(`SSE-Forum WebSocketSecure endpoint running @ wss://${publicHost}:${process.env.PORT_WS}`)
            resolve(true)
        })
        wss.on('connection', (ws, req) => {

            const id = getCookie(req,'sessionID')

            const color = Math.floor(Math.random() * 360)
            const date_time = new Date();
            let month = ("0" + (date_time.getMonth() + 1)).slice(-2);
            let date = ("0" + date_time.getDate()).slice(-2);
            let year = date_time.getFullYear();
            let hours = date_time.getHours();
            let minutes = date_time.getMinutes();
            let seconds = date_time.getSeconds();
            let time = `${year}-${month}-${date} ${hours}:${minutes}:${seconds}`

            const metadata = { 'id': id, 'color': color, 'date': time };

            let parameters = req.url.split('/forum?')[1].split("&")
            for (let i = 0; i < parameters.length; i++) {
                let parameter = parameters[i].split('=')
                let key = parameter[0]
                let value = parameter[1]
                if (key === 'name') {
                    metadata.name = value
                }
                if (key === 'email') {
                    metadata.email = value
                }
            }

            clients.set(ws, metadata)

            let payload = JSON.parse(JSON.stringify(metadata))
            payload.message = `joined forum`
            broadcastMessage(payload)


            //broatcast every message received from ws
            ws.on('message', (data, isBinary) => {
                const metadata = clients.get(ws)
                const message = isBinary ? data : data.toString();

                let payload = JSON.parse(JSON.stringify(metadata))
                payload.message = message
                broadcastMessage(payload)

            })

            ws.on('close', function () {
                const metadata = clients.get(ws)
                clients.delete(ws);

                let payload = JSON.parse(JSON.stringify(metadata))
                payload.message = `left forum`
                broadcastMessage(payload)
            });

        })

        wsHttpsServer.listen(process.env.PORT_WS, bindHost)
    })
}


// Implement a client that calls a REST API to initiate a persistent WebSocket
// information channel. These include receiving broadcast response messages 
// from the server,  sending messages, and closing the web socket

function sendWSEndpoint() {

    const app = express()
    const initHttpsServer = https.createServer(getTLSOptions(), app)

    app.use(express.json())
    app.use(express.static('public'))

    initHttpsServer.listen(process.env.PORT_INIT, bindHost, () => {
        console.log(`SSE-Forum browser initialisation endpoint running @ https://${publicHost}:${process.env.PORT_INIT}/`)
    })

    app.get("/", (request, response) => {
        const id = uuidv4()

        // response.setHeader("x-ws-host", `${ip.address()}:${process.env.PORT_WS}`)
        response.setHeader('Set-Cookie', [
            `ws_host=${publicHost}:${process.env.PORT_WS}; SameSite=Lax; Secure`,
            `sessionID=${id}; SameSite=Lax; Secure`
        ])

        response.sendFile(path.join(__dirname, '/index.html'))
    });

}

function broadcastMessage(payload) {
    const date_time = new Date();
    let month = ("0" + (date_time.getMonth() + 1)).slice(-2);
    let year = date_time.getFullYear();
    let date = ("0" + date_time.getDate()).slice(-2);
    let hours = date_time.getHours();
    let minutes = date_time.getMinutes();
    let seconds = date_time.getSeconds();
    let time = `${year}-${month}-${date} ${hours}:${minutes}:${seconds}`

    payload.time = time
    payload.activeparticipants = clients.size
    const outbound = JSON.stringify(payload);

    setTimeout(function () {
        [...clients.keys()].forEach((client) => {
            client.send(outbound);
        });
    }, 500);
}

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function getCookie(request, cookiename) {
    const cookieHeader = request.headers?.cookie;

    let a = `; ${cookieHeader}`.match(`;\\s*${cookiename}=([^;]+)`);
    return a ? a[1] : '';
}
