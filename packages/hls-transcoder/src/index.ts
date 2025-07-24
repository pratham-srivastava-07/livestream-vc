import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'


// first create an hls dir
const  HLS_DIR = path.resolve(__dirname, 'public', 'hls')
