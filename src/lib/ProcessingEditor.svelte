<svelte:options tag="processing-editor" />

<script lang="ts">
    export let theme: "light" | "dark" = "light";
    export let code = "";
    export let id = "";
    export let save = false;
    export let downloadable = false;

    import BaseEditor from "./BaseEditor.svelte";
    import { onMount } from "svelte";
    import { java } from "@codemirror/lang-java";

    import p5 from "p5";
    import { transformProcessing } from "../modules/processing/utils";
    import * as babel from "@babel/standalone";
    import protect from "@freecodecamp/loop-protect";

    let modules={
        "p5": null,
        "transformProcessing": transformProcessing,
        "babel": babel,
        "protect": protect
    }

    function handleImportLanguage(event) { 
        if (event.detail.language == "processing") {
            if (window.confirm("You will need to import up to 4.3 MB. Is that ok?")) {
                modules.p5 = p5
            }
        }
    }

    window.addEventListener("importLanguage", handleImportLanguage);
</script>

<base-editor
    type="vertical"
    syntax={java()}
    theme={localStorage.getItem("icp-default-theme") || theme}
    {code}
    {id}
    {downloadable}
    save={save && id != ""}
    webworker={null}
    language="processing"
    {modules}
/>
