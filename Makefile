.PHONY: build

build:
	-python3 create_html.py
	-python create_html.py

up: build
	python -m http.server 8888 --directory docs
