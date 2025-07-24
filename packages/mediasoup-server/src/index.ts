import express from "express"
import http from "http"
import { createWorker, types as mediasoupTypes } from 'mediasoup'
import {Server} from "socket.io"
import {PORT} from "./constants"

const app = express()
const server = http.createServer(app)
const io = new Server(server)


// peers to keep track of each client's webrtc transport
const peers = new Map<string, any>()

// worker to handle media logic
let worker: mediasoupTypes.Worker;

// router to handle RTP routing in a room
let router:  mediasoupTypes.Router;

// initializing mediaSoup
async function startMediaSoup() {
    worker = await createWorker() // launches a process that handles media ops
    router = await worker.createRouter({  // configures the codec server will support 
     mediaCodecs: [
      // Audio codecs
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
        parameters: {
          minptime: 10,
          useinbandfec: 1
        }
      },
      // Video codecs
      {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: {
          'x-google-start-bitrate': 1000
        }
      },
      {
        kind: 'video',
        mimeType: 'video/H264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 1,
          'profile-level-id': '42e01f',
          'level-asymmetry-allowed': 1,
          'x-google-start-bitrate': 1000
        }
      }
    ]
  })
  console.log("MediaSoup router created");
}

// connection via websocket (an identity for all SFU interactions)
io.on('connection', (socket) => {
    console.log(`New connection established ${socket.id}`);

    socket.on('getRouterRtpCapabilities', (_, callback) => {
        callback(router.rtpCapabilities)
    }) // browser needs to know about codec that server supports, it will eventually be sent in SDP offer

    socket.on('createWebRtcTransport', async (_, callback) => {
        const transfer = await router.createWebRtcTransport({ // a virtaul wire through which we send/receive data or media
            listenIps: [{ ip: '127.0.0.1' }],
            enableUdp: true,
            enableTcp: true,
            preferUdp: true
        })
        peers.set(socket.id, {transfer})
         callback({
        id: transfer.id,
        iceParameters: transfer.iceParameters,
        iceCandidates: transfer.iceCandidates,
        dtlsParameters: transfer.dtlsParameters,
    })
    })
    // the above lets the browser send encrypted audio/video through the transport into the SFU.
})

server.listen(PORT, () => {
    console.log(`Mediasoup server running on port ${PORT}`);
})

