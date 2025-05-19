const { InstantConnectProxy } = require('prismarine-proxy')

const targetServer = "6b6t.org";
const targetPort = 25565;
const proxyPort = 25566;

const proxy = new InstantConnectProxy({
  loginHandler: (client) => {
    return { username: client.username, auth: 'offline' }
    //return client
  },
  clientOptions: {
    host: targetServer,
    port: targetPort,
    version: '1.21',
    auth: "offline"
    //auth: "microsoft"
  },
  serverOptions: {
    version: '1.21',
    port: proxyPort ,
    "online-mode": false
  }
})

proxy.on("incoming", (data, meta, toClient, toServer) => {
  console.log(data)
  toClient.write(meta.name, data)
});

proxy.on("outgoing", (data, meta, toClient, toServer) => {
  toServer.write(meta.name, data)
});

proxy.on("end", (username) => {
  console.log(`${username} ended`)
});

proxy.on("start", (username) => {
  console.log(`${username} started`)
});