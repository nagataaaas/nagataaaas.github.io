.PHONY: build

build:
	python create_html.py

up: build
	python server.py
