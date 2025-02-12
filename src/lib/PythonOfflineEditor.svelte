<svelte:options tag="python-editor" />

<script lang="ts">
    export let type: "normal" | "vertical" = "normal";
    export let theme: "light" | "dark" = "light";
    export let code = "";
    export let id = "";
    export let save = false;
    export let requestimport = "false";
    export let downloadable = false;

    import { python } from "@codemirror/lang-python";
    import { onMount } from "svelte";

    let webworker: SharedWorker;

    function createWorker(): void {
        let baseUrl =
        document.location.protocol +
        "//" +
        document.location.host +
        document.location.pathname;
        baseUrl = baseUrl.substring(0, baseUrl.lastIndexOf("/"));
        baseUrl += "/utils/python/pyodide/";

        webworker = new SharedWorker(baseUrl + "pythonWorkerBundle.iife.js", {
        name: "PythonWorker",
        });
        webworker.port.start();

        webworker.port.postMessage({
        type: "init",
        baseUrl: baseUrl,
        });
    }

    if (requestimport == "true") {
        function handleImportLanguage(event) {
        if (event.detail.language == "python") {
            if (
            window.confirm("You will need to import up to 21.3 MB. Is that ok?")
            ) {
            createWorker();
            }
        }
        }

        window.addEventListener("importLanguage", handleImportLanguage);
    } else {
        onMount(() => {
        createWorker();
        });
    }
</script>

<base-editor
    syntax={python()}
    {type}
    theme={localStorage.getItem("icp-default-theme") || theme}
    {code}
    {webworker}
    {id}
    {downloadable}
    save={save && id != ""}
    offline={true}
    language="python"
/>