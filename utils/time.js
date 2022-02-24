function timeCode() {
    let now = new Date();
    let date = ("0" + now.getDate()).slice(-2);
    let month = ("0" + (now.getMonth() + 1)).slice(-2);
    let year = now.getFullYear();
    let hours = ("0" + now.getHours()).slice(-2);
    let minutes = ("0" + now.getMinutes()).slice(-2);
    let seconds = ("0" + now.getSeconds()).slice(-2);

    // date & time in YYYY-MM-DD HH:MM:SS format
    return "[" + year + "-" + month + "-" + date + " " + hours + ":" + minutes + ":" + seconds + "]";
}

module.exports = timeCode;