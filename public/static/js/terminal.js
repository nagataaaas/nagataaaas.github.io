"use strict";

// https://pyodide.org/en/stable/console.html
// https://www.youtube.com/watch?v=-SggWFS15Do
// こちらのコードを参考にしています
window.onload = () => {
    const python = new Worker('/static/js/python_worker.js');
    let buffer = new SharedArrayBuffer(1024 * 1024);  // 1MB of shared memory
    let bufferInt = new Int32Array(buffer);
    bufferInt[0] = -1;
    python.postMessage({type: 'buffer', buffer});

    let ready = false;
    let inputBlocked = false;
    let completion_callback = null;
    let unlock;

    class Terminal {
        constructor() {
            this.init();
        }

        init() {
            const newConsole = document.getElementById("terminal-window");
            $(newConsole).draggable({
                handle: ".header",
                scroll: false,
            });
            $(newConsole).resizable({
                minHeight: 200,
                minWidth: 300,
                maxHeight: 600,
                maxWidth: 800
            });
        }
    }

    python.onmessage = (e) => {
        switch (e.data.type) {
            case 'prompt':
                term.set_prompt(e.data.prompt);
                break;
            case 'error':
                term.error(e.data.error);
                break;
            case 'print':
                term.echo(e.data.text);
                break
            case 'echo':
                term.echo(e.data.text, {newline: false});
                break
            case 'ready':
                ready = true;
                break;
            case 'completion':
                if (completion_callback) completion_callback(e.data.completion);
                break;
            case 'input':
                if (inputBlocked) return;
                inputBlocked = true;
        }
        if (unlock) {
            unlock();
            unlock = null;
        }

    }

    const terminal = new Terminal();

    $(document).on('click', 'button.run-button', async function (e) {
        console.log("run button clicked");
        while (!ready) {
            await sleep(100);
        }
        document.getElementById("terminal-window").classList.remove("hidden");
        const code = e.target.nextElementSibling.innerText;

        unlock && unlock();

        for (const c of code.split("\n")) {
            if (c.startsWith('#')) continue;

            term.exec(c)
        }
    })

    function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async function lock() {
        let resolve;
        const _ready = term.ready;
        term.ready = new Promise((res) => (resolve = res));
        await _ready;
        return resolve;
    }


    async function interpreter(command) {
        unlock = await lock();
        term.pause();
        console.debug(inputBlocked, command)
        if (inputBlocked) {
            handleInput(command);
            inputBlocked = false;
        } else {
            python.postMessage({'type': 'exec', 'command': command});
        }
        term.resume();
        await sleep(30);
    }

    const handleInput = (command) => {
        if (buffer && bufferInt) {
            let startingIndex = 1
            if (bufferInt[0] > 0) {
                startingIndex = bufferInt[0]
            }
            const data = new TextEncoder().encode(command)
            data.forEach((value, index) => {
                bufferInt[startingIndex + index] = value
            })

            bufferInt[0] = startingIndex + data.length - 1
            Atomics.notify(bufferInt, 0, 1)
        }
    }

    const term = $(document.getElementById('terminal')).terminal(interpreter, {
        greetings: [
            'Welcome to the Pyodide terminal emulator 🐍',
            'Python 3.10.2 (main, Apr  9 2022 20:52:01) on WebAssembly VM',
            'Type "help", "copyright", "credits" or "license" for more information.'
        ].join('\n'),
        prompt: ">>> ",
        completionEscape: false,
        completion: function (command, callback) {
            completion_callback = callback;
            python.postMessage({'type': 'completion', 'command': command});
        },
        keymap: {
            "CTRL+C": async function (event, original) {
                python.postMessage({'type': 'clear'});
                term.echo_command();
                term.echo("KeyboardInterrupt");
                term.set_command("");
                term.set_prompt(">>> ");
            },
            "TAB": (event, original) => {
                const command = term.before_cursor();
                // Disable completion for whitespaces.
                if (command.trim() === "") {
                    term.insert("\t");
                    return false;
                }
                return original(event);
            }
        },
    });

}

const closeConsole = () => {
    document.getElementById("terminal-window").classList.add("hidden");
}