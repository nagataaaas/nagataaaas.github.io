.PHONY: build

build:
	C:/Users/nagata/AppData/Local/Programs/Python/Python39/python create_html.py

up: build
	python -m http.server 8888 --directory public
