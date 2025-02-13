<svelte:options tag="cooperation-button" />

<script lang='ts'>
    import { writable } from "svelte/store";
    import { serializeMsg, deserializeMsg, redbean_url, get_local_ip } from "../../p2p_utils/communicator.js";

    export let type: "normal" | "vertical" = "normal";
    

    let dialogRef;
    let rootElement: HTMLElement;
    let text = writable("");
    let localIP = "Your IP: ";

    let ipToConfirm = null;
    let showConfirmation = false;

    const showPopup = async () => {
        localIP = `Your IP: ${get_local_ip()}`;
        showConfirmation = false;
        ipToConfirm = null;
        dialogRef.showModal();
    };

    const closePopup = () => {
        dialogRef.close();
        showConfirmation = false;
        ipToConfirm = null;
    };

    function sendPing() {
        let ip = $text.trim(); // Trim spaces
        ip = ip.replace(/\r/g, ""); // Remove carriage return if present
        console.log("IP Sent:", ip, "Length:", ip.length);

        // Validate IPv4 format (optional but recommended)
        const ipv4Regex = new RegExp(
            "^(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\\." +
            "(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\\." +
            "(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\\." +
            "(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])$"
        );

        if (!ipv4Regex.test(ip)) {
            alert("Invalid IPv4 address.");
            return;
        }
        
        const msg = {
            sender_ip: "localhost",
            type: 3,
            data: ip
        };
        const serialized_msg = serializeMsg(msg);

        fetch(redbean_url, {
            method: "POST",
            headers: {
                "Content-type": "application/json; charset=UTF-8",
                "text": serialized_msg
            }
        });
    }

    function handleConfirmCooperation(event) {
        ipToConfirm = event.detail; // Assign IP from event
        showConfirmation = true;
        dialogRef.showModal(); // Ensure the dialog opens
    }

    function acceptCooperation() {
        closePopup();
    }

    function rejectCooperation() {
        showConfirmation = false;
        ipToConfirm = null;
    }

    // Listen for confirmCooperation event
    window.addEventListener("confirmCooperation", handleConfirmCooperation);

    $: if (dialogRef && dialogRef.open) {
        if (!showConfirmation && !ipToConfirm) {
            localIP = `Local IP: ${get_local_ip()}`; 
        }
    }
</script>

<main>
    <button 
        bind:this={rootElement}
        on:click={showPopup} 
        style="position: absolute; right: {type == 'vertical'
        ? `calc(var(--output-height) + min(1.5vw, 3vh))`
        : `min(0.75vw, 1.5vh)`}; top: min(5vw, 10vh); padding: min(0.25vw, 0.5vh); background-size: contain; width: min(2.5vw, 5.5vh); height: min(2.5vw, 5.5vh); display: flex; justify-content: center; align-items: center; z-index: 99; cursor: pointer; background-image: url('data:image/x-icon;base64,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');"
    >
    </button>
    <dialog on:cancel={closePopup} bind:this={dialogRef}>
        <div class="popup">
            <button class="close" on:click={closePopup}>×</button>

            {#if showConfirmation}
                <p style="white-space: pre-line;">IP: {ipToConfirm}  
    wants to connect to you</p>
                <div class="confirmation-buttons">
                    <button on:click={acceptCooperation}>Yes</button>
                    <button on:click={rejectCooperation}>No</button>
                </div>
            {:else}
                <p id="local_ip">{localIP}</p>
                <div class="input-container">
                    <textarea bind:value={$text} placeholder="Enter IP"></textarea>
                    <button on:click={sendPing}>PING</button>
                </div>
            {/if}
        </div>
    </dialog>
</main>

<style>
    dialog {
        border: none;
        border-radius: 8px;
        padding: 16px;
        width: 300px;
        position: relative;
    }

    .popup {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .close {
        position: absolute;
        top: 8px;
        right: 8px;
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
    }

    #local_ip {
        min-height: 20px;
        text-align: center;
    }

    .input-container {
        display: flex;
        gap: 8px;
    }

    .confirmation-buttons {
        display: flex;
        gap: 10px;
        justify-content: center;
    }

    textarea {
        flex: 1;
        resize: none;
        height: 30px;
    }

    button {
        padding: 6px 12px;
    }
</style>