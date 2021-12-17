//Defining some global utility variables
var isChannelReady = false;
var isInitiator = false;
var isStarted = false;
var pc;
var turnReady;
var datachannel;

//Initialize turn/stun server here
//turnconfig will be defined in public/js/config.js
var pcConfig = turnConfig;


// Prompting for room name:
var room = prompt('Enter room name:');

//Initializing socket.io
var socket = io.connect();

//Ask server to add in the room if room name is provided by the user
if (room !== '') {
    // socket.emit('create or join', room);
    // console.log('Attempted to create or  join room', room);
}

//Defining socket events

//Event - Client has created the room i.e. is the first member of the room
socket.on('created', function (room) {
    console.log('Created room ' + room);
    isInitiator = true;
});

//Event - Room is full
socket.on('full', function (room) {
    console.log('Room ' + room + ' is full');
});

//Event - Another client tries to join room
socket.on('join', function (room) {
    console.log('Another peer made a request to join room ' + room);
    console.log('This peer is the initiator of room ' + room + '!');
    isChannelReady = true;
});

//Event - Client has joined the room
socket.on('joined', function (room) {
    console.log('joined: ' + room);
    isChannelReady = true;
});

//Event - server asks to log a message
socket.on('log', function (array) {
    console.log.apply(console, array);
});


//Event - for sending meta for establishing a direct connection using WebRTC
//The Driver code
socket.on('message', function (message, room) {
    console.log('Client received message:', message, room);
    if (message === 'gotuser') {
        maybeStart();
    } else if (message.type === 'offer') {
        if (!isInitiator && !isStarted) {
            maybeStart();
        }
        pc.setRemoteDescription(new RTCSessionDescription(message));
        doAnswer();
    } else if (message.type === 'answer' && isStarted) {
        pc.setRemoteDescription(new RTCSessionDescription(message));
    } else if (message.type === 'candidate' && isStarted) {
        var candidate = new RTCIceCandidate({
            sdpMLineIndex: message.label,
            candidate: message.candidate
        });
        pc.addIceCandidate(candidate);
    } else if (message === 'bye' && isStarted) {
        handleRemoteHangup();
    }
});



//Function to send message in a room
function sendMessage(message, room) {
    console.log('Client sending message: ', message, room);
    socket.emit('message', message, room);
}



//If initiator, create the peer connection
function maybeStart() {
    console.log('>>>>>>> maybeStart() ', isStarted, isChannelReady);
    if (!isStarted && isChannelReady) {
        console.log('>>>>>> creating peer connection');
        createPeerConnection();
        isStarted = true;
        console.log('isInitiator', isInitiator);
        if (isInitiator) {
            doCall();
        }
    }
}

//Sending bye if user closes the window
window.onbeforeunload = function () {
    sendMessage('bye', room);
};
var datachannel
//Creating peer connection
function createPeerConnection() {
    try {
        pc = new RTCPeerConnection(pcConfig);
        pc.onicecandidate = handleIceCandidate;
        console.log('Created RTCPeerConnnection');

        // Offerer side
        datachannel = pc.createDataChannel("filetransfer");
        datachannel.onopen =  (event) => {
            datachannel.send("oferer sent:THIS")
        };

        datachannel.onmessage =  (event)=> {
            console.log("The oferrer received a message"+event.data);
        }
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
                channel.send('ANSWEREROPEN');
            }

            const receivedBuffers = [];
            channel.onmessage = async (event) => {
                console.log("The Answerrer received a message"+event.data);
                const { data } = event;
                try {
                    if (data !== END_OF_FILE_MESSAGE) {
                        receivedBuffers.push(data);
                    } else {
                        const arrayBuffer = receivedBuffers.reduce((acc, arrayBuffer) => {
                            const tmp = new Uint8Array(acc.byteLength + arrayBuffer.byteLength);
                            tmp.set(new Uint8Array(acc), 0);
                            tmp.set(new Uint8Array(arrayBuffer), acc.byteLength);
                            return tmp;
                        }, new Uint8Array());
                        const blob = new Blob([arrayBuffer]);
                        channel.send("THE FILE IS READYYY")
                        downloadFile(blob, channel.label);
                        channel.close();
                    }
                } catch (err) {
                    console.log('File transfer failed');
                }
            };
        };
    } catch (e) {
        console.log('Failed to create PeerConnection, exception: ' + e.message);
        alert('Cannot create RTCPeerConnection object.');
        return;
    }
}

//Function to handle Ice candidates generated by the browser
function handleIceCandidate(event) {
    console.log('icecandidate event: ', event);
    if (event.candidate) {
        sendMessage({
            type: 'candidate',
            label: event.candidate.sdpMLineIndex,
            id: event.candidate.sdpMid,
            candidate: event.candidate.candidate
        }, room);
    } else {
        console.log('End of candidates.');
    }
}

function handleCreateOfferError(event) {
    console.log('createOffer() error: ', event);
}

//Function to create offer
function doCall() {
    console.log('Sending offer to peer');
    pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}

//Function to create answer for the received offer
function doAnswer() {
    console.log('Sending answer to peer.');
    pc.createAnswer().then(
        setLocalAndSendMessage,
        onCreateSessionDescriptionError
    );
}

//Function to set description of local media
function setLocalAndSendMessage(sessionDescription) {
    pc.setLocalDescription(sessionDescription);
    console.log('setLocalAndSendMessage sending message', sessionDescription);
    sendMessage(sessionDescription, room);
}

function onCreateSessionDescriptionError(error) {
    trace('Failed to create session description: ' + error.toString());
}


function hangup() {
    console.log('Hanging up.');
    stop();
    sendMessage('bye', room);
}

function handleRemoteHangup() {
    console.log('Session terminated.');
    stop();
    isInitiator = false;
}

function stop() {
    isStarted = false;
    pc.close();
    pc = null;
}


var connectbutton = document.getElementById("connectbutton")
if (connectbutton) {
    connectbutton.addEventListener("click", () => {
        if (connectbutton.innerHTML !== "Connected") {
            socket.emit("create or join", room);
            sendMessage("gotuser", room);
            if (isInitiator) {
                maybeStart();
            }
        }
        connectbutton.innerHTML = "Connected";
        //connection logic
    })
}

let file;
//DOM elements
var fileInput = document.getElementById("inputfile");
fileInput.addEventListener("change", (event) => {
    file = event.target.files[0];
})
var sharefilebutton = document.getElementById("sharefile")
sharefilebutton.addEventListener("click", () => {
    shareFile()
})

const MAXIMUM_MESSAGE_SIZE = 65535;
const END_OF_FILE_MESSAGE = 'EOF';

const shareFile = async () => {
    console.log("Share file")
    if (file) {
        const arrayBuffer = await file.arrayBuffer();
        console.log(arrayBuffer)
        for (let i = 0; i < arrayBuffer.byteLength; i += MAXIMUM_MESSAGE_SIZE) {
            datachannel.send(arrayBuffer.slice(i, i + MAXIMUM_MESSAGE_SIZE));
        }
        datachannel.send(END_OF_FILE_MESSAGE);
    }
};

const downloadFile = (blob, fileName) => {
    const a = document.createElement('a');
    const url = window.URL.createObjectURL(blob);
    a.href = url;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove()
};
