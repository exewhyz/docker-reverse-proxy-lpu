import express from "express";
import Docker from "dockerode";

const docker = new Docker({ socketPath : "/var/run/docker.sock" });

const managementApi = express();

managementApi.use(express.json());

managementApi.get("/",(_,res)=>{
    res.json({ message : "Welcome to mangement Api"})
});

managementApi.post("/containers",async (req,res)=>{
    const { image, tag = "latest" } = req.body;
    const fullImage = `${image}:${tag}`;
    const images = await docker.listImages();

    const imageAlreadyExists = false;

    for(const systemImage of images){
        if(systemImage.RepoTags && systemImage.RepoTags.includes(fullImage)){
            imageAlreadyExists = true;
            break;
        }
    }
    if(!imageAlreadyExists){
        console.log("Pulling Image:", fullImage)
        const stream = await docker.pull(fullImage);
        await new Promise((resolve,reject)=>{
            docker.modem.followProgress(stream, (err,output)=>{
                if(err) return reject(err);
                console.log(`Image ${fullImage} pulled successfully`);
                resolve(output);
            })
        })
    }
    const container = await docker.createContainer({
        Image: fullImage,
        Tty: false,
        HostConfig: {
            AutoRemove : true
        }
    })
    await container.start();
    const containerName = (await container.inspect()).Name.slice(1);
    res.json({
        message : "",
        id : container.id,
        name : containerName,
        url: `http://${containerName}.localhost`
    })
});

managementApi.listen(8080, ()=>{
    console.log("Mangement API running on port 8080");
});