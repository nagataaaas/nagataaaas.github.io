const pythonClassName = 'lang-python';

const sendEnter = (editor) => {
    editor.dispatchEvent(new KeyboardEvent("keypress", {keyCode: 13}));
}