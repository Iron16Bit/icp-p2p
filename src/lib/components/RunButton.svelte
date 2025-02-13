<svelte:options tag="run-button" />

<script lang="ts">
  /**
   * IMPORTS
   */
  import { executeRequest, editorToExecute } from "../../stores";
  import type { EditorView } from "@codemirror/view";
  import { onMount } from "svelte";
  import type { Language } from "../../types";

  /**
   * PROPS
   */
  export let type: "normal" | "vertical" = "normal";
  export let language: Language;
  export let editor: EditorView;
  export let offline: boolean = false;
  export let webworker: Worker | SharedWorker;
  export let modules: any = {};

  /**
   * ELEMENTS
   */
  let ref: HTMLElement;
  let isVisible: boolean = true;

  /**
   * VARIABLES
   */
  let output: string;
  let outputError: boolean;
  let runButtonRunning = false;
  let p5Instance: typeof modules["p5"];

  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      isVisible = true;
    } else {
      isVisible = false;
    }
  });

  // Dispatch an event "changedout" when the output changes
  // The parent will listen to this event and update the output accordingly
  $: {
    generateOutput(output, outputError);
  }

  // When using language p5 or processing, stop the execution when the editor is not visible
  $: if (
    !isVisible &&
    (language == "p5" || language == "processing") &&
    p5Instance
  ) {
    interruptExecution();
  }

  $: {
    if ($executeRequest) {
      // Check if the execution request arrives from this editor
      if (editor && editor.dom.isEqualNode($editorToExecute)) {
        // If so, execute the code and reset the executeRequest store variable
        runCode(null);
        $executeRequest = false;
      }
    }
  }

  $: {
    if (webworker) {
      console.log(webworker);
      // Handle the webworker's messages
      if (language == "python" || language == "java" || language == "cpp") {
        (webworker as SharedWorker).port.onmessage = onWorkerMessage;
      } else {
        console.log("Initialized worker for language " + language);
        (webworker as Worker).onmessage = onWorkerMessage;
      }
    }
  }

  /**
   * FUNCTIONS
   */

  /**
   * Generate an error and dispatch it
   * @param message error message
   * @param isError true if the error is an error, false if it is a warning
   */
  function generateOutput(error: string, isError: boolean) {
    const event = new CustomEvent("changedout", {
      detail: {
        output: error,
        outputError: isError,
      },
      bubbles: true,
      cancelable: true,
      composed: true,
    });
    ref?.dispatchEvent(event);
  }

  /**
   * Handler of the webworker's message
   * @param message message received from the webworker
   */
  function onWorkerMessage(message: any) {
    runButtonRunning = false;
    if (message.data.error) {
      outputError = true;
      output =
        language == "python"
          ? "[line " + message.data.line + "] " + message.data.error
          : language == "ml"
          ? message.data.error.message
          : message.data.error;
      console.log(message.data);
    } else {
      outputError = false;

      if (language == "sql") {
        if (
          message.data.result &&
          Array.isArray(message.data.result) &&
          message.data.result.length > 0
        ) {
          // For each table in output generate the HTML table
          const tables = message.data.result.map(
            (table) => modules["createHTMLTable"](table).outerHTML
          );
          output = tables.join("<br>");
        } else {
          output = "";
        }
      } else {
        let text = "";
        if (message.data.debug) text += message.data.debug + "\n\n";
        if (message.data.result) text += "'" + message.data.result + "'";
        output = text;
      }
    }
    generateOutput(output, outputError);
  }

  /**
   * Interrupt the current code execution
   */
  function interruptExecution() {
    console.warn("Interrupting Code Execution");
    // Terminate the worker without waiting for the end of the execution
    if (language == "python" || language == "java" || language == "cpp") {
      (webworker as SharedWorker).port.close();
    } else if (language == "p5" || language == "processing") {
      p5Instance.remove();
    } else {
      (webworker as Worker).terminate();
    }
    const event = new CustomEvent("recreateworker", {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
    ref?.dispatchEvent(event);
    runButtonRunning = false;
  }

  /**
   * Run the provided code
   */
  async function runCode(_event: Event) {
    // If the code is already running, interrupt the execution instead
    if (runButtonRunning) {
      interruptExecution();
      return;
    }

    runButtonRunning = true;

    if (language == "p5") {
      let code = editor.state.doc.toString();
      let width = editor.dom.getBoundingClientRect().width;
      let height = editor.dom.getBoundingClientRect().height;

      // use a regular expression to find the createCanvas() function call
      const regex = /createCanvas\(([^,]+),\s*([^)]+)\)/;

      // Get the width and height from the createCanvas() function call
      const match = regex.exec(code);
      let w: number, h: number;
      if (match) {
        w = parseInt(match[1]);
        h = parseInt(match[2]);
      } else {
        generateOutput(
          "Runtime error: createCanvas() function not found",
          true
        );
        runButtonRunning = false;
        return;
      }

      if (w < width) {
        width = w;
      }
      if (h < height) {
        height = h;
      }

      // replace the function call with a new function call using the desired arguments
      code = code.replace(regex, `createCanvas(${width}, ${height})`);
      console.log(code);

      const logs = [];
      let originalConsoleLog = console.log;
      console.log = function (message, ...args) {
        logs.push(message + " " + args.join(" "));
      };

      // Hacky way to handle runtime errors
      window.onerror = function (message, source, lineno, colno, error) {
        generateOutput(`Runtime error: ${message}`, true);
        runButtonRunning = false;
      };
      window.onunhandledrejection = function (event) {
        event.preventDefault();
        throw event.reason;
      };

      try {
        await window.eval(code);
      } catch (e) {
        generateOutput(`Runtime error: ${e.message}`, true);
        runButtonRunning = false;
        return;
      }

      p5Instance = new modules["p5"]();

      const canvas = p5Instance.canvas;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";

      // Send the canvas to the output
      const event = new CustomEvent("canvasout", {
        detail: {
          canvas,
        },
        bubbles: true,
        cancelable: true,
        composed: true,
      });
      ref?.dispatchEvent(event);

      // Put debug logs into output
      generateOutput(logs.join("\n"), false);

      // Reset console.log function
      console.log = originalConsoleLog;

      return;
    }

    if (language == "processing") {
      let code = editor.state.doc.toString();

      try {
        // Transform the code to p5.js code
        code = modules["transformProcessing"](code);
      } catch (e) {
        const lineRegex = /line: (\d+)/;
        const columnRegex = /column: (\d+)/;
        const expectingRegex = /--> (.*?) <(?:--)/;
        const foundRegex = /but found --> '([^']*)' <--/;

        if (
          lineRegex &&
          columnRegex &&
          expectingRegex &&
          foundRegex &&
          e.message.match(lineRegex) &&
          e.message.match(columnRegex) &&
          e.message.match(expectingRegex) &&
          e.message.match(foundRegex)
        ) {
          const lineNumber = e.message.match(lineRegex)[1];
          const columnNumber = e.message.match(columnRegex)[1];
          const expecting = e.message.match(expectingRegex)[1];
          const found = e.message.match(foundRegex)[1];

          generateOutput(
            `Error at line ${lineNumber}, column ${columnNumber}: expecting  "${expecting}" but found  "${found}"`,
            true
          );
        } else {
          generateOutput(`Unknown error - ${e.message}`, true);
        }

        runButtonRunning = false;
        return;
      }
      let width = editor.dom.getBoundingClientRect().width;
      let height = editor.dom.getBoundingClientRect().height * 0.7;

      // use a regular expression to find the createCanvas() function call
      const regex = /createCanvas\(([^,]+),\s*([^)]+)\)/;

      // Check if the createCanvas() is available
      const match = regex.exec(code);
      if (!match) {
        // Check if the setup function is available
        if (code.includes("setup ( ) {")) {
          console.log("setup function found");
          // Insert the createCanvas() function call in the setup function
          code = code.replace(
            `setup ( ) {`,
            `setup() { createCanvas(${width}, ${height});`
          );
        } else {
          generateOutput(`Error: setup() function not found`, true);
          runButtonRunning = false;
          return;
        }
      } else {
        // Get the width and height from the createCanvas() function call
        const w = parseInt(match[1]);
        const h = parseInt(match[2]);

        if (w < width) {
          width = w;
        }
        if (h < height) {
          height = h;
        }

        // replace the function call with a new function call using the desired arguments
        code = code.replace(regex, `createCanvas(${width}, ${height})`);
      }

      code = `
let width = ${Math.round(width)};
let height = ${Math.round(height)};
${code}
`;
      console.log(code);
      let logs = [];
      let originalConsoleLog = console.log;
      console.log = function (message, ...args) {
        logs.push(message + " " + args.join(" "));
      };

      // Reset setup and draw functions
      // @ts-ignore
      if (typeof setup !== "undefined") {
        // @ts-ignore
        setup = undefined;
      }
      // @ts-ignore
      if (typeof draw !== "undefined") {
        // @ts-ignore
        draw = undefined;
      }

      // Check for infinite loops
      const callback = (line) => {
        throw new Error(
          "ATTENZIONE: il tuo codice contiene un ciclo infinito!"
        );
      };
      const timeout = 100;
      modules["babel"].registerPlugin("loopProtection", modules["protect"](timeout, callback));
      code = modules["babel"].transform(code, {
        plugins: ["loopProtection"],
      }).code;

      // Hacky way to handle runtime errors
      window.onerror = function (message, source, lineno, colno, error) {
        if (
          message
            .toString()
            .includes("ATTENZIONE: il tuo codice contiene un ciclo infinito!")
        ) {
          // Based on what the professor asked, we should not show this specific error message
          runButtonRunning = false;
          return;
        }
        generateOutput(`Runtime error: ${message}`, true);
        runButtonRunning = false;
      };
      window.onunhandledrejection = function (event) {
        event.preventDefault();
        throw event.reason;
      };

      try {
        await window.eval(code);
      } catch (e) {
        generateOutput(`Runtime error: ${e.message}`, true);
        runButtonRunning = false;
        return;
      }

      p5Instance = new modules["p5"]();

      const canvas = p5Instance.canvas;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";

      // Send the canvas to the output
      const event = new CustomEvent("canvasout", {
        detail: {
          canvas,
        },
        bubbles: true,
        cancelable: true,
        composed: true,
      });
      ref?.dispatchEvent(event);

      // Put debug logs into output
      generateOutput(logs.join("\n"), false);
      console.log = originalConsoleLog;

      // If the code does not contain any draw() function, set the run button to not running
      if (!code.includes("draw()")) {
        interruptExecution();
      }
      return;
    }

    // Define the baseUrl used for pyodide to load the packages
    // when in offline mode
    let baseUrl = "";
    if (offline) {
      baseUrl =
        document.location.protocol +
        "//" +
        document.location.host +
        document.location.pathname;
      baseUrl = baseUrl.substring(0, baseUrl.lastIndexOf("/"));
      baseUrl +=
        language == "python" ? "/utils/python/pyodide/" : "/utils/java/";
    }

    // Define the message to send to the worker
    const message = {
      offline: offline,
      language: language,
      script: editor.state.doc.toString(),
      input: "",
      baseUrl: baseUrl,
    };

    // Send to the webworker the script to run
    if (language == "python" || language == "java" || language == "cpp") {
      (webworker as SharedWorker).port.postMessage(message);
    } else {
      (webworker as Worker).postMessage(message);
    }
  }

  function handleClick() {
    if (((language != 'p5' && language != "processing") && webworker == undefined) || 
      ((language == 'p5' && modules["p5"] == undefined)
      || (language == 'processing' && modules["p5"] == undefined))) {
      // Button is disabled, try creating the worker
      const importLanguageEvent = new CustomEvent("importLanguage", {
        detail: { language }
      });
      window.dispatchEvent(importLanguageEvent);
    } else {
      // Run code
      runCode(event)
    }
  }

  onMount(() => {
    observer.observe(ref);
  });
</script>

<div
  bind:this={ref}
  id="play-container"
  style={type == "vertical"
    ? `right: calc(var(--output-height) + min(0.7vw, 1.4vh) + 1px); bottom: min(0.3vw, 0.6vh)`
    : `right: min(0.4vw, 0.8vh); bottom: calc(var(--output-height) + min(0.5vw, 1vh))`}
>
  <main />
  <button
    on:click={handleClick}
    id="run-button"
    style="background-color: {webworker != undefined || 
    ((language == 'p5' && modules["p5"] != undefined)
    || (language == 'processing' && modules["p5"] != undefined))
      ? runButtonRunning
        ? '#ff4133'
        : '#00CC3D'
      : '#5f5f5f'}"
  >
    {#if runButtonRunning}
      <svg
        style="width: 30%; height: 30%; fill: white;"
        viewBox="0 0 10 10"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M8.59 0L5 3.59L1.41 0L0 1.41L3.59 5L0 8.59L1.41 10L5 6.41L8.59 10L10 8.59L6.41 5L10 1.41L8.59 0Z"
          fill="white"
        />
      </svg>
    {:else}
      <svg style="width: 70%; height: 70%; fill: white;" viewBox="0 0 24 24">
        <path d="M8,5.14V19.14L19,12.14L8,5.14Z" />
      </svg>
    {/if}
  </button>
</div>

<style>
  #play-container {
    width: min(2vw, 4vh);
    height: min(2vw, 4vh);
    position: absolute;
    z-index: 10;
  }

  @media screen and (max-width: 992px) {
    #play-container {
      width: min(4vw, 8vh);
      height: min(4vw, 8vh);
      position: absolute;
      z-index: 99;
    }
  }


  #run-button {
    width: 100%;
    height: 100%;
    padding: 0 !important;
    margin: 0 !important;
    border-radius: 50%;
    transition: all ease-in 150ms;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    cursor: pointer;
    box-shadow: 2px -7px 17px -5px rgba(0, 0, 0, 0.35);
  }

  #run-button:hover {
    background-color: var(--run-button-bg-color-hover);
    transform: scale(1.1, 1.1);
  }

  #run-button:focus {
    outline: 0;
  }
</style>
