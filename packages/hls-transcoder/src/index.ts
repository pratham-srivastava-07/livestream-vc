import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'


// first create an hls dir
const  HLS_DIR = path.resolve(__dirname, 'public', 'hls')


export async function startTranscoding(rtpVideoPort: number, audioPort: number) {
    // chk if directory exists, if not make one
    if (!fs.existsSync(HLS_DIR)) {
        fs.mkdirSync(HLS_DIR, { recursive: true })
    }

    const output = path.join(HLS_DIR, 'stream.m3u8')

    // (NS) ffmpeg spawning takes place
    const ffmpeg = spawn('ffmpeg', [
        // VIDEO input
        '-protocol_whitelist', 'file,udp,rtp',
        '-f', 'rtp',
        '-i', `rtp://127.0.0.1:${rtpVideoPort}`,

        // AUDIO input
        '-f', 'rtp',
        '-i', `rtp://127.0.0.1:${audioPort}`,

        // OUTPUT to HLS
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-f', 'hls',
        '-hls_time', '2',
        '-hls_list_size', '5',
        '-hls_flags', 'delete_segments',
        output,
    ])

    ffmpeg.stdout.on('data', (data) => console.log(`ffmpeg stdout: ${data}`))
    ffmpeg.stderr.on('data', (data) => console.error(`ffmpeg stderr: ${data}`))
    ffmpeg.on('exit', (code) => console.log(`ffmpeg exited with code ${code}`))

    return ffmpeg
}

// Sample usage (mocked RTP ports for now)
if (require.main === module) {
  startTranscoding(5004, 5006)
}
