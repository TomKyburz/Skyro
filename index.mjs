import { Server } from 'node:http'
import WebSocket, { WebSocketServer } from 'ws'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import mime from 'mime'

const require = createRequire(import.meta.url)

const accessTokens = require('./access-tokens.json')
const allowedTokens = Object.entries(accessTokens).reduce(
  (sum, [k, v]) => ({
    ...sum,
    [v.code]: {
      name: k,
      roles: v.roles || []
    }
  }),
  {}
)

const server = new Server()

server.on('request', async function onRequest (req, res) {
  if (req.url.startsWith('/validate-token')) {
    const token = req.url.split('/').slice(-1)?.[0]
    if (token && allowedTokens[token]) {
      const secure = process.env.IS_OFFLINE ? '' : 'Secure;'
      res.writeHead(200, {
        'set-cookie': `token=${token}; Path=/; HttpOnly; SameSite=Strict; ${secure}`
      })
    } else {
      res.writeHead(401)
    }
    res.end()
  } else {
    const url = req.url.slice(1).split('?')[0] || 'index.html'
    try {
      if (url.includes('..')) {
        throw new TypeError('invalid path')
      }
      if (url === 'access-tokens.json') {
        throw new TypeError('invalid path')
      }
      res.writeHead(200, {
        'Content-Type': mime.getType(url),
        'Cache-Control': 'no-cache'
      })
      for await (const chunk of fs.createReadStream(url)) {
        res.write(chunk)
      }
      res.end()
    } catch (err) {
      console.error(err)
      if (!res.headersSent) {
        res.writeHead(404)
      }
      res.end()
    }
  }
})

const wss = new WebSocketServer({ noServer: true })

server.on('upgrade', function upgrade (req, socket, head) {
  if (req.url === '/session') {
    const token = (Object.entries(req.headers).find(
      ([key, value]) => key.toLowerCase() === 'cookie'
    ) || [])[1]?.match(/token=([^;]+)/)?.[1]
    if (allowedTokens[token]) {
      wss.handleUpgrade(req, socket, head, function done (ws) {
        wss.emit('connection', ws, req)
      })
    } else {
      socket.destroy()
    }
  } else {
    socket.destroy()
  }
})

wss.on('connection', function onConnection (ws, req) {
  const token = (Object.entries(req.headers).find(
    ([key, value]) => key.toLowerCase() === 'cookie'
  ) || [])[1]?.match(/token=([^;]+)/)?.[1]

  const name = allowedTokens[token]?.name

  const user = {
    "Name": `${name}`
  }
  const userdata = JSON.stringify(user)


  if (!name) {
    ws.close()
    return
  }

  for (const client of wss.clients) {
    client.send(
      JSON.stringify({
        type: 'connected',
        name
      }),
      { binary: false }
    )
  }
  ws.on('close', function onClose (alert) {
    for (const client of wss.clients) {
      client.send(
        JSON.stringify({
          type: 'disconnected',
          name
        }),
        { binary: false }
      )
    }
  })
  ws.on('message', function onMessage (data) {
    for (const client of wss.clients) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            type: 'message',
            name,
            data: data.toString()
          }),
          { binary: false }
        )
      }
    }
  })
})

const port = process.env.PORT || 5000

server.listen(port, () => console.log(`Server started on port ${port}`))
