"use client"

import { useRef, useState } from "react"
import { useWatchClient } from "@/lib/useWatch"

export default function Watch() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [connected, setConnected] = useState(false)

  useWatchClient((stream: MediaStream) => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream
    }
    setConnected(true)
  })

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">/watch</h1>
      <video ref={videoRef} autoPlay playsInline controls className="rounded shadow w-full max-w-lg" />
      {!connected && <p className="mt-4 text-gray-500">Connecting to stream...</p>}
    </div>
  )
}
