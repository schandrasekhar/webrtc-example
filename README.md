# Realtime communication with WebRTC
A sample webrtc app based on web browser. Currently only peer connections are working. Work is in progress to support peerConnections via TURN server.

## How does it work
Signalling is done using socket.io javascript library. After the clients will connect directly to each other.

## Setup
`cd webrtc-example; npm install`

## How to start
`cd webrtc-example; node index.js;`

Go to `http://localhost:8080` on Chrome browser. Open a different tab and go to `http://localhost:8080`. You should see both tabs exchanging video and audio streams.
