import datetime
import os
import shutil
import pathlib
import sass

import markdown

with open('templates/template.html', 'r', encoding='utf-8') as f:
    template = f.read()


class Page:
    def __init__(self, path: str):
        self.path = path
        filename = path.split('/')[-1]
        self.title = filename.split('.')[1]
        self.data = self.read_md()

    def read_md(self) -> str:
        with open(self.path, 'r', encoding='utf-8') as f:
            data = f.read()
        return markdown.Markdown(extensions=['extra', 'codehilite', 'meta', 'toc']).convert(data)

    def convert_html(self, navigate: str) -> str:
        template_with_timestamp = template.replace('{{update}}',
                                                   datetime.datetime.fromtimestamp(
                                                       pathlib.Path(self.path).stat().st_mtime)
                                                   .strftime('%m/%d/%Y'))
        data = template_with_timestamp.replace('{{content}}', self.data)
        data = self.specify_language(data)
        data = self.place_navigate(data, navigate)
        return data

    @staticmethod
    def specify_language(code: str) -> str:
        return code.replace('<pre>', '<pre class="language-python">')

    @staticmethod
    def place_navigate(data: str, navigate: str) -> str:
        return data.replace('{{navigate}}', navigate)

    def save_html(self, path: pathlib.Path, navigate: str):
        with path.open('w', encoding='utf-8') as f:
            f.write(self.convert_html(navigate))


class Section:
    def __init__(self, path: str, ):
        self.path = path
        filename = path.split('/')[-1]
        self.name = filename.split('.')[1]
        self.pages: list[Page] = []

    @property
    def first_path(self) -> str:
        return f'{self.name}/{self.pages[0].title}.html'


class Chapter:
    def __init__(self, path: str):
        self.path = path
        filename = path.split('/')[-1]
        self.name = filename.split('.')[1]
        self.sections: list[Section] = []

    @property
    def first_path(self) -> str:
        return f'{self.name}/{self.sections[0].first_path}'


def generate(chapters: list[Chapter], tree: list[Chapter]):
    docs = pathlib.Path('docs')
    docs.mkdir(exist_ok=True)
    chapters[0].sections[0].pages[0].save_html(docs / 'index.html',
                                               create_navigate(tree, tree[0].sections[0].pages[0]))
    for c in chapters:
        chap_path = docs / c.name
        chap_path.mkdir(parents=True, exist_ok=True)
        for s in c.sections:
            sec_path = chap_path / s.name
            sec_path.mkdir(parents=True, exist_ok=True)
            for p in s.pages:
                p.save_html(sec_path / f'{p.title}.html', create_navigate(tree, p))


def get_tree() -> list[Chapter]:
    chapters = []
    for chapter in sorted(os.listdir('md')):
        chapter = Chapter(f'md/{chapter}')
        for section in os.listdir(chapter.path):
            section = Section(f'{chapter.path}/{section}')
            for file in os.listdir(section.path):
                page = Page(f'{section.path}/{file}')
                section.pages.append(page)
            chapter.sections.append(section)
        chapters.append(chapter)
    return chapters


def create_navigate(chapters: list[Chapter], current: Page) -> str:
    navigate = ''
    for c in chapters:
        navigate += f'<span class="chapter"><a href="/{c.first_path}">{c.name}</a></span>\n'
        for s in c.sections:
            navigate += f'<span class="section"><a href="/{c.name}/{s.first_path}">{s.name}</a></span>\n'
            if current in s.pages:
                for p in s.pages:
                    navigate += f'<span class="page{" selected" if p == current else ""}"><a href="/{c.name}/{s.name}/{p.title}.html">{p.title}</a></span>\n'
    return navigate


def compile_scss():
    sass.compile(dirname=('static/scss', 'static/css'), output_style='compressed')


def copy_static():
    shutil.copytree('static/css', 'docs/static/css')
    shutil.copytree('static/js', 'docs/static/js')
    shutil.copytree('static/cdn', 'docs/static/cdn')


if __name__ == '__main__':
    if os.path.exists('docs'):
        shutil.rmtree('docs')
    tree = get_tree()
    generate(tree, tree)
    compile_scss()
    copy_static()
