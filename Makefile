.PHONY: build

build:
	python create_html.py

up: build
	python -m http.server 8888 --directory python
