const { execSync } = require("child_process");
const Docker = require("dockerode");
const core = require("@actions/core");
const fs = require("fs");
const path = require("path");

const exit = (msg) => {
    console.error(msg);
    process.exit(1);
};

const getPlatform = () => {
    switch (process.platform) {
        case "darwin":
            return "mac";
        case "win32":
            return "windows";
        default:
            return "linux";
    }
};

const verbose = core.getInput("verbose") === "true";

function log(msg) {
    if (verbose) {
        console.log(msg);
    }
}

function run() {
    try {
        // Determina la piattaforma corrente
        const currentPlatform = getPlatform();
        log(`Current platform: ${currentPlatform}`);

        // Configura Docker in base alla piattaforma
        let dockerParam = {};
        if (currentPlatform === "windows") {
            dockerParam = { host: "127.0.0.1", port: 2375 };
        } else if (currentPlatform === "linux") {
            dockerParam = { socketPath: "/var/run/docker.sock" };
        } else {
            exit(`The operating system is ${currentPlatform}.`);
        }

        const docker = new Docker(dockerParam);
        log(`Docker parameters: ${JSON.stringify(dockerParam)}`);

        // Ottieni parametri dagli input di GitHub Action
        const username = core.getInput("username", { required: true });
        const password = core.getInput("password", { required: true });
        const contextPath = core.getInput("path") || '.';
        log(`Context path: ${contextPath}`);

        // Leggi le configurazioni dagli input di GitHub Actions
        const registry = core.getInput("registry", { required: true });
        const npm_token = core.getInput("npm_token", { required: false });
        const owner = core.getInput("owner", { required: true });

        const argToken = npm_token ? `--build-arg NPM_TOKEN=${npm_token}` : '';

        log(`Registry: ${registry}`);
        log(`npm_token: ${argToken}`);
        log(`Owner: ${owner}`);

        // Controlla se esiste package.json
        const packagePath = path.join(contextPath, "package.json");
        if (!fs.existsSync(packagePath)) {
            exit(`package.json not found in path: ${contextPath}`);
        }
        const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
        log(`package.json content: ${JSON.stringify(packageJson)}`);

        // Controlla se esiste Dockerfile
        const dockerfilePath = path.join(contextPath, "Dockerfile");
        if (!fs.existsSync(dockerfilePath)) {
            exit(`Dockerfile not found in path: ${contextPath}`);
        }

        // Controlla se esiste build-info.json
        const buildInfoPath = path.join(contextPath, "build-info.json");
        let buildInfo = { buildNumber: 0 };
        if (fs.existsSync(buildInfoPath)) {
            buildInfo = JSON.parse(fs.readFileSync(buildInfoPath, "utf8"));
        }
        log(`build-info.json content: ${JSON.stringify(buildInfo)}`);

        const imageName = packageJson.name;
        const repoName = owner;
        const tagVersion = `${packageJson.version}-${buildInfo.buildNumber}`;
        const imageNameVersion = `${imageName}:${tagVersion}`;
        const fullImageName = `${registry}/${repoName}/${imageNameVersion}`;
        const fullImageNameLatest = `${registry}/${repoName}/${imageName}:latest`;
        log(`Image details: ${fullImageName}, ${fullImageNameLatest}`);

        // Configurazione per l'autenticazione al registro Docker
        const authConfig = { 
            username: username,
            password: password,
            serveraddress: registry
        };
        log(`Auth configuration: ${JSON.stringify(authConfig)}`);

        // Funzioni per costruire, taggare e pushare l'immagine
        function buildAndPushImage() {
            const image = docker.getImage(fullImageNameLatest);
            log(`Retrieved image: ${fullImageNameLatest}`);

            try {
                image.tag({ repo: `${registry}/${repoName}/${imageName}`, tag: tagVersion });
                log(`Tagged image: ${fullImageNameLatest} with ${tagVersion}`);
            } catch (error) {
                exit(`Error tagging image: ${error.message}`);
            }

            try {
                pushImage(fullImageNameLatest);
                pushImage(fullImageName);
            } catch (error) {
                exit(`Error pushing image: ${error.message}`);
            }
        }

        // Funzione per eseguire un comando shell e gestire output ed errori
        function executeCommand(command) {
            try {
                log(`Executing command: ${command}`);
                const output = execSync(command, { stdio: 'inherit' });
                log(`Output: ${output}`);
            } catch (error) {
                exit(`Error executing command: ${error.message}`);
            }
        }

        function pushImage(tag) {
            const image = docker.getImage(tag);
            log(`Pushing image: ${tag}`);

            image.push({ authconfig: authConfig }, (err, stream) => {
                if (err) {
                    exit(`Error pushing image: ${err.message}`);
                }

                if (verbose) {
                    stream.pipe(process.stdout);
                }

                stream.on("end", () => {
                    log(`Successfully pushed: ${tag}`);
                });

                stream.on("error", (error) => {
                    exit(`Error pushing image: ${error.message}`);
                });
            });
        }

        // Esegui i passaggi
        try {
            executeCommand(`docker buildx build -t ${fullImageNameLatest} ${argToken} "${contextPath}"`);
        } catch (error) {
            exit("Failed to complete docker operations.");
        }
        buildAndPushImage();
    } catch (error) {
        exit(`Error: ${error.message}`);
    }
}

run();
