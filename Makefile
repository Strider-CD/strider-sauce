JADE = $(shell find templates/*.jade)
HTML = $(JADE:.jade=.html)

all: $(HTML)

%.html: %.jade
	jade < $< --path $< > $@

clean:
	rm -f $(HTML)

.PHONY: clean
