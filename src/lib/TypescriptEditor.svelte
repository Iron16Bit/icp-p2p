<svelte:options tag="typescript-editor" />

<script lang="ts">
    export let type: "normal" | "vertical" = "normal";
    export let theme: "light" | "dark" = "light";
    export let code = "";
    export let id = "";
    export let save = false;
    export let downloadable = false;

    import BaseEditor from "./BaseEditor.svelte";
    import { onMount } from "svelte";
    import { typescript } from "../modules/typescript";
    import TypescriptWorker from "../modules/workers/typescriptWorker?worker&inline";

    let webworker: Worker;

    onMount(() => {
        webworker = new TypescriptWorker();
    });
</script>

<base-editor
    syntax={typescript()}
    {type}
    theme={localStorage.getItem("icp-default-theme") || theme}
    {code}
    {webworker}
    {id}
    {downloadable}
    save={save && id != ""}
    language="typescript"
    on:recreateworker={(event) => {
        webworker = new TypescriptWorker();
    }}
/>