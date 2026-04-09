import express from "express";
import Docker from "dockerode";
import http from "http";
import httpProxy from "http-proxy";

const proxy = httpProxy.createProxy();

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

const db = new Map();

docker.getEvents((err, stream) => {
  if (err) {
    console.log("Error in getting events:", err);
    return;
  }
  stream.on("data", async (chunk) => {
    if (!chunk) return;
    try {
      const event = JSON.parse(chunk.toString());
      if (event.Type === "container" && event.Action === "start") {
        const containerId = event.Actor?.ID;
        if (!containerId) return;
        const container = docker.getContainer(containerId);
        const containerInfo = await container.inspect();
        const containerName = containerInfo.Name.substring(1);
        const networks = containerInfo.NetworkSettings.Networks;
        const ipAddress = Object.values(networks)[0].IPAddress;
        const exposedPort = Object.keys(containerInfo.Config.ExposedPorts);
        let defaultPort = null;
        if (exposedPort && exposedPort.length > 0) {
          const [port, protocol] = exposedPort[0].split("/");
          if (protocol === "tcp") {
            defaultPort = port;
          }
        }
        const hostUrl = `http://${containerName}.localhost`;
        const targetUrl = `http://${ipAddress}:${defaultPort}`;
        console.log(`Container ${hostUrl} mapped to ${targetUrl}`);
        db.set(containerName, { ipAddress, defaultPort });
      }
    } catch (error) {
      console.log("Error in processing docker event:", error);
    }
  });
});

//Proxy Server
const proxyApp = express();

const proxyServer = http.createServer(proxyApp);

// http://apple.localhost
proxyApp.use((req, res) => {
  const hostname = req.hostname;
// TODO FIX: const subdomain = hostname?.split(".")[0];
  const subdomain = hostname.split(".")[0];
  if (!db.has(subdomain)) return res.status(404).end("Not found");
  const { ipAddress, defaultPort } = db.get(subdomain);
  const targetUrl = `http://${ipAddress}:${defaultPort}`;
  const proxyOptions = {
    target: targetUrl,
    changeOrigin: true,
    ws: true,
  };
  proxy.web(req, res, proxyOptions);
});

proxyServer.on("upgrade", (req, socket, head) => {
  // TODO FIX: const hostname = req.headers.host
  const hostname = req.hostname;
// TODO FIX: const subdomain = hostname?.split(".")[0];
  const subdomain = hostname.split(".")[0];
  if (!db.has(subdomain)){
    socket.destroy();
    return;
  }
  const { ipAddress, defaultPort } = db.get(subdomain);
  const targetUrl = `http://${ipAddress}:${defaultPort}`;
  const proxyOptions = {
    target: targetUrl,
    ws: true,
  };
  // TODO FIX:  return proxy.ws(req,socker,head,proxyOptions)
  proxy.ws(req, socket, proxyOptions);
});

proxyServer.listen(80, () => {
  console.log("Proxy Server running on port 80");
});

// Reverse Proxy Management API
const managementApi = express();

managementApi.use(express.json());

managementApi.get("/", (_, res) => {
  res.json({ message: "Welcome to mangement Api" });
});

managementApi.post("/containers", async (req, res) => {
  const { image, tag = "latest" } = req.body;
  const fullImage = `${image}:${tag}`;
  const images = await docker.listImages();

// TODO FIX: let imageAlreadyExists = false;
  const imageAlreadyExists = false;

  for (const systemImage of images) {
    if (systemImage.RepoTags && systemImage.RepoTags.includes(fullImage)) {
      imageAlreadyExists = true;
      break;
    }
  }
  if (!imageAlreadyExists) {
    console.log("Pulling Image:", fullImage);
    const stream = await docker.pull(fullImage);
    await new Promise((resolve, reject) => {
      docker.modem.followProgress(stream, (err, output) => {
        if (err) return reject(err);
        console.log(`Image ${fullImage} pulled successfully`);
        resolve(output);
      });
    });
  }
  const container = await docker.createContainer({
    Image: fullImage,
    Tty: false,
    HostConfig: {
      AutoRemove: true,
    },
  });
  await container.start();
  const containerName = (await container.inspect()).Name.slice(1);
  res.json({
    message: "Container started successfully",
    id: container.id,
    name: containerName,
    url: `http://${containerName}.localhost`,
  });
});

managementApi.listen(8080, () => {
  console.log("Mangement API running on port 8080");
});
