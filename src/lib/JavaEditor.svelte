<svelte:options tag="java-editor" />

<script lang="ts">
    export let type: "normal" | "vertical" = "normal";
    export let theme: "light" | "dark" = "light";
    export let code = "";
    export let id = "";
    export let save = false;
    export let downloadable = false;
    export let requestimport = "false";

    import BaseEditor from "./BaseEditor.svelte";
    import JavaWorker from "../modules/workers/java/javaWorker?url";
    import RunWorker from "../modules/workers/java/javaRunWorker?url";
    import TeaWorker from "../modules/workers/java/javaTeaWorker?url";
    import { onMount } from "svelte";
    import { java } from "@codemirror/lang-java";

    let webworker: SharedWorker;
    let teaworker: SharedWorker;

    function createWorker(): void {
        webworker = new SharedWorker(JavaWorker, { name: "JavaWorker" });
        webworker.port.start();

        teaworker = new SharedWorker(TeaWorker, {
            name: "JavaTeaWorker",
        });

        const workerrun = new SharedWorker(RunWorker, {
            name: "JavaRunWorker",
        });

        webworker.port.postMessage(
            {
                worker: "runworker",
                port: workerrun.port,
            },
            [workerrun.port]
        );

        webworker.port.postMessage(
            {
                worker: "teaworker",
                port: teaworker.port,
                offline: false,
            },
            [teaworker.port]
        );
    }

    if (requestimport == "true") {
        function handleImportLanguage(event) {
        if (event.detail.language == "java") {
            if (
            window.confirm("You will need to import up to 12.3 MB. Is that ok?")
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
    syntax={java()}
    {type}
    theme={localStorage.getItem("icp-default-theme") || theme}
    {code}
    {webworker}
    {id}
    {downloadable}
    save={save && id != ""}
    language="java"
/>
