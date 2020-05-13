'use strict';
 
var isStarted = true;
var turnReady;
let serverShutdown = false;

let localStream;
const shouldMute = true;

//TODO make it work with TURN server
const pcConfig = null;
// const pcConfig = {
//   'iceServers': [
//     {
//       'urls': 'turn:localhost:3478',
//       'username': "test",
//       'credential': "test"
//     }
//   ]
// };
const constraints = {
  video: true,
  audio: true
};

const videosElement = document.getElementById("videos");
const id = window.performance.now().toString();
const videoMetadataList = {
  local: [],
  remote: []
};
/*
  peerConnectionMap = {
    <remote_unique_id>: {
      peerConnection: {}
    }
  }
*/
const peerConnectionMap = {};
 

 
/////////////////////////////////////////////
//const room = window.prompt(message, "foo");
const room = 'foo';
const name = window.prompt("Enter a name", "test-user-" + Date.now());
const socket = io.connect();

if (room !== '') {
  socket.emit('create or join', room);
  console.debug('Attempted to create or  join room', room);
}

// socket.on('created', function(room) {
//   console.log('Created room ' + room);
//   isInitiator = true;
// });

socket.on('full', function(room) {
  console.debug('Room ' + room + ' is full');
});

// socket.on('join', function (room) {
//   console.log('Another peer made a request to join room ' + room);
//   console.log('This peer is the initiator of room ' + room + '!');
//   isChannelReady = true;
// });

// socket.on('joined', function(room) {
//   console.log('joined: ' + room);
//   isChannelReady = true;
// });

socket.on('log', function(array) {
  console.debug("custom log");
});

socket.on('chat_message', function(message) {
    const chatMessage = message.payload.data;
    const chatConsoleElement = document.getElementById("chat-console");
    const preElement = document.createElement("PRE");
    preElement.innerText = chatMessage;
    chatConsoleElement.appendChild(preElement);
});

const chatButton = document.getElementById("chat-submit");
chatButton.onclick = function() {
  const textAreaElement = document.getElementById("chat-input");
  const textValue =  textAreaElement.value;
  socket.emit("chat_message", {
    uniqueId: id,
    payload: {
      data: textValue
    }
  });
  const chatConsoleElement = document.getElementById("chat-console");
  const preElement = document.createElement("PRE");
  preElement.innerText = textValue;
  chatConsoleElement.appendChild(preElement);
  textAreaElement.value = "";
};
document.getElementById("chat-input").onkeydown = function (event) {
  var keypressed = event.keyCode || event.which;
  if (keypressed == 13 && !event.shiftKey) {
    document.getElementById("chat-submit").click();
    event.preventDefault();
  }
};

socket.on('connect_error', function(err) {
  const keys = Object.keys(peerConnectionMap);
  if (!serverShutdown) {
    keys.forEach(function(uniqueId) {
      const peerConnection = peerConnectionMap[uniqueId].peerConnection;
      peerConnection.close();
      delete peerConnectionMap[uniqueId];
    });
    while(videosElement.childNodes.length > 1) {
      videosElement.removeChild(videosElement.lastElementChild);
    }
    window.alert("server shutdown, closing all peer connections");
    serverShutdown = true;
  }
});

////////////////////////////////////////////////

function sendMessage(message) {
  console.debug('Client sending message: ', message);
  socket.emit('message', message);
}

// This client receives a message
socket.on('message', function(message) {
  if (!peerConnectionMap[message.uniqueId]) {
    peerConnectionMap[message.uniqueId] = {};
  }
  if (message.payload.type === 'got user media') {
    console.log('Client received message:', id, message.uniqueId, message.payload.type);
    const peerConnection = maybeStart(message);
    peerConnectionMap[message.uniqueId]["peerConnection"] = peerConnection;
  }
  if (message.toAddress === id) {
    if (message.payload.type === 'offer') {
      if (!peerConnectionMap[message.uniqueId]["peerConnection"]) {
        const peerConnection = maybeStart(message);
        peerConnectionMap[message.uniqueId]["peerConnection"] = peerConnection;
      }
      console.log('Client received message:', id, message.uniqueId, message.payload.type);
      peerConnectionMap[message.uniqueId]["peerConnection"].setRemoteDescription(new RTCSessionDescription(message.payload));
      doAnswer(peerConnectionMap[message.uniqueId]["peerConnection"], message);
    } else if (message.payload.type === 'answer' && isStarted) {
      console.log('Client received message:', id, message.uniqueId, message.payload.type);
      peerConnectionMap[message.uniqueId]["peerConnection"].setRemoteDescription(new RTCSessionDescription(message.payload));
    } else if (message.payload.type === 'candidate' && isStarted) {
      console.log('Client received message:', id, message.uniqueId, message.payload.type);
      var candidate = new RTCIceCandidate({
        sdpMLineIndex: message.payload.label,
        candidate: message.payload.candidate
      });
      const peerConnection = peerConnectionMap[message.uniqueId]["peerConnection"];
      peerConnection.addIceCandidate(candidate);
    }
  }
  if (message.payload.type === 'bye' && isStarted) {
    peerConnectionMap[message.uniqueId]["peerConnection"].close();
    delete peerConnectionMap[message.uniqueId];
    const childNodes = videosElement.childNodes;  
    for (let i = 1; i < childNodes.length; i++) {
      const uniqueIdAttributeValue = childNodes[i].getAttribute("data-attribute-uniqueid");
      if (message.uniqueId === uniqueIdAttributeValue) {
        videosElement.removeChild(childNodes[i]);
      }
    }
    handleRemoteHangup();
  }
});

////////////////////////////////////////////////////

navigator.mediaDevices.getUserMedia({
  audio: true,
  video: true
})
.then(gotStream)
.catch(function(e) {
  alert('getUserMedia() error: ' + e.name);
});

const getVideoElement = function(videoStream, type, message) {
  const containerElement = document.createElement("DIV");
  containerElement.className = "video-container";
  const videoElement = document.createElement("VIDEO");
  videoElement.setAttribute("autoplay", true);
  if (shouldMute) {
    videoElement.muted = true;
  }
  videoElement.className = "video";
  if (type === "remote") {
    videoElement.controls = true;
    videoElement.className = videoElement.className + " remote";
    videoElement.setAttribute("data-attribute-uniqueid", message.uniqueId);
    containerElement.setAttribute("data-attribute-uniqueid", message.uniqueId);
  }
  if (type === "local") {
    videoElement.muted = true;
    videoElement.setAttribute("data-attribute-uniqueid", id);
    containerElement.setAttribute("data-attribute-uniqueid", id);
  }
  videoElement.srcObject = videoStream;
  containerElement.appendChild(videoElement);

  if (type === "local") {
    //hangup button
    const buttonContainer = document.createElement("DIV");
    const hangupButton = document.createElement("BUTTON");
    hangupButton.innerText = "Hang up";
    hangupButton.onclick = function() {
      sendMessage({
        uniqueId: id,
        payload: {
          type: "bye"
        }
      });
      while(videosElement.childNodes.length > 1) {
        videosElement.removeChild(videosElement.lastElementChild);
      }
    };

    const toggleAudioButton  = document.createElement("BUTTON");
    toggleAudioButton.innerText = "Disable Audio";
    let audioEnabled = true;
    toggleAudioButton.onclick = function() {
      if (videoElement.srcObject) {
        const audioTracks = videoElement.srcObject.getAudioTracks();
        if (audioTracks) {
          audioTracks.forEach(function(audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
          });
          audioEnabled = !audioEnabled;
          if (audioEnabled) {
            toggleAudioButton.innerText = "Disable Audio";
          } else {
            toggleAudioButton.innerText = "Enable Audio";
          }
        } else {
          window.alert("Cannot toggle audio. No audio tracks found in local stream. Are you connected?");
        }
      } else {
        window.alert("Cannot toggle audio. No local audio stream found. Are you connected?");
      }
    };

    const toggleVideoButton  = document.createElement("BUTTON");
    toggleVideoButton.innerText = "Disable Video";
    let videoEnabled = true;
    toggleVideoButton.onclick = function() {
      if (videoElement.srcObject) {
        const videoTracks = videoElement.srcObject.getVideoTracks();
        if (videoTracks) {
          videoTracks.forEach(function(videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
          });
          videoEnabled = !videoEnabled;
          if (videoEnabled) {
            toggleVideoButton.innerText = "Disable Video";
          } else {
            toggleVideoButton.innerText = "Enable Video";
          }
        } else {
          window.alert("Cannot toggle video. No video tracks found in local stream. Are you connected?");
        }
      } else {
        window.alert("Cannot toggle video. No local video stream found. Are you connected?");
      }
    };

    buttonContainer.appendChild(hangupButton);
    buttonContainer.appendChild(toggleAudioButton);
    buttonContainer.appendChild(toggleVideoButton);
    containerElement.appendChild(buttonContainer);
  }
  return containerElement;
};

function gotStream(stream) {
  console.debug('Adding local stream.');
  localStream = stream;
  const elem = getVideoElement(stream, "local");
  videosElement.appendChild(elem);
  videoMetadataList.local.push({
    htmlElement: elem,
    stream: stream
  });

  sendMessage({
    uniqueId: id,
    payload: {
      type: "got user media"
    }
  });
}

console.debug('Getting user media with constraints', constraints);

function maybeStart(message) {
  console.log('creating peer connection');
  const peerConnection = createPeerConnection(message);
  if (peerConnection) {
      peerConnection.addStream(localStream);
      isStarted = true;
      if (message.payload.type === "got user media") {
        doCall(peerConnection, message);
      }
      return peerConnection;
    } else {
      console.log("failed to create a peer connection");
    }
  return null;
}

window.onbeforeunload = function() {
  sendMessage({
    uniqueId: id,
    payload: {
      type: "bye"
    }
  });
};

/////////////////////////////////////////////////////////

function createPeerConnection(message) {
  try {
    const peerConnection = new RTCPeerConnection(pcConfig);
    peerConnection.onicecandidate = handleIceCandidate(message);
    peerConnection.onicecandidateerror = function(event) {
        console.log("error icecandidateerror", event);
    }
    peerConnection.onaddstream = handleRemoteStreamAdded(message);
    peerConnection.onremovestream = handleRemoteStreamRemoved(message);
    console.log('Created RTCPeerConnnection');
    return peerConnection;
  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
    return null;
  }
}

function handleIceCandidate(message) {
  const func = function(event) {
    if (event.candidate) {
      sendMessage({
        uniqueId: id,
        toAddress: message.uniqueId,
        payload: {
          type: 'candidate',
          label: event.candidate.sdpMLineIndex,
          id: event.candidate.sdpMid,
          candidate: event.candidate.candidate
        }
      });
    } else {
      console.log('End of candidates.');
    }
  }
  return func;
}

function handleCreateOfferError(event) {
  console.log('createOffer() error: ', event);
}

function doCall(peerConnection, message) {
  console.log('Sending offer to peer');
  peerConnection.createOffer(setLocalAndSendMessage(peerConnection, message), handleCreateOfferError);
}

function doAnswer(peerConnection, message) {
  console.log('Sending answer to peer.');
  peerConnection.createAnswer().then(
    setLocalAndSendMessage(peerConnection, message),
    onCreateSessionDescriptionError
  );
}

function setLocalAndSendMessage(peerConnection, message) {
  const func = function(sessionDescription) {
    peerConnection.setLocalDescription(sessionDescription);
    console.log('setLocalAndSendMessage sending message', sessionDescription);
    sendMessage({
      uniqueId: id,
      toAddress: message.uniqueId,
      payload: sessionDescription
    });
  }
  return func;
}

function onCreateSessionDescriptionError(error) {
  console.log('Failed to create session description: ' + error.toString());
}

function handleRemoteStreamAdded(message) {
  const func = function(event) {
    console.log('Remote stream added.');
    const remoteStream = event.stream;
    const elem = getVideoElement(remoteStream, "remote", message);
    videosElement.appendChild(elem);
    videoMetadataList.remote.push({
      htmlElement: elem,
      stream: remoteStream
    });
  }
  return func;
}

function handleRemoteStreamRemoved(message) {
  const func = function(event) {
    console.log('Remote stream removed. Event: ', event);
  }
  return func;
}

function hangup() {
  console.log('Hanging up.');
  sendMessage({
    uniqueId: id,
    payload: {
      type: "bye"
    }
  });
}

function handleRemoteHangup() {
  console.log('Session terminated.');
}
