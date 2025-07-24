
"use client"
import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import * as mediasoupClient from 'mediasoup-client'
import {
  RtpCapabilities,
  DtlsParameters,
  RtpParameters,
  MediaKind
} from 'mediasoup-client/types'

const SERVER_URL = 'http://localhost:4000'

interface TransportCreationOptions {
  id: string
  iceParameters: any
  iceCandidates: any[]
  dtlsParameters: DtlsParameters
}

interface ConsumeOptions {
  id: string
  producerId: string
  kind: MediaKind
  rtpParameters: RtpParameters
}

export function useWatchClient(onTrack: (track: MediaStream) => void) {
  const socketRef = useRef<Socket | null>(null)
  const deviceRef = useRef<mediasoupClient.Device | null>(null)

  useEffect(() => {
    const socket = io(SERVER_URL)
    socketRef.current = socket

    socket.on('connect', async () => {
      console.log('✅ Connected to mediasoup server as viewer')

      const rtpCapabilities = await request<RtpCapabilities>(socket, 'getRouterRtpCapabilities')

      const device = new mediasoupClient.Device()
      await device.load({ routerRtpCapabilities: rtpCapabilities })
      deviceRef.current = device

      const transportOptions = await request<TransportCreationOptions>(socket, 'createWebRtcTransport')
      const transport = device.createRecvTransport(transportOptions)

      transport.on('connect', ({ dtlsParameters }, callback) => {
        socket.emit('connectTransport', { dtlsParameters })
        callback()
      })

      const { consumers } = await request<{ consumers: ConsumeOptions[] }>(socket, 'consume', {
        rtpCapabilities: device.rtpCapabilities,
        consumerTransportId: transportOptions.id,
      })

      for (const consumerInfo of consumers) {
        const consumer = await transport.consume(consumerInfo)
        const stream = new MediaStream()
        stream.addTrack(consumer.track)
        onTrack(stream)
      }
    })
    return () => {
      socket.disconnect()
    }
  }, [onTrack])

  async function request<T>(socket: Socket, event: string, data?: any): Promise<T> {
    return new Promise((resolve) => {
      socket.emit(event, data || {}, (res: T) => resolve(res))
    })
  }
}
