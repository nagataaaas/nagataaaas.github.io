import glob
import pathlib

import datetime

import os


def put_run(text):
    return text.replace('<pre><code', '<pre><button class="run-button">RUN</button><code')


if __name__ == '__main__':
    with open('pure_html/template.html', 'r', encoding='utf-8') as f:
        template = f.read()
    for file in glob.glob('pure_html/*.html'):
        if 'template' in file:
            continue
        with open(file, 'r', encoding='utf-8') as f:
            data = f.read()
            tmp = template
            tmp = tmp.replace('{{update}}', datetime.datetime.fromtimestamp(pathlib.Path(file).stat().st_mtime)
                              .strftime('%m/%d/%Y'))
            tmp = tmp.replace('{{content}}', data)
            tmp = put_run(tmp)
        with open(os.path.basename(file), 'w', encoding='utf-8') as f:
            f.write(tmp)
