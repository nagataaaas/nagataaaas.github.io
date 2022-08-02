importScripts('https://cdn.jsdelivr.net/pyodide/v0.20.0/full/pyodide.js')
let pyodide;

const ps1 = ">>> ",
    ps2 = "... ";
let currentPrompt = ps1;

let stdinbuffer = null
const stdin = () => {
    // Send message to activate stdin mode
    postMessage({
        type: 'prompt',
        prompt: ''
    })
    postMessage({
        type: 'input',
    })
    postMessage({
        type: 'ready'
    })
    let text = ''
    Atomics.wait(stdinbuffer, 0, -1)
    const numberOfElements = stdinbuffer[0]
    stdinbuffer[0] = -1
    const newStdinData = new Uint8Array(numberOfElements)
    for (let i = 0; i < numberOfElements; i++) {
        newStdinData[i] = stdinbuffer[1 + i]
    }
    const responseStdin = new TextDecoder('utf-8').decode(newStdinData)
    text += responseStdin
    postMessage({
        type: 'ready'
    })
    postMessage({
        type: 'prompt',
        prompt: ps1
    })
    return text
}

class Python {
    constructor() {
        this.init();
    }

    async init() {
        this.pyodide = await loadPyodide({
            stdout: (s) => {
                postMessage({type: 'print', text: s})
            },
            stdin: stdin,
            // stderr: (s) => {
            //     postMessage({type: 'error', error: s.trimEnd()})
            // }
        })

        this.pyodide._module.on_fatal = async (e) => {
            postMessage({
                type: 'error', error: [
                    "Pyodide has suffered a fatal error. Please report this to the Pyodide maintainers.",
                    "The cause of the fatal error was:",
                    e,
                    "Look in the browser console for more details."
                ].join("\n")
            })
        };
        this.getNamespace()
        this.namespace.pyconsole.stdout_callback = (s) => postMessage({type: 'echo', text: s})
        this.namespace.pyconsole.stderr_callback = (s) => postMessage({type: 'error', error: s})
        postMessage({type: 'ready'})
    }

    getNamespace() {
        const namespace = this.pyodide.globals.get("dict")();
        this.pyodide.runPython(
            `
            import sys
            from pyodide import to_js
            from pyodide.console import PyodideConsole, repr_shorten, BANNER
            import __main__
            BANNER = "Welcome to the Pyodide terminal emulator 🐍\\n" + BANNER
            pyconsole = PyodideConsole(__main__.__dict__)
            import builtins
            async def await_fut(fut):
              res = await fut
              if res is not None:
                builtins._ = res
              return to_js([res], depth=1)
            def clear_console():
              pyconsole.buffer = []
            def _repr(obj):
                return repr(obj)
        `,
            {globals: namespace}
        );
        this.namespace = {
            pyconsole: namespace.get("pyconsole"),
            await_fut: namespace.get("await_fut"),
            clear_console: namespace.get("clear_console"),
            banner: namespace.get("BANNER"),
            repr: namespace.get("_repr"),
        }
        namespace.destroy();
    }


    async exec(command) {
        for (const c of command.split("\n")) {
            let fut = this.namespace.pyconsole.push(c);
            if (currentPrompt !== (fut.syntax_check === "incomplete" ? ps2 : ps1)) {
                currentPrompt = fut.syntax_check === "incomplete" ? ps2 : ps1
                postMessage({type: 'prompt', prompt: currentPrompt})
            }

            switch (fut.syntax_check) {
                case "syntax-error":
                    postMessage({type: 'error', error: fut.formatted_error.trimEnd()})
                    continue;
                case "incomplete":
                    continue;
                case "complete":
                    break;
                default:
                    throw new Error(`Unexpected type ${ty}`);
            }
            let wrapped = this.namespace.await_fut(fut);
            try {
                let [value] = await wrapped;
                if (value !== undefined) {
                    postMessage({type: 'print', text: this.namespace.repr(value)})
                }
                if (this.pyodide.isPyProxy(value)) {
                    value.destroy();
                }
            } catch (e) {
                if (e.constructor.name === "PythonError") {
                    const message = fut.formatted_error || e.message;
                    postMessage({type: 'error', error: message.trimEnd()})
                } else {
                    throw e;
                }
            } finally {
                fut.destroy();
                wrapped.destroy();
            }
        }
    }
}

onmessage = async (e) => {
    if (!python) return;
    switch (e.data.type) {
        case 'exec':
            const command = e.data.command;
            await python.exec(command);
            break;
        case 'completion':
            const completion = python.namespace.pyconsole.complete(e.data.command).toJs()[0];
            postMessage({type: 'completion', completion})
            break;
        case 'clear':
            python.namespace.clear_console();
            break;
        case 'buffer':
            stdinbuffer = new Int32Array(e.data.buffer);
            return;
    }
    postMessage({type: 'ready'})
}

const python = new Python()
