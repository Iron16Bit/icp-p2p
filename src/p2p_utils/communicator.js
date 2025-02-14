// Establish a connection to the SSE server
// The redbean sends MSGs to the browser client from here
export const eventSource = new EventSource('http://localhost:3000');

// Local URL of the redbean HTTP server
// The browser client can send MSGs to the redbean from here
export const redbean_url = "http://127.0.0.1:8080";

var local_ip = "";

// "Enum" with the various msg types
// INTERNAL_PING = 0; 
// PONG = 1; 
// SETUP = 2;
// PING = 3;
// SETUP_COOPERATION = 4;
// CONFIRM_COOPERATION = 5;
// REFRESH = 6;

// Utilities to transform a MSG JSON into a string and viceversa 
export function serializeMsg(msg) {
    // Ensure the object contains the necessary fields
    if (!msg.sender_ip || !msg.type || !msg.data) {
        throw new Error("Invalid message structure");
    }

    // Serialize as a delimited string
    return `${msg.sender_ip}|${msg.type}|${msg.data}`;
}

export function deserializeMsg(str) {
    // Split the string by the delimiter
    const parts = str.split("|");
    if (parts.length !== 3) {
        throw new Error("Invalid serialized message format");
    }

    // Reconstruct the JSON object
    return {
        sender_ip: parts[0],
        type: parseInt(parts[1], 10), // Convert type to an integer
        data: parts[2],
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
            local_ip = message.data;
        } else if (message.type == 5) {
            // A peer wants to connect to us, ask for confirmation
            console.log("AIUTOOOOOOO")
            window.dispatchEvent(new CustomEvent("confirmCooperation", { detail: message.data }));
        }
    } catch (error) {
        console.error('Failed to deserialize message:', error);
    }
};

export function get_local_ip() {
    return local_ip;
}

// Triggered when the connection is opened
eventSource.onopen = () => {
    console.log('Connection to SSE server opened.');
};

// Triggered when an error occurs
eventSource.onerror = (error) => {
    console.error('Error with SSE connection:', error);
};

window.onload = function () {
    // On page refresh, tell the redbean_client
    const msg = {
        sender_ip: "localhost",
        type: 6,
        data: "NULL"
    };
    const serialized_msg = serializeMsg(msg);

    fetch(redbean_url, {
        method: "POST",
        headers: {
            "Content-type": "application/json; charset=UTF-8",
            "text": serialized_msg
        }
    });
};