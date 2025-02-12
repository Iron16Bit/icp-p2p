<svelte:options tag="cpp-editor" />

<script lang="ts">
  export let type: "normal" | "vertical" = "normal";
  export let theme: "light" | "dark" = "light";
  export let code = "";
  export let id = "";
  export let save = false;
  export let downloadable = false;
  export let requestimport = "false";

  import BaseEditor from "./BaseEditor.svelte";
  import { onMount } from "svelte";
  import { cpp } from "@codemirror/lang-cpp";

  let webworker: SharedWorker;

  function createWorker(): void {
    let baseUrl =
      document.location.protocol +
      "//" +
      document.location.host +
      document.location.pathname;
    baseUrl = baseUrl.substring(0, baseUrl.lastIndexOf("/"));
    baseUrl += "/utils/cpp/";

    webworker = new SharedWorker(baseUrl + "cppWorkerBundle.iife.js", {
      name: "CppWorker",
    });
    webworker.port.start();

    webworker.port.postMessage({ type: "init", baseUrl });
  }

  if (requestimport == "true") {
    function handleImportLanguage(event) {
    if (event.detail.language == "cpp") {
        if (
        window.confirm("You will need to import up to 58.1 MB. Is that ok?")
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
  syntax={cpp()}
  {type}
  theme={localStorage.getItem("icp-default-theme") || theme}
  {code}
  {webworker}
  {id}
  {downloadable}
  save={save && id != ""}
  language="cpp"
/>
