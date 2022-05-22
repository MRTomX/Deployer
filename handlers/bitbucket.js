const { match } = require("assert");
const childProcess = require("child_process");
const timeCode = require("../utils/time");


function isObject(obj) {
    return Object.prototype.toString.apply(obj) === "[object Object]"
}

function initCheck(hooksOptions) {
    if (!Array.isArray(hooksOptions) && hooksOptions.length === 0) {
        throw new TypeError("Bitbucket handler: Must provide an array of hooks");
    }

    hooksOptions.forEach(oneHook => {
        if (!isObject(oneHook)) {
            throw new TypeError("Bitbucket handler: hook array must contain only objects");
        }
        if (oneHook.hook === undefined) {
            throw new TypeError("Bitbucket handler: hook object must contain \"hook\" option");
        }
        if (oneHook.hook_uuid === undefined) {
            throw new TypeError("Bitbucket handler: hook object must contain \"hook_uuid\" option");
        }
        if (oneHook.events === undefined || !isObject(oneHook.events)) {
            throw new TypeError("Bitbucket handler: hook object must contain \"events\" object");
        }

        Object.keys(oneHook.events).forEach(key => {
            if (!Array.isArray(oneHook.events[key]) && oneHook.events[key].length === 0) {
                throw new TypeError("Bitbucket handler: event \"" + key + "\" must be non empty array of objects");
            }
            oneHook.events[key].forEach(eventPossibility => {
                if (!isObject(eventPossibility)) {
                    throw new TypeError("Bitbucket handler: event \"" + key + "\" must contain only objects");
                }
                if (eventPossibility.branch === undefined) {
                    throw new TypeError("Bitbucket handler: event \"" + key + "\" must contain object with \"branch\" option");
                }
                if (eventPossibility.script_path === undefined) {
                    throw new TypeError("Bitbucket handler: event \"" + key + "\" must contain object with \"script_path\" option");
                }
            });
        });
    });
}

function create(options, slackCallback) {
    initCheck(options);
    return handler;


    function getEventKey(requestedEvent) {
        switch (requestedEvent) {
            case "repo:push":
                return "push"
                break;

            default:
                return null;
                break;
        }
    }

    function getSpecificEventObject(body, eventKey, oneHook) {
        if (oneHook.events[eventKey] === undefined) {
            return null;
        }
        let retval = null;
        let branchName = "";
        let repository = "";
        let userInfo = {};
        switch (eventKey) {
            case "push":
                branchName = body.push.changes[0].old.name;
                repository = body.repository.full_name;
                userInfo.displayName = body.actor.display_name;
                userInfo.nickname = body.actor.nickname;
                break;
        
            default:
                return retval;
                break;
        }
        oneHook.events[eventKey].every(possibility => {
            if (possibility.branch === branchName) {
                retval = {
                    branchName: possibility.branch,
                    scriptPath: possibility.script_path,
                    userInfo: userInfo,
                    eventKey: eventKey,
                    repositoryName: repository
                };
                return false; // break
            }
            return true; // continue
        });
        return retval;
    }

    function getEventObject(hook, eventKey, hookUUID, body) {
        retval = null;
        options.every(oneHook => {
            if (
                oneHook.hook === hook &&
                oneHook.hook_uuid === hookUUID
            ) {
                retval = getSpecificEventObject(body, eventKey, oneHook);
                if (retval !== null) {
                    retval.hook = hook;
                    retval.hookUUID = hookUUID;
                }
                return false; // break
            }
            return true; // continue
        });
        return retval;
    }

    async function execute(eventObject) {
        let start = process.hrtime();
        childProcess.exec(eventObject.scriptPath, function (err, stdout, stderr) {
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
            outputMessage += "Action: *" + eventObject.eventKey + "*, requested by Bitbucket for *" +
                eventObject.repositoryName + "* repository issued by *" +
                eventObject.userInfo.displayName + "*. Elapsed time: " + (stop[0] * 1e9 + stop[1]) / 1e9 + " seconds.";
            console.log(timeCode(), outputMessage)
            slackCallback(outputMessage);
        });
    }

    function handler(request, requestBody, callback) {

        function hasError(status, msg) {
            console.error(timeCode(), "Bitbucket handler: status: " + status + ", msg:" + msg);
            callback(status, msg);
        }

        if (request.method !== "POST") {
            return hasError("NOT_FOUND", "There is no endpoint for method: " + request.method);
        }

        let hookUUID = request.headers["x-hook-uuid"];
        if (!hookUUID) {
            return hasError("REQUEST_FAILED", "No X-Hook-UUID found on the request");
        }

        let requestedEvent = request.headers["x-event-key"];
        if (!requestedEvent) {
            return hasError("REQUEST_FAILED", "No X-Event-Key found on request");
        }

        let eventKey = getEventKey(requestedEvent);
        if (eventKey === null) {
            return hasError("REQUEST_FAILED", "X-Event-Key is not acceptable");
        }

        let requestedHook = request.url.split("?").shift().split("/")[2];

        if (requestedHook === undefined || requestedHook.length <= 0) {
            return hasError("REQUEST_FAILED", "Hook name expected");
        }

        if (!request.headers["content-type"] || request.headers["content-type"] !== "application/json") {
            return hasError("REQUEST_FAILED", "Unsupported Content-Type");
        }

        try {
            var body = JSON.parse(requestBody);
        } catch (error) {
            return hasError("REQUEST_FAILED", "Problem with parsing JSON body");
        }

        let eventObject = getEventObject(requestedHook, eventKey, hookUUID, body);
        if (eventObject === null) {
            return hasError("NOT_FOUND", "Hook with given parameters does not exist");
        }

        execute(eventObject);
        callback("OK", "Webhook request is now processing");
        let message = "I received a *" +
            eventObject.eventKey + "* request from Bitbucket for *" +
            eventObject.repositoryName + "* repository issued by *" +
            eventObject.userInfo.displayName + "*. I will start working on it immediately :sunglasses:";
        console.log(timeCode(), message);
        slackCallback(message);
    }
}

module.exports = create;
