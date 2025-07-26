// app/lib/useStreamClient.ts
"use client"
import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import * as mediasoupClient from 'mediasoup-client'
import {
  RtpCapabilities,
  DtlsParameters,
  RtpParameters,
} from 'mediasoup-client/types'
import { Transport } from 'mediasoup-client/types'

const SERVER_URL = 'http://localhost:4000'

interface TransportCreationOptions {
  id: string
  iceParameters: any
  iceCandidates: any[]
  dtlsParameters: DtlsParameters
}

export function useStreamClient() {
  const socketRef = useRef<Socket | null>(null)
  const deviceRef = useRef<mediasoupClient.Device | null>(null)
  const transportRef = useRef<Transport | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)

  const getLocalStream = useCallback(async () => {
    const media = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
    setStream(media)
    return media
  }, [])

  const connect = useCallback(() => {
    const socket = io(SERVER_URL)
    socketRef.current = socket
  }, [])

  const createTransportAndProduce = useCallback(async () => {
    if (!stream || !socketRef.current) return

    const socket = socketRef.current
    console.log("📡 Requesting router RTP capabilities")
    const rtpCapabilities = await request<RtpCapabilities>(socket, 'getRouterRtpCapabilities')
     console.log("🎛️ Creating device")
    const device = new mediasoupClient.Device()
    await device.load({ routerRtpCapabilities: rtpCapabilities })
    deviceRef.current = device
    console.log("🔧 Requesting transport creation")


    const transportOptions = await request<TransportCreationOptions>(socket, 'createWebRtcTransport')
    console.log("🚚 Creating send transport")
    const transport = device.createSendTransport(transportOptions)

    transport.on('connect', ({ dtlsParameters }, callback) => {
      console.log("🔗 Connecting transport")
      socket.emit('connectTransport', { dtlsParameters })
      callback()
    })

    transport.on('produce', async ({ kind, rtpParameters }, callback) => {
      console.log(`📤 Producing ${kind}`)
      const { id } = await request<{ id: string }>(socket, 'produce', { kind, rtpParameters })
      console.log(`✅ Produced ${kind} with id: ${id}`)
      callback({ id })
    })

    for (const track of stream.getTracks()) {
      console.log(`🎥 Sending track: ${track.kind}`)
      await transport.produce({ track })
    }

    transportRef.current = transport
  }, [stream])

  async function request<T>(socket: Socket, event: string, data?: any): Promise<T> {
    return new Promise((resolve) => {
      socket.emit(event, data || {}, (res: T) => resolve(res))
    })
  }

  return {
    stream,
    getLocalStream,
    connect,
    createTransportAndProduce,
  }
}
