import WebSocket, {WebSocketServer} from "ws";
import { PORT } from "./constants";

// defining type of message tat will be sent or received
type Message = {
     type: 'JOIN' | 'SDP_OFFER' | 'SDP_ANSWER' | 'ICE_CANDIDATE'
    from: string
    to?: string
    payload?: any
}

// initiating websocket server
const wss = new WebSocketServer({port: 5000})

// map of clients for non persistant data
const clients = new Map<string, WebSocket>()

// on connection
wss.on("connection", (ws) => {
    let clientId = "";

    ws.on("message", (msg) => {
        try {
            const data: Message = JSON.parse(msg.toString())

            switch(data.type) {
                case "JOIN":  //lets each client register itself with ID
                    clientId = data.from
                    clients.set(clientId, ws)
                    console.log(`New Client joined ${clientId}`)
                    break;
                
                case "SDP_ANSWER": // used in direct peer to peer webrtc connection 
                case 'SDP_OFFER':
                case "ICE_CANDIDATE":
                    if(data.to && clients.has(data.to)) {
                        const target = clients.get(data.to)
                        target?.send(JSON.stringify(data))
                    }
                    break;
            }
        } catch(e){
            console.log(`An error occured ${e}`)
        }
    })

    ws.on("close", () => {
        clients.delete(clientId)
        console.log(`${clientId} disconnected`)
    })
})

console.log(`WS server started on Port ${PORT}`)