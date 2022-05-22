const config = require("config");
const timeCode = require("./utils/time");
const http = require("http");
const incomingWebhook = require("@slack/webhook").IncomingWebhook;
const gitlabHandler = require("./handlers/gitlab");
const bitbucketHandler = require("./handlers/bitbucket");

console.log(timeCode(), "Process started");

if (!config.has("port")) {
    console.error(timeCode(), "No port specified in configuration file!");
    process.exit(1);
}

if (!config.has("handlers")) {
    console.error(timeCode(), "No hanlders specified in configuration file!");
    process.exit(1);
}

let handlers = {};

if (config.has("handlers.gitlab")) {
    handlers.gitlab = gitlabHandler(config.get("handlers.gitlab"), (msg) => {
        sendSlackMessage(msg);
    });
}

if (config.has("handlers.bitbucket")) {
    handlers.bitbucket = bitbucketHandler(config.get("handlers.bitbucket"), (msg) => {
        sendSlackMessage(msg);
    });
}

const slackSender = (() => {
    if (config.has("slack.webhook_url")) {
        let defaults = config.has("slack.defaults") ? config.get("slack.defaults") : {};
        return new incomingWebhook(config.get("slack.webhook_url"), defaults);
    } else {
        return undefined;
    }
})();

const server = http.createServer().listen(config.get("port"));

server.on("request", (request, response) => {
    let body = [];
    request.on('data', (chunk) => {
        body.push(chunk);
    }).on('end', () => {
        body = Buffer.concat(body).toString();
        try {
            switch (request.url.split("/")[1]) {
                case "gitlab":
                    handlers.gitlab(request, body, (status, msg) => {
                        sendHttpResponse(response, status, msg);
                    });
                    break;
                
                case "bitbucket":
                    handlers.bitbucket(request, body, (status, msg) => {
                        sendHttpResponse(response, status, msg);
                    });
                    break;
    
                default:
                    sendHttpResponse(
                        response,
                        "NOT_FOUND",
                        "This endpoint does not exist"
                    );
                    break;
            }
        } catch (error) {
            sendHttpResponse(response, "FATAL", error);
        }
    });
});

function sendHttpResponse(res, status, msg) {
    switch (status) {
        case "OK":
            statusCode = 200;
            break;

        case "REQUEST_FAILED":
            statusCode = 400;
            break;

        case "NOT_FOUND":
            statusCode = 404;
            break;

        default:
            statusCode = 500;
            console.error(timeCode(), msg);
            msg = "Internal server error";
            break;
    }
    res.writeHead(statusCode, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
        "status": status,
        "msg": msg
    }));
}

async function sendSlackMessage(msg) {
    if (slackSender !== undefined) {
        slackSender.send(msg);
    }
}

process.on("SIGTERM", () => {
    server.close(() => {
        console.log(timeCode(), "Process terminated");
    })
})
