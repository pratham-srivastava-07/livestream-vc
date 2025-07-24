import express from "express"
import http from "http"
import { createWorker, types as mediasoupTypes } from 'mediasoup'
import {Server} from "socket.io"
import {PORT} from "./constants"
import {startTranscoding} from "@stream/hls-transcoder"
import cors from "cors"


const app = express()
const server = http.createServer(app)

app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST'],
  credentials: true
}))

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
})

const allProducers: {
  socketId: string
  producer: mediasoupTypes.Producer
  kind: 'video' | 'audio'
}[] = []

// peers to keep track of each client's webrtc transport
const peers = new Map<string, any>()

// worker to handle media logic
let worker: mediasoupTypes.Worker;

// router to handle RTP routing in a room
let router:  mediasoupTypes.Router;

// output RTP ports
const VIDEO_RTP_PORT = 5004
const AUDIO_RTP_PORT = 5006

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

// creating transport between webrtc and hls
async function setUpRtpOutForFfmpeg(videoProducer: mediasoupTypes.Producer, audioProducer: mediasoupTypes.Producer) {
    const createPlainTransport = async (port: number) => {
      return await router.createPlainTransport({
        listenIp: { ip: '127.0.0.1' },
        rtcpMux: false,
        comedia: false,
        enableSctp: false,
        port,
      })
    } 

    //  output raw rtp
    const videoRtpTransport = await createPlainTransport(VIDEO_RTP_PORT)
    const audioRtpTransport = await createPlainTransport(AUDIO_RTP_PORT)
    // connectsto port
    await videoRtpTransport.connect({ ip: '127.0.0.1', port: VIDEO_RTP_PORT })
    await audioRtpTransport.connect({ ip: '127.0.0.1', port: AUDIO_RTP_PORT })
    //takes webrtc media from browser and pushes it into RTP formats.
    await videoRtpTransport.produce({ kind: 'video', rtpParameters: videoProducer.rtpParameters })
    await audioRtpTransport.produce({ kind: 'audio', rtpParameters: audioProducer.rtpParameters })
    // start transcoding 
    startTranscoding(VIDEO_RTP_PORT, AUDIO_RTP_PORT)    
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
    // the above sets the browser and set encrypted audio/video through the transport into the SFU.

    socket.on('produce', async ({ kind, rtpParameters }, callback) => {
      const peer = peers.get(socket.id)
      if (!peer) return

      const producer = await peer.transfer.produce({ kind, rtpParameters })

      allProducers.push({ socketId: socket.id, producer, kind })

      callback({ id: producer.id })
    })


    socket.on('consume', async ({ rtpCapabilities, consumerTransportId }, callback) => {
      const peer = peers.get(socket.id)
      if (!peer) return callback({ error: 'Peer not found' })

      const transport = peer.transfer
      const consumers = []

      for (const { producer } of allProducers) {
        if (!router.canConsume({ producerId: producer.id, rtpCapabilities })) continue

        try {
          const consumer = await transport.consume({
            producerId: producer.id,
            rtpCapabilities,
            paused: false,
          })

          peer.consumer = consumer
          consumers.push({
            id: consumer.id,
            producerId: producer.id,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters
          })
        } catch (err) {
          console.warn('Could not consume', err)
        }
      }

      callback({ consumers })
    })

})

server.listen(PORT, async () => {
    await startMediaSoup()
    console.log(`Mediasoup server running on port ${PORT}`);
})

