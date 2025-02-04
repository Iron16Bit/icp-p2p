<svelte:options tag="standardml-editor" />

<script lang="ts">
    export let type: "normal" | "vertical" = "normal";
    export let theme: "light" | "dark" = "light";
    export let code = "";
    export let id = "";
    export let save = false;
    export let downloadable = false;

    import BaseEditor from "./BaseEditor.svelte";
    import { onMount } from "svelte";
    import MLWorker from "../modules/workers/mlWorker?worker&inline";
    import { StreamLanguage } from "@codemirror/language";
    import { sml } from "@codemirror/legacy-modes/mode/mllike";

    let webworker: Worker;

    function handleImportLanguage(event) { 
        if (event.detail.language == "ml") {
            if (window.confirm("You will need to import up to 800 KB. Is that ok?")) {
                webworker = new MLWorker()
            }
        }
    }

    window.addEventListener("importLanguage", handleImportLanguage);
</script>

<base-editor
    syntax={StreamLanguage.define(sml)}
    {type}
    theme={localStorage.getItem("icp-default-theme") || theme}
    {code}
    {webworker}
    {id}
    {downloadable}
    save={save && id != ""}
    language="ml"
/>
