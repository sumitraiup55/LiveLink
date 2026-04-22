import React, { useEffect, useRef, useState } from 'react'
import io from "socket.io-client";
import { Badge, IconButton, TextField, ToggleButton, ToggleButtonGroup, CircularProgress, Button, Tooltip, Snackbar } from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff'
import styles from "../styles/videoComponent.module.css";
import CallEndIcon from '@mui/icons-material/CallEnd'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare'
import ChatIcon from '@mui/icons-material/Chat'
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import server from '../environment';

const server_url = server;

var connections = {};

const peerConfigConnections = {
    "iceServers": [
        { "urls": "stun:stun.l.google.com:19302" }
    ]
}

export default function VideoMeetComponent() {

    var socketRef = useRef();
    let socketIdRef = useRef();

    let localVideoref = useRef();

    let [videoAvailable, setVideoAvailable] = useState(true);

    let [audioAvailable, setAudioAvailable] = useState(true);

    let [video, setVideo] = useState([]);

    let [audio, setAudio] = useState();

    let [screen, setScreen] = useState();

    let [showModal, setModal] = useState(true);

    let [screenAvailable, setScreenAvailable] = useState();

    let [messages, setMessages] = useState([])

    let [message, setMessage] = useState("");

    let [newMessages, setNewMessages] = useState(0);

    let [chatMode, setChatMode] = useState("room"); // room | ai
    let [aiMessages, setAiMessages] = useState([]);
    let [aiMessage, setAiMessage] = useState("");
    let [aiLoading, setAiLoading] = useState(false);
    const aiMessagesRef = useRef([]);

    const roomEndRef = useRef(null);
    const aiEndRef = useRef(null);

    const [toast, setToast] = useState("");

    let [askForUsername, setAskForUsername] = useState(true);

    let [username, setUsername] = useState("");

    const videoRef = useRef([])

    let [videos, setVideos] = useState([])

    // TODO
    // if(isChrome() === false) {


    // }

    useEffect(() => {
        getPermissions();
        // run once on mount (prevents rerender loop)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        aiMessagesRef.current = aiMessages;
    }, [aiMessages]);

    useEffect(() => {
        roomEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, showModal, chatMode]);

    useEffect(() => {
        aiEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [aiMessages, showModal, chatMode]);

    let getDislayMedia = () => {
        if (screen) {
            if (navigator.mediaDevices.getDisplayMedia) {
                navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
                    .then(getDislayMediaSuccess)
                    .then((stream) => { })
                    .catch((e) => console.log(e))
            }
        }
    }

    const getPermissions = async () => {
        try {
            const videoPermission = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoPermission) {
                setVideoAvailable(true);
                console.log('Video permission granted');
            } else {
                setVideoAvailable(false);
                console.log('Video permission denied');
            }

            const audioPermission = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (audioPermission) {
                setAudioAvailable(true);
                console.log('Audio permission granted');
            } else {
                setAudioAvailable(false);
                console.log('Audio permission denied');
            }

            if (navigator.mediaDevices.getDisplayMedia) {
                setScreenAvailable(true);
            } else {
                setScreenAvailable(false);
            }

            if (videoAvailable || audioAvailable) {
                const userMediaStream = await navigator.mediaDevices.getUserMedia({ video: videoAvailable, audio: audioAvailable });
                if (userMediaStream) {
                    window.localStream = userMediaStream;
                    if (localVideoref.current) {
                        localVideoref.current.srcObject = userMediaStream;
                    }
                }
            }
        } catch (error) {
            console.log(error);
        }
    };

    useEffect(() => {
        if (video !== undefined && audio !== undefined) {
            getUserMedia();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [video, audio])
    let getMedia = () => {
        setVideo(videoAvailable);
        setAudio(audioAvailable);
        connectToSocketServer();

    }




    let getUserMediaSuccess = (stream) => {
        try {
            window.localStream.getTracks().forEach(track => track.stop())
        } catch (e) { console.log(e) }

        window.localStream = stream
        localVideoref.current.srcObject = stream

        for (let id in connections) {
            if (id === socketIdRef.current) continue

            connections[id].addStream(window.localStream)

            connections[id].createOffer().then((description) => {
                console.log(description)
                connections[id].setLocalDescription(description)
                    .then(() => {
                        socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }))
                    })
                    .catch(e => console.log(e))
            })
        }

        stream.getTracks().forEach(track => track.onended = () => {
            setVideo(false);
            setAudio(false);

            try {
                let tracks = localVideoref.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            } catch (e) { console.log(e) }

            let blackSilence = (...args) => new MediaStream([black(...args), silence()])
            window.localStream = blackSilence()
            localVideoref.current.srcObject = window.localStream

            for (let id in connections) {
                connections[id].addStream(window.localStream)

                connections[id].createOffer().then((description) => {
                    connections[id].setLocalDescription(description)
                        .then(() => {
                            socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }))
                        })
                        .catch(e => console.log(e))
                })
            }
        })
    }

    let getUserMedia = () => {
        if ((video && videoAvailable) || (audio && audioAvailable)) {
            navigator.mediaDevices.getUserMedia({ video: video, audio: audio })
                .then(getUserMediaSuccess)
                .then((stream) => { })
                .catch((e) => console.log(e))
        } else {
            try {
                let tracks = localVideoref.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            } catch (e) { }
        }
    }





    let getDislayMediaSuccess = (stream) => {
        console.log("HERE")
        try {
            window.localStream.getTracks().forEach(track => track.stop())
        } catch (e) { console.log(e) }

        window.localStream = stream
        localVideoref.current.srcObject = stream

        for (let id in connections) {
            if (id === socketIdRef.current) continue

            connections[id].addStream(window.localStream)

            connections[id].createOffer().then((description) => {
                connections[id].setLocalDescription(description)
                    .then(() => {
                        socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }))
                    })
                    .catch(e => console.log(e))
            })
        }

        stream.getTracks().forEach(track => track.onended = () => {
            setScreen(false)

            try {
                let tracks = localVideoref.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            } catch (e) { console.log(e) }

            let blackSilence = (...args) => new MediaStream([black(...args), silence()])
            window.localStream = blackSilence()
            localVideoref.current.srcObject = window.localStream

            getUserMedia()

        })
    }

    let gotMessageFromServer = (fromId, message) => {
        var signal = JSON.parse(message)

        if (fromId !== socketIdRef.current) {
            if (signal.sdp) {
                connections[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(() => {
                    if (signal.sdp.type === 'offer') {
                        connections[fromId].createAnswer().then((description) => {
                            connections[fromId].setLocalDescription(description).then(() => {
                                socketRef.current.emit('signal', fromId, JSON.stringify({ 'sdp': connections[fromId].localDescription }))
                            }).catch(e => console.log(e))
                        }).catch(e => console.log(e))
                    }
                }).catch(e => console.log(e))
            }

            if (signal.ice) {
                connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice)).catch(e => console.log(e))
            }
        }
    }




    let connectToSocketServer = () => {
        const token = localStorage.getItem("token");
        socketRef.current = io.connect(server_url, {
            transports: ["websocket", "polling"],
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 500,
            reconnectionDelayMax: 2000,
            timeout: 10000,
            auth: {
                token: token || undefined,
                guestName: token ? undefined : (username || "Guest")
            }
        })

        socketRef.current.on('signal', gotMessageFromServer)

        socketRef.current.on('connect', () => {
            socketRef.current.emit('join-call', meetingCode)
            socketIdRef.current = socketRef.current.id

            socketRef.current.on('chat-message', addMessage)

            socketRef.current.on('join-error', (msg) => {
                setToast(String(msg || "Join failed"));
                window.location.href = "/";
            });

            socketRef.current.on('user-left', (id) => {
                setVideos((videos) => videos.filter((video) => video.socketId !== id))
            })

            socketRef.current.on('user-joined', (id, clients) => {
                clients.forEach((socketListId) => {

                    connections[socketListId] = new RTCPeerConnection(peerConfigConnections)
                    // Wait for their ice candidate       
                    connections[socketListId].onicecandidate = function (event) {
                        if (event.candidate != null) {
                            socketRef.current.emit('signal', socketListId, JSON.stringify({ 'ice': event.candidate }))
                        }
                    }

                    // Wait for their video stream
                    connections[socketListId].onaddstream = (event) => {
                        console.log("BEFORE:", videoRef.current);
                        console.log("FINDING ID: ", socketListId);

                        let videoExists = videoRef.current.find(video => video.socketId === socketListId);

                        if (videoExists) {
                            console.log("FOUND EXISTING");

                            // Update the stream of the existing video
                            setVideos(videos => {
                                const updatedVideos = videos.map(video =>
                                    video.socketId === socketListId ? { ...video, stream: event.stream } : video
                                );
                                videoRef.current = updatedVideos;
                                return updatedVideos;
                            });
                        } else {
                            // Create a new video
                            console.log("CREATING NEW");
                            let newVideo = {
                                socketId: socketListId,
                                stream: event.stream,
                                autoplay: true,
                                playsinline: true
                            };

                            setVideos(videos => {
                                const updatedVideos = [...videos, newVideo];
                                videoRef.current = updatedVideos;
                                return updatedVideos;
                            });
                        }
                    };


                    // Add the local video stream
                    if (window.localStream !== undefined && window.localStream !== null) {
                        connections[socketListId].addStream(window.localStream)
                    } else {
                        let blackSilence = (...args) => new MediaStream([black(...args), silence()])
                        window.localStream = blackSilence()
                        connections[socketListId].addStream(window.localStream)
                    }
                })

                if (id === socketIdRef.current) {
                    for (let id2 in connections) {
                        if (id2 === socketIdRef.current) continue

                        try {
                            connections[id2].addStream(window.localStream)
                        } catch (e) { }

                        connections[id2].createOffer().then((description) => {
                            connections[id2].setLocalDescription(description)
                                .then(() => {
                                    socketRef.current.emit('signal', id2, JSON.stringify({ 'sdp': connections[id2].localDescription }))
                                })
                                .catch(e => console.log(e))
                        })
                    }
                }
            })
        })
    }

    let silence = () => {
        let ctx = new AudioContext()
        let oscillator = ctx.createOscillator()
        let dst = oscillator.connect(ctx.createMediaStreamDestination())
        oscillator.start()
        ctx.resume()
        return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false })
    }
    let black = ({ width = 640, height = 480 } = {}) => {
        let canvas = Object.assign(document.createElement("canvas"), { width, height })
        canvas.getContext('2d').fillRect(0, 0, width, height)
        let stream = canvas.captureStream()
        return Object.assign(stream.getVideoTracks()[0], { enabled: false })
    }

    let handleVideo = () => {
        setVideo(!video);
        // getUserMedia();
    }
    let handleAudio = () => {
        setAudio(!audio)
        // getUserMedia();
    }

    useEffect(() => {
        if (screen !== undefined) {
            getDislayMedia();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [screen])
    let handleScreen = () => {
        setScreen(!screen);
    }

    let handleEndCall = () => {
        try {
            let tracks = localVideoref.current.srcObject.getTracks()
            tracks.forEach(track => track.stop())
        } catch (e) { }
        window.location.href = "/"
    }

    const addMessage = (data, sender, socketIdSender) => {
        setMessages((prevMessages) => [
            ...prevMessages,
            { sender: sender, data: data }
        ]);
        if (socketIdSender !== socketIdRef.current) {
            setNewMessages((prevNewMessages) => prevNewMessages + 1);
        }
    };



    let sendMessage = () => {
        const trimmed = message.trim();
        if (!trimmed) return;
        if (!socketRef.current) return;
        socketRef.current.emit('chat-message', trimmed, username)
        setMessage("");

        // this.setState({ message: "", sender: username })
    }

    const sendAiMessage = async () => {
        const trimmed = aiMessage.trim();
        if (!trimmed || aiLoading) return;

        const nextHistoryMessages = [...aiMessagesRef.current, { sender: username || "You", data: trimmed, role: "user" }];
        setAiMessages(nextHistoryMessages);
        setAiMessage("");
        setAiLoading(true);

        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${server_url}/api/v1/ai/chat`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    message: trimmed,
                    history: nextHistoryMessages
                        .slice(-10)
                        .map((m) => ({ role: m.role === "user" ? "user" : "model", text: m.data }))
                })
            });
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json?.message || "AI request failed");
            }
            setAiMessages((prev) => [...prev, { sender: "AI", data: json.reply, role: "model" }]);
        } catch (e) {
            setAiMessages((prev) => [...prev, { sender: "AI", data: `Error: ${e.message}`, role: "model" }]);
        } finally {
            setAiLoading(false);
        }
    }

    const meetingCode = (() => {
        const path = window.location.pathname || "";
        const code = path.startsWith("/") ? path.slice(1) : path;
        return code || "meeting";
    })();

    const participantsCount = 1 + (videos?.length || 0);

    const copyInviteLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setToast("Invite link copied");
        } catch {
            setToast("Copy failed");
        }
    };

    
    let connect = () => {
        setAskForUsername(false);
        getMedia();
    }


    return (
        <div>

            {askForUsername === true ?

                <div>


                    <h2>Enter into Lobby </h2>
                    <TextField id="outlined-basic" label="Username" value={username} onChange={e => setUsername(e.target.value)} variant="outlined" />
                    <Button variant="contained" onClick={connect}>Connect</Button>


                    <div>
                        <video ref={localVideoref} autoPlay muted></video>
                    </div>

                </div> :


                <div className={styles.meetVideoContainer}>
                    <div className={styles.topBar}>
                        <div className={styles.brand}>
                            <div style={{ fontWeight: 900, fontSize: "1.1rem" }}>LiveLink</div>
                            <div className={styles.meetingMeta}>
                                Code: <span style={{ color: "white" }}>{meetingCode}</span> · Participants:{" "}
                                <span style={{ color: "white" }}>{participantsCount}</span>
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                            <Tooltip title="Copy invite link">
                                <IconButton onClick={copyInviteLink} style={{ color: "white" }}>
                                    <ContentCopyIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title={showModal ? "Hide chat" : "Show chat"}>
                                <Badge badgeContent={newMessages} max={999} color='orange'>
                                    <IconButton onClick={() => {
                                        setModal((v) => !v);
                                        setNewMessages(0);
                                    }} style={{ color: "white" }}>
                                        <ChatIcon />
                                    </IconButton>
                                </Badge>
                            </Tooltip>
                        </div>
                    </div>

                    <div className={styles.layoutMain}>
                        <div className={styles.stage}>
                            <div className={styles.conferenceView}>
                                {videos.map((video) => (
                                    <div key={video.socketId}>
                                        <video
                                            data-socket={video.socketId}
                                            ref={ref => {
                                                if (ref && video.stream) {
                                                    ref.srcObject = video.stream;
                                                }
                                            }}
                                            autoPlay
                                            playsInline
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className={styles.localPip}>
                                <video ref={localVideoref} autoPlay muted playsInline />
                            </div>
                        </div>

                        {showModal ? (
                            <div className={styles.chatPanel}>
                                <div className={styles.chatHeader}>
                                    <div className={styles.chatTitleRow}>
                                        <div style={{ fontWeight: 900 }}>Chat</div>
                                        <ToggleButtonGroup
                                            exclusive
                                            value={chatMode}
                                            onChange={(e, v) => v && setChatMode(v)}
                                            size="small"
                                        >
                                            <ToggleButton value="room">Room</ToggleButton>
                                            <ToggleButton value="ai">AI</ToggleButton>
                                        </ToggleButtonGroup>
                                    </div>
                                    <div style={{ fontSize: "0.85rem", opacity: 0.75 }}>
                                        {chatMode === "ai" ? "Private Gemini chat (only you can see it)" : "Room chat (everyone in meeting)"}
                                    </div>
                                </div>

                                <div className={styles.chattingDisplay}>
                                    {chatMode === "room" ? (
                                        messages.length !== 0 ? messages.map((item, index) => {
                                            const isMe = item.sender === username;
                                            return (
                                                <div className={styles.msgRow} key={index}>
                                                    <div className={`${styles.msgBubble} ${isMe ? styles.msgBubbleMe : ""}`}>
                                                        <div className={styles.msgSender}>{item.sender}</div>
                                                        <div style={{ whiteSpace: "pre-wrap" }}>{item.data}</div>
                                                    </div>
                                                </div>
                                            );
                                        }) : <div style={{ opacity: 0.75 }}>No messages yet</div>
                                    ) : (
                                        aiMessages.length !== 0 ? aiMessages.map((item, index) => {
                                            const isMe = item.role === "user";
                                            return (
                                                <div className={styles.msgRow} key={index}>
                                                    <div className={`${styles.msgBubble} ${isMe ? styles.msgBubbleMe : ""}`}>
                                                        <div className={styles.msgSender}>{item.sender}</div>
                                                        <div style={{ whiteSpace: "pre-wrap" }}>{item.data}</div>
                                                    </div>
                                                </div>
                                            );
                                        }) : <div style={{ opacity: 0.75 }}>Ask the AI anything (private)</div>
                                    )}
                                    <div ref={chatMode === "room" ? roomEndRef : aiEndRef} />
                                </div>

                                <div className={styles.chattingArea}>
                                    {chatMode === "room" ? (
                                        <>
                                            <TextField
                                                value={message}
                                                onChange={(e) => setMessage(e.target.value)}
                                                id="outlined-basic"
                                                label="Message"
                                                variant="outlined"
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") sendMessage();
                                                }}
                                            />
                                            <Button variant='contained' onClick={sendMessage}>Send</Button>
                                        </>
                                    ) : (
                                        <>
                                            <TextField
                                                value={aiMessage}
                                                onChange={(e) => setAiMessage(e.target.value)}
                                                id="outlined-ai"
                                                label="Ask AI"
                                                variant="outlined"
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") sendAiMessage();
                                                }}
                                            />
                                            <Button variant='contained' onClick={sendAiMessage} disabled={aiLoading}>
                                                {aiLoading ? <CircularProgress size={18} /> : "Send"}
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ) : null}
                    </div>


                    <div className={styles.buttonContainers}>
                        <Tooltip title={video === true ? "Turn camera off" : "Turn camera on"}>
                        <IconButton onClick={handleVideo} style={{ color: "white" }}>
                            {(video === true) ? <VideocamIcon /> : <VideocamOffIcon />}
                        </IconButton>
                        </Tooltip>
                        <Tooltip title="Leave call">
                        <IconButton onClick={handleEndCall} style={{ color: "red" }}>
                            <CallEndIcon  />
                        </IconButton>
                        </Tooltip>
                        <Tooltip title={audio === true ? "Mute" : "Unmute"}>
                        <IconButton onClick={handleAudio} style={{ color: "white" }}>
                            {audio === true ? <MicIcon /> : <MicOffIcon />}
                        </IconButton>
                        </Tooltip>

                        {screenAvailable === true ?
                            <Tooltip title={screen === true ? "Stop share" : "Share screen"}>
                                <IconButton onClick={handleScreen} style={{ color: "white" }}>
                                    {screen === true ? <StopScreenShareIcon /> : <ScreenShareIcon />}
                                </IconButton>
                            </Tooltip> : <></>}

                    </div>

                    <Snackbar
                        open={!!toast}
                        autoHideDuration={2000}
                        message={toast}
                        onClose={() => setToast("")}
                    />

                </div>

            }

        </div>
    )
}
