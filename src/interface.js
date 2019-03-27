function Interface(_root, fonts, options) {

    var types = {
            "fontsize": "slider",
            "lineheight": "slider",
            "letterspacing": "slider",
            "fontfamily": "dropdown"
        },
        root = null,
        tester = null

    function init() {
        console.log("init interface on", root, "with options", options)

        root = _root

        var nodes = root.childNodes

        for (key in types) {
            var element = false

            if (options.generateDOM) {
                element = setupElement(options[key], options)
            } else {
                element = root.querySelector("[data-property='" + key + "']")
            }

            if (element) {
                element.addEventListener("change", onChange)
            }
        }

        tester = root.querySelector("[data-property='tester']")
        console.log("TESTER", tester)
        if (!tester) {
            tester = document.createElement("div")
            var attr = {
                "autocomplete": "off",
                "autocorrect": "off",
                "autocapitalize": "off",
                "spellcheck": "false",
            }
            for (a in attr) {
                tester.setAttribute(a, attr[a])
            }
            tester.setAttribute("contenteditable", options.tester.editable)

            tester.dataset.property = "tester"

            // If the original root element was a single DOM element with some text, copy that
            // text into the tester
            if (options.initialText) {
                tester.append(document.createTextNode(options.initialText))
            } else if (root.childNodes.length === 1 && root.childNodes[0].nodeType === Node.TEXT_NODE && !options.initialText) {
                tester.append(document.createTextNode(root.childNodes[0].textContent))
            }

            // If the original root element had only a single text node, replace it with the tester
            // otherwise append the tester element
            if (root.childNodes.length !== 1) {
                root.append(tester)
            } else if (root.childNodes.length === 1) {
                root.replaceChild(tester, root.childNodes[0])
            }
        }
    }

    function setupElement(opt) {
        console.log("setupElement", opt)
        var element = root.querySelector(opt.selector)

        if (element) {
            // TODO validate init values, data-property etc.
            console.log("SKIP EXISTING DOM ELEMENT", key)
        } else {
            if (types[key] === "slider") {
                if (opt["label"]) {
                    root.append(generateLabel(opt["label"], opt["unit"], opt["init"], key))
                }
                element = generateSlider(key, opt)
                root.append(element)
            } else if (types[key] === "dropdown") {
                if (opt["label"]) {
                    root.append(generateLabel(opt["label"], opt["unit"], opt["init"], key))
                }
                element = generateDropdown(key, opt)
                root.append(element)
            }
        }

        return element
    }

    function generateLabel(labelText, labelUnit, labelValue, relatedInput) {
        var label = document.createElement("label")
        label.setAttribute("for", relatedInput)
        label.appendChild(document.createTextNode(labelText))

        var display = document.createElement("span")
        display.className = "value"
        if (labelUnit && labelValue) {
            display.appendChild(document.createTextNode(labelValue + " " + labelUnit))
        }
        label.appendChild(display)

        return label
    }

    function generateSlider(key, opt) {
        var input = document.createElement("input")

        input.setAttribute("type", "range")
        input.setAttribute("min", opt.min)
        input.setAttribute("max", opt.max)
        input.setAttribute("step", opt.step)
        input.dataset.property = key
        input.setAttribute("autocomplete", "off")
        input.value = opt.init
        if (opt.unit) {
            input.dataset.unit = opt.unit
        }

        return input
    }

    function generateDropdown(key, opt) {
        var dropdown = document.createElement("select")

        dropdown.setAttribute("value", name)
        // dropdown.setAttribute("class", opt.selector)
        dropdown.dataset.property = key

        console.log("DROPDOWN", fonts)

        for (index in fonts) {
            var option = document.createElement("option")

            option.value = fonts[index].name
            option.appendChild(document.createTextNode(fonts[index].name))
            dropdown.appendChild(option)
        }

        return dropdown
    }

    function onChange(e) {
        console.log("change", e)
        console.log(e.currentTarget.dataset.property)

        var property = e.currentTarget.dataset.property,
            customEvent = new CustomEvent("fontsampler.on" + property + "changed"),
            label = root.querySelector("label[for='" + property + "'] .value")

        if (label) {
            label.innerText = getCSSValue(property)
        }

        root.dispatchEvent(customEvent)
    }

    function getValue(property) {
        console.log("getValue", property)
        var element = root.querySelector("[data-property='" + property + "']")

        return element.value
    }

    function getCSSValue(property) {
        var element = root.querySelector("[data-property='" + property + "']")

        return element.value + element.dataset.unit
    }

    function setInput(attr, val) {
        console.log("Fontsampler.interface.setInput", attr, val, tester)
        tester.style[attr] = val
    }

    return {
        init: init,
        getValue: getValue,
        getCSSValue: getCSSValue,
        setInput: setInput
    }
}

module.exports = Interface