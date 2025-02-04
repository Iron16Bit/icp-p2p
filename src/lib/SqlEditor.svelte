<svelte:options tag="sql-editor" />

<script lang="ts">
    export let type: "normal" | "vertical" = "normal";
    export let theme: "light" | "dark" = "light";
    export let code = "";
    export let id = "";
    export let save = false;
    export let downloadable = false;

    import BaseEditor from "./BaseEditor.svelte";
    import { onMount } from "svelte";
    import SqlWorker from "../modules/workers/sqlWorker?worker&inline";
    import { sql } from "@codemirror/lang-sql";
    import { createHTMLTable } from "../modules/run/utils";

    let webworker: Worker;

    function handleImportLanguage(event) { 
        if (event.detail.language == "sql") {
            if (window.confirm("You will need to import up to 1.5 MB. Is that ok?")) {
                webworker = new SqlWorker()
            }
        }
    }

    window.addEventListener("importLanguage", handleImportLanguage);
</script>

<base-editor
    syntax={sql({ upperCaseKeywords: true })}
    {type}
    theme={localStorage.getItem("icp-default-theme") || theme}
    {code}
    {webworker}
    {id}
    {downloadable}
    save={save && id != ""}
    language="sql"
    modules={{
        "createHTMLTable": createHTMLTable
    }}
/>
