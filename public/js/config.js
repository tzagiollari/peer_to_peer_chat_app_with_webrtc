const turnConfig = {
    iceServers: [
      { urls: ["stun:fr-turn1.xirsys.com"] },
      {
        username:
          "Wj3dtFyTovJl_655q7_9Y-Uy_DTma3qU6uTZmdAqUvb0TiOcYH295GlvO4exr4KnAAAAAGGYE3dlbmVhc2xhcmk=",
        credential: "8a1494e0-497d-11ec-9fcf-0242ac120004",
        urls: [
          "turn:fr-turn1.xirsys.com:80?transport=udp",
          "turn:fr-turn1.xirsys.com:3478?transport=udp",
          "turn:fr-turn1.xirsys.com:80?transport=tcp",
          "turn:fr-turn1.xirsys.com:3478?transport=tcp",
          "turns:fr-turn1.xirsys.com:443?transport=tcp",
          "turns:fr-turn1.xirsys.com:5349?transport=tcp",
        ],
      },
    ],
  };
  