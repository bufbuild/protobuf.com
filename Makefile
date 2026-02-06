SHELL := /usr/bin/env bash -o pipefail

UNAME_OS := $(shell uname -s)

ifeq ($(UNAME_OS),Darwin)
SED_I := sed -i ''
else
SED_I := sed -i
endif

.DEFAULT_GOAL := all

.PHONY: all
all: run

.PHONY: install
install:
	npm install

.PHONY: build
build: install
	rm -rf build
	npm run build

.PHONY: serve
serve: build
	npm run serve

.PHONY: start
start:
	npm run start

.PHONY: run
run: install
	npm run start

.PHONY: update
upgrade:
	npm update

.PHONY: clean
clean:
	git clean -xdf

.PHONY: lint
lint: npmlint npmchecktypes

.PHONY: npmlint
npmlint:
	npm run lint

.PHONY: npmchecktypes
npmchecktypes:
	npm run check:types
