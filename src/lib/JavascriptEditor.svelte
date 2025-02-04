<svelte:options tag="javascript-editor" />

<script lang="ts">
    export let type: "normal" | "vertical" = "normal";
    export let theme: "light" | "dark" = "light";
    export let code = "";
    export let id = "";
    export let save = false;
    export let downloadable = false;

    import BaseEditor from "./BaseEditor.svelte";
    import { onMount } from "svelte";
    import JavascriptWorker from "../modules/workers/javascriptWorker?worker&inline";
    import { javascript } from "@codemirror/lang-javascript";

    let webworker: Worker;

    function handleImportLanguage(event) { 
        if (event.detail.language == "javascript") {
            if (window.confirm("You will need to import up to 500 KB. Is that ok?")) {
                webworker = new JavascriptWorker()
            }
        }
    }

    window.addEventListener("importLanguage", handleImportLanguage);
</script>

<base-editor
    syntax={javascript()}
    {type}
    theme={localStorage.getItem("icp-default-theme") || theme}
    {code}
    {webworker}
    {id}
    {downloadable}
    save={save && id != ""}
    language="javascript"
/>
