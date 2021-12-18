//Defining some global utility variables
var isChannelReady = false;
var isInitiator = false;
var isStarted = false;
var pc;
var turnReady;
var datachannel;
var clientName = "user" + Math.floor(Math.random() * 1000 + 1);
var remoteclient;

document.getElementById("yourname").innerHTML="You: "+clientName

//Initialize turn/stun server here
//turnconfig will be defined in public/js/config.js
var pcConfig = turnConfig;

// Prompting for room name:
// var room = prompt('Enter room name:');
//setting test room
var room = "test";

//Initializing socket.io
var socket = io.connect();

//Ask server to add in the room if room name is provided by the user
if (room !== "") {
  // socket.emit('create or join', room);
  // console.log('Attempted to create or  join room', room);
}

//Defining socket events

//Event - Client has created the room i.e. is the first member of the room
socket.on("created", function (room) {
  console.log("Created room " + room);
  isInitiator = true;
});

//Event - Room is full
socket.on("full", function (room) {
  console.log("Room " + room + " is full");
});

//Event - Another client tries to join room
//this message is received only by the client that connected first
//when the second peer is connected
socket.on("join", function (room, client) {
  console.log(
    "Another peer made a request to join room " +
      room +
      " whith name :" +
      client
  );
  console.log("This peer is the initiator of room " + room + "!");
  sendmessagebutton.disabled = false;
  isChannelReady = true;
  remoteclient = client;
  document.getElementById("remotename").innerHTML=client
  socket.emit("creatorname", room, clientName);
});

socket.on("mynameis", (client) => {
  console.log("The creator's name is " + client);
  remoteclient = client;
  document.getElementById("remotename").innerHTML=client
});

//Event - Client has joined the room
//this message is received only by the client that connected second
socket.on("joined", function (room) {
  console.log("joined: " + room);
  isChannelReady = true;
  sendmessagebutton.disabled = false;
});

//Event - server asks to log a message
socket.on("log", function (array) {
  console.log.apply(console, array);
});

//Event - for sending meta for establishing a direct connection using WebRTC
//The Driver code
socket.on("message", function (message, room) {
  console.log("Client received message:", message, room);
  if (message === "gotuser") {
    maybeStart();
  } else if (message.type === "offer") {
    if (!isInitiator && !isStarted) {
      maybeStart();
    }
    pc.setRemoteDescription(new RTCSessionDescription(message));
    doAnswer();
  } else if (message.type === "answer" && isStarted) {
    pc.setRemoteDescription(new RTCSessionDescription(message));
  } else if (message.type === "candidate" && isStarted) {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate,
    });
    pc.addIceCandidate(candidate);
  } else if (message === "bye" && isStarted) {
    handleRemoteHangup();
  }
});

//Function to send message in a room
function sendMessage(message, room) {
  console.log("Client sending message: ", message, room);
  socket.emit("message", message, room);
}

//If initiator, create the peer connection
function maybeStart() {
  console.log(">>>>>>> maybeStart() ", isStarted, isChannelReady);
  if (!isStarted && isChannelReady) {
    console.log(">>>>>> creating peer connection");
    createPeerConnection();
    isStarted = true;
    console.log("isInitiator", isInitiator);
    if (isInitiator) {
      doCall();
    }
  }
}

//Sending bye if user closes the window
window.onbeforeunload = function () {
  sendMessage("bye", room);
};
var datachannel;
//Creating peer connection
function createPeerConnection() {
  try {
    pc = new RTCPeerConnection(pcConfig);
    pc.onicecandidate = handleIceCandidate;
    console.log("Created RTCPeerConnnection");

    // Offerer side
    datachannel = pc.createDataChannel("filetransfer");
    datachannel.onopen = (event) => {
      //datachannel.send("oferer sent:THIS")
    };

    datachannel.onmessage = (event) => {
      console.log("The oferrer received a message" + event.data);
    };
    datachannel.onerror = (error) => {
      //console.log("Data Channel Error:", error);
    };

    datachannel.onclose = () => {
      //console.log("Data Channel closed");
    };

    // Answerer side
    pc.ondatachannel = function (event) {
      var channel = event.channel;
      channel.onopen = function (event) {
        channel.send("ANSWEREROPEN");
      };
      channel.onmessage = async (event) => {
        try {
          var themessage = event.data;
          console.log(themessage, event);
          viewmsgtoelement(document.getElementById("messagesent"), themessage);
        } catch (err) {
          console.log(err);
        }
      };
    };
  } catch (e) {
    console.log("Failed to create PeerConnection, exception: " + e.message);
    alert("Cannot create RTCPeerConnection object.");
    return;
  }
}

//Function to handle Ice candidates generated by the browser
function handleIceCandidate(event) {
  console.log("icecandidate event: ", event);
  if (event.candidate) {
    sendMessage(
      {
        type: "candidate",
        label: event.candidate.sdpMLineIndex,
        id: event.candidate.sdpMid,
        candidate: event.candidate.candidate,
      },
      room
    );
  } else {
    console.log("End of candidates.");
  }
}

function handleCreateOfferError(event) {
  console.log("createOffer() error: ", event);
}

//Function to create offer
function doCall() {
  console.log("Sending offer to peer");
  pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}

//Function to create answer for the received offer
function doAnswer() {
  console.log("Sending answer to peer.");
  pc.createAnswer().then(
    setLocalAndSendMessage,
    onCreateSessionDescriptionError
  );
}

//Function to set description of local media
function setLocalAndSendMessage(sessionDescription) {
  pc.setLocalDescription(sessionDescription);
  console.log("setLocalAndSendMessage sending message", sessionDescription);
  sendMessage(sessionDescription, room);
}

function onCreateSessionDescriptionError(error) {
  trace("Failed to create session description: " + error.toString());
}

function hangup() {
  console.log("Hanging up.");
  stop();
  sendMessage("bye", room);
}

function handleRemoteHangup() {
  console.log("Session terminated.");
  stop();
  isInitiator = false;
}

function stop() {
  isStarted = false;
  pc.close();
  pc = null;
}

var connectbutton = document.getElementById("connectbutton");
if (connectbutton) {
  connectbutton.addEventListener("click", () => {
    if (connectbutton.innerHTML !== "Connected") {
      socket.emit("create or join", room, clientName);
      sendMessage("gotuser", room);
      if (isInitiator) {
        maybeStart();
      }
    }
    connectbutton.innerHTML = "Connected";
    //connection logic
  });
}

let messagetexted = "";
//DOM elements

var messageinput = document.getElementById("messagearea");
if (messageinput) {
  //Tip: This event is similar to the onchange event.
  //The difference is that the oninput event occurs immediately
  // after the value of an element has changed, while onchange occurs
  //when the element loses focus, after the content has been changed.
  //The other difference is that the onchange event also works on <select> elements.
  messageinput.addEventListener("input", (event) => {
    console.log(event.target.value);
    messagetexted = event.target.value;
  });
}

var sendmessagebutton = document.getElementById("sendmessage");
if (sendmessagebutton) {
  sendmessagebutton.disabled = true;
  sendmessagebutton.addEventListener("click", () => {
    var themessage = "<p>" + clientName + ":" + messagetexted + "</p>";
    viewmsgtoelement(document.getElementById("messagesent"), themessage);
    datachannel.send(themessage);
    messageinput.value = "";
    messagetexted = "";
  });
}

function viewmsgtoelement(element, message) {
  element.innerHTML += "\n" + message;
}
