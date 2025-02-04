<svelte:options tag="p5-editor" />

<script lang="ts">
    export let theme: "light" | "dark" = "light";
    export let code = "";
    export let id = "";
    export let save = false;
    export let downloadable = false;

    import BaseEditor from "./BaseEditor.svelte";
    import { onMount } from "svelte";
    import { javascript } from "@codemirror/lang-javascript";
    import p5 from "p5";
    let modules={"p5": null}

    function handleImportLanguage(event) { 
        if (event.detail.language == "p5") {
            if (window.confirm("You will need to import up to 4.3 MB. Is that ok?")) {
                modules.p5 = p5
            }
        }
    }

    window.addEventListener("importLanguage", handleImportLanguage);
</script>

<base-editor
    syntax={javascript()}
    type="vertical"
    theme={localStorage.getItem("icp-default-theme") || theme}
    {code}
    {id}
    {downloadable}
    save={save && id != ""}
    webworker={null}
    language="p5"
    {modules}
/>
