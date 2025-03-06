// Establish a connection to the SSE server
// The redbean sends MSGs to the browser client from here
const event_server_url = "http://localhost:";
// Access the port passed as parameter in url
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const event_server_port = urlParams.get('port') || 3000;
export const eventSource = new EventSource('http://localhost:'+event_server_port);

// Local URL of the redbean HTTP server
// The browser client can send MSGs to the redbean from here
let redbean = "http://127.0.0.1:";
// Extract the port from the URL
const url = window.location.origin;
const port = url.split(":")[2];
redbean+=port;
export const redbean_url = redbean;

var local_ip = "";
var local_port = 0;

// "Enum" with the various msg types
// INTERNAL_PING = 0; 
// PONG = 1; 
// SETUP = 2;
// PING = 3;
// SETUP_COOPERATION = 4;
// CONFIRM_COOPERATION = 5;
// REFRESH = 6;
// COOPERATION_READY = 7;
// REQUEST_CODE = 8;
// INITIALIZE_CODE = 9;
// SEND_CHANGESET = 10;
// TERMINATE_COOPERATION = 11;

// Utilities to transform a MSG JSON into a string and viceversa 
export function serializeMsg(msg) {
    if (!msg.sender_ip || msg.sender_port === undefined || !msg.type || msg.data === undefined) {
        throw new Error("Invalid message structure");
    }
    // Encode the data to handle newlines and special characters, ensuring non-empty data
    const encodedData = msg.data ? encodeURIComponent(msg.data) : " ";
    
    return `${msg.sender_ip}|${msg.sender_port}|${msg.type}|${encodedData}`;
}

export function serializeChangesetMsg(msg) {
    // Ensure the object contains the necessary fields
    if (!msg.sender_ip || msg.sender_port === undefined || !msg.type || !msg.data || !Array.isArray(msg.data.modifications)) {
        throw new Error("Invalid message structure");
    }

    // Serialize `data` as a compact JSON string
    const serializedData = `${msg.data.oldLen},${msg.data.newLen},` +
        msg.data.modifications.map(mod => (typeof mod === "number" ? mod : JSON.stringify(mod))).join(",");

    // Serialize as a delimited string
    return `${msg.sender_ip}|${msg.sender_port}|${msg.type}|${serializedData}`;
}

export function deserializeMsg(str) {
    const parts = str.split("|");

    const sender_port = parseInt(parts[1], 10);
    const type = parseInt(parts[2], 10);
    let data = decodeURIComponent(parts[3]);

    return {
        sender_ip: parts[0],
        sender_port,
        type,
        data,
    };
}

// Triggered when a message is received from the server
eventSource.onmessage = (event) => {
    try {
        // Deserialize the message
        const message = deserializeMsg(event.data);

        // Log the reconstructed message
        console.log('Deserialized Message:', message);

        // If the message is an INTERNAL_PING, answer with a PONG
        if (message.type == 0) {
            const PONG = {
                sender_ip: "localhost",
                sender_port: local_port,
                type: 1,
                data: "NULL"
            };
            const serialized_msg = serializeMsg(PONG);

            fetch(redbean_url, {
                method: "POST",
                headers: {
                    "Content-type": "application/json; charset=UTF-8",
                    "text": serialized_msg
                }
            });
        } else if (message.type == 2) {
            // Received a SETUP msg
            let ip = message.data.trim(); // Trim spaces
            ip = ip.replace(/\r/g, ""); // Remove carriage return if present
            local_ip = ip;
            let port = message.sender_port;
            local_port = port;
        } else if (message.type == 5) {
            // A peer wants to connect to us, ask for confirmation
            window.dispatchEvent(new CustomEvent("confirmCooperation", { detail: message.data }));
        } else if (message.type == 7) {
            // The connection with the peer is ready
            window.dispatchEvent(new CustomEvent("cooperationReady"));
        } else if (message.type == 8) {
            // The peer is asking for the current editor code
            window.dispatchEvent(new CustomEvent("requestCode"));
        } else if (message.type == 9) {
            // Tell to initialize the editor with the received code
            window.dispatchEvent(new CustomEvent("initializeCode", { detail: message.data }));
        } else if (message.type == 10) {
            const parts = message.data.split(',');
            let changeset = {
                oldLen: parseInt(parts[0]),
                newLen: parseInt(parts[1]),
                modifications: parts.slice(2).map(item => {
                    try {
                        return JSON.parse(item);
                    } catch {
                        return parseInt(item);
                    }
                })
            }
            // Tell to update with the received changeset
            window.dispatchEvent(new CustomEvent("receivedChangeset", { detail: changeset }));
        } else if (message.type == 11) {
            // Tell to stop cooperation
            window.dispatchEvent(new CustomEvent("stopCooperation"));
        }
    } catch (error) {
        console.error('Failed to deserialize message:', error);
    }
};

export function get_local_ip() {
    return local_ip;
}

export function get_local_port() {
    return local_port;
}

// Triggered when the connection is opened
eventSource.onopen = () => {
    console.log('Connection to SSE server opened.');
};

// Triggered when an error occurs
eventSource.onerror = (error) => {
    console.error('Error with SSE connection:', error);
};

window.addEventListener("beforeunload", async function (event) {
    const msg = {
        sender_ip: "localhost",
        sender_port: local_port,
        type: 6,
        data: "NULL"
    };
    const serialized_msg = serializeMsg(msg);

    try {
        await fetch(redbean_url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json; charset=UTF-8",
                "text": serialized_msg
            },
            body: JSON.stringify(msg),
            keepalive: true // Ensures request completes even if page unloads
        });
    } catch (error) {
        console.error("Fetch failed:", error);
    }
});