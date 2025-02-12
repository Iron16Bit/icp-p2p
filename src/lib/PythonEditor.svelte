<svelte:options tag="python-editor" />

<script lang="ts">
  export let type: "normal" | "vertical" = "normal";
  export let theme: "light" | "dark" = "light";
  export let code = "";
  export let id = "";
  export let save = false;
  export let downloadable = false;
  export let requestimport = "false";

  import BaseEditor from "./BaseEditor.svelte";
  import PythonWorker from "../modules/workers/pythonWorker?url";
  import { onMount } from "svelte";
  import { python } from "@codemirror/lang-python";

  let webworker: SharedWorker;

  function createWorker(): void {
    webworker = new SharedWorker(PythonWorker, {
      name: "PythonWorker",
    });
    webworker.port.start();

    webworker.port.postMessage({
      type: "init",
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
  language="python"
/>
