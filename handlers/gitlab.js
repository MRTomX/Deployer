const childProcess = require("child_process");
const timeCode = require("../utils/time");


function isObject(obj) {
    return Object.prototype.toString.apply(obj) === "[object Object]"
}

function initCheck(options) {
    if (!isObject(options)) {
        throw new TypeError("GitLab handler: Must provide an options object");
    }

    if (!isObject(options.events)) {
        throw new TypeError("GitLab handler: must provide an \"events\" object");
    }

    Object.keys(options.events).forEach(key => {
        if (!Array.isArray(options.events[key]) && options.events[key].length === 0) {
            throw new TypeError("GitLab handler: event \"" + key + "\" must be non empty array of objects");
        }
        options.events[key].forEach(element => {
            if (!isObject(element)) {
                throw new TypeError("GitLab handler: event \"" + key + "\" must contain only objects");
            }
            if (element.hook === undefined) {
                throw new TypeError("GitLab handler: event \"" + key + "\" must contain object with \"hook\" option");
            }
            if (element.secret === undefined) {
                throw new TypeError("GitLab handler: event \"" + key + "\" must contain object with \"secret\" option");
            }
            if (element.script_path === undefined) {
                throw new TypeError("GitLab handler: event \"" + key + "\" must contain object with \"script_path\" option");
            }
        });
    });
}

function create(options, slackCallback) {
    initCheck(options);
    return handler;


    function getEventKey(requestedEvent) {
        switch (requestedEvent) {
            case "Push Hook":
                return "push"
                break;

            default:
                return null;
                break;
        }
    }

    function getEventObject(hook, event, secret) {
        retval = null;
        options.events[event].forEach(element => {
            if (
                element.hook === hook &&
                element.secret === secret
            ) {
                retval = element;
                retval.eventKey = event;
            }
        });
        return retval;
    }

    async function execute(eventObject, body) {
        let start = process.hrtime();
        childProcess.exec(eventObject.script_path, function (err, stdout, stderr) {
            let stop = process.hrtime(start);
            let outputMessage = "";
            if (err !== null) {
                err.stack = undefined;
                console.error(timeCode(), err, eventObject, stderr, stdout);
                outputMessage += ":bangbang: I regret to inform you, " +
                    "that attempt of processing request failed. " +
                    "More information will be provided in server logs. ";
            } else {
                outputMessage += ":white_check_mark: I'm happy to let you know, that requested action is successfully done. ";
            }
            outputMessage += "Action: *" + body.event_name + "*, requested by GitLab for *" +
                body.repository.name + "* repository issued by *" +
                body.user_name + "*. Elapsed time: " + (stop[0] * 1e9 + stop[1]) / 1e9 + " seconds.";
            console.log(timeCode(), outputMessage)
            slackCallback(outputMessage);
        });
    }

    function handler(request, requestBody, callback) {

        function hasError(status, msg) {
            console.error(timeCode(), "GitLab handler: status: " + status + ", msg:" + msg);
            callback(status, msg);
        }

        if (request.method !== "POST") {
            return hasError("NOT_FOUND", "There is no endpoint for method: " + request.method);
        }

        let secretToken = request.headers["x-gitlab-token"];
        if (!secretToken) {
            return hasError("REQUEST_FAILED", "No X-Gitlab-Token found on the request");
        }

        let requestedEvent = request.headers["x-gitlab-event"];
        if (!requestedEvent) {
            return hasError("REQUEST_FAILED", "No X-Gitlab-Event found on request");
        }

        let eventKey = getEventKey(requestedEvent);
        if (eventKey === null) {
            return hasError("REQUEST_FAILED", "X-Gitlab-Event is not acceptable");
        }

        let requestedHook = request.url.split("?").shift().split("/")[2];
        let eventObject = getEventObject(requestedHook, eventKey, secretToken);
        if (eventObject === null) {
            return hasError("NOT_FOUND", "Hook with given parameters does not exist");
        }

        if (!request.headers["content-type"] || request.headers["content-type"] !== "application/json") {
            return hasError("REQUEST_FAILED", "Unsupported Content-Type");
        }

        try {
            var body = JSON.parse(requestBody);
        } catch (error) {
            return hasError("REQUEST_FAILED", "Problem with parsing JSON body");
        }

        execute(eventObject, body);
        callback("OK", "Webhook request is now processing");
        let message = "I received a *" +
            body.event_name + "* request from GitLab for *" +
            body.repository.name + "* repository issued by *" +
            body.user_name + "*. I will start working on it immediately :sunglasses:";
        console.log(timeCode(), message);
        slackCallback(message);
    }
}

module.exports = create;
