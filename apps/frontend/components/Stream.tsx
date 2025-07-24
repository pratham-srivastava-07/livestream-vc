// app/stream/page.tsx
"use client"

import { useStreamClient } from "@/lib/useStream"
import { useEffect, useRef, useState } from "react"


export default function Stream() {
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const [joined, setJoined] = useState(false)
  const {
    connect,
    getLocalStream,
    createTransportAndProduce,
  } = useStreamClient()

  useEffect(() => {
    const start = async () => {
      const stream = await getLocalStream()
      if (localVideoRef.current && stream) {
        localVideoRef.current.srcObject = stream
      }

      await connect()
      await createTransportAndProduce()
      setJoined(true)
    }

    start()
  }, [])

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">/stream</h1>
      <video ref={localVideoRef} autoPlay muted className="rounded shadow w-full max-w-lg" />
      {!joined && <p className="mt-4 text-gray-500">Connecting...</p>}
    </div>
  )
}
