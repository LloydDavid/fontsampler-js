/**
 * A wrapper around the Fontsampler interface
 * 
 * 
 * Generally, the DOM is structured in such a way:
 * 
 * Each nested Array in ´order´ is enclosed in a
 * 
 * .fsjs-wrapper
 * 
 * In each (optional, e.g. without Array straight output) wrapper one more more:
 * 
 *  [data-fsjs-block=_property_].fsjs-block .fsjs-block-_property_ .fsjs-block-type-_type_
 * 
 * Nested in each block a variety of sub elements:
 *      Optional label with:
 *      [data-for=_property_].fsjs-label
 *          [data-label-text=_property_].fsjs-label-text
 *          [data-label-value=_property_].fsjs-label-value (optional)
 *          [data-label-unit=_property_].fsjs-label-unit (optional)
 * 
 *      The actual ui control (input, select, buttongroup)
 *      [data-fsjs=_property_].fsjs-element-_property_
 * 
 */

var UIElements = require("./uielements")
var helpers = require("./helpers")
var errors = require("./errors")
var selection = require("./selection")

function Interface(_root, fonts, options) {

    var ui = {
            tester: "textfield",
            fontsize: "slider",
            lineheight: "slider",
            letterspacing: "slider",
            fontfamily: "dropdown",
            alignment: "buttongroup",
            direction: "buttongroup",
            language: "dropdown",
            opentype: "checkboxes"
        },
        keyToCss = {
            "fontsize": "fontSize",
            "lineheight": "lineHeight",
            "letterspacing": "letterSpacing"
        },
        blocks = {},
        root = null,
        uifactory = null,
        originalText = ""

    function init() {
        console.debug("Fontsampler.Interface.init()", _root, fonts, options)

        root = _root
        helpers.nodeAddClass(root, options.classes.rootClass)
        uifactory = UIElements(root, options)

        // The fontfamily is just being defined without the options, which
        // are the fonts passed in. let’s make this transformation behind
        // the scenes so we can use the re-usable "dropdown" ui
        options.ui.fontfamily.choices = fonts.map(function(value) {
            return value.name
        })

        // Before modifying the root node, detect if it is containing only
        // text, and if so, store it to the options for later use
        if (root.childNodes.length === 1 && root.childNodes[0].nodeType === Node.TEXT_NODE) {
            originalText = root.childNodes[0].textContent
            root.removeChild(root.childNodes[0])
        }
        options.originalText = originalText

        // If no valid UI order is passed in fall back to the ui elements
        // Their order might be random, but it ensures each required element
        // is at least present
        if (!options.order || !Array.isArray(options.order)) {
            options.order = Object.keys(ui)
        }

        // Process the possible nested arrays in order one by one
        // · Existing DOM nodes will be validated and initiated
        // · UI elements defined via options but missing from the DOM will be created
        // · UI elements defined in ui option but not in order option will be 
        //   appended in the end
        // · Items neither in the DOM nor in options are skipped
        for (var i = 0; i < options.order.length; i++) {
            var elementA = parseOrder(options.order[i])
            if (helpers.isNode(elementA) && elementA.childNodes.length > 0) {
                root.appendChild(elementA)
            }
        }
        for (var keyB in options.ui) {
            if (options.ui.hasOwnProperty(keyB)) {
                if (keyB in blocks === false) {
                    var elementB = parseOrder(options.ui[keyB])
                    if (helpers.isNode(elementB) && elementB.childNodes.length > 0) {
                        root.appendChild(elementB)
                    }
                }
            }
        }

        // after all nodes are instantiated, update the tester to reflect
        // the current state
        for (var keyC in blocks) {
            if (blocks.hasOwnProperty(keyC)) {
                initBlock(keyC)
            }
        }

        // prevent line breaks on single line instances
        if (!options.multiline) {
            var typeEvents = ["keypress", "keyup", "change", "paste"]
            for (var e in typeEvents) {
                if (typeEvents.hasOwnProperty(e)) {
                    blocks.tester.addEventListener(typeEvents[e], onKey)
                }
            }
        }

        // prevent pasting styled content
        blocks.tester.addEventListener('paste', function(e) {
            e.preventDefault();
            var text = '';
            if (e.clipboardData || e.originalEvent.clipboardData) {
                text = (e.originalEvent || e).clipboardData.getData('text/plain');
            } else if (window.clipboardData) {
                text = window.clipboardData.getData('Text');
            }

            if (!options.multiline) {
                text = text.replace(/(?:\r\n|\r|\n|<br>)/g, ' ')
            }

            if (document.queryCommandSupported('insertText')) {
                document.execCommand('insertText', false, text);
            } else {
                document.execCommand('paste', false, text);
            }
        });
    }

    /**
     * Recursively go through an element in the options.order
     * @param string key
     * @param node parent
     */
    function parseOrder(key) {
        var child, wrapper

        if (typeof(key) === "string") {
            var block = parseBlock(key)
            if (block) {
                blocks[key] = block
            }

            return block
        } else if (Array.isArray(key)) {
            wrapper = document.createElement("div")
            wrapper.className = options.classes.wrapperClass

            for (var i = 0; i < key.length; i++) {
                child = parseOrder(key[i])
                if (child) {
                    wrapper.appendChild(child)
                }
            }

            return wrapper
        } else {
            // Skipping not defined UI element

            return false
        }
    }

    /**
     * Parse an UI element from DOM or options
     * @param string item 
     * @return node || boolean (true = in DOM, false = invalid item)
     */
    function parseBlock(key) {
        if (key in ui === false) {
            throw new Error(errors.invalidUIItem + key)
        }

        // check if a block exists
        // yes > check it has a element
        //      yes > validate & fix element
        //          validate & fix block
        //      no > make block
        // no > make block

        var block = getBlock(key),
            element = false,
            label = false

        if (block) {
            element = getElement(key, block)
            label = getLabel(key, block)

            if (options.ui[key].label && !label) {
                label = uifactory.label(opt.label, opt.unit, opt.init, key)
                block.appendChild(label)
                sanitizeLabel(label, key)
            }
            if (!element) {
                element = createElement(key)
                block.appendChild(element)
                sanitizeElement(element, key)
            }
            sanitizeBlock(block, key)

            return block
        } else if (!block && options.generate) {

            return createBlock(key)
        }

        return false
    }

    function createBlock(key) {
        var block = document.createElement("div"),
            element = createElement(key),
            label = false
            opt = options.ui[key]

        if (opt.label) {
            label = uifactory.label(opt.label, opt.unit, opt.init, key)
            block.append(label)
            sanitizeLabel(label, key)
        }
        
        block.append(element)
        sanitizeElement(element, key)
        
        sanitizeBlock(block, key)
        
        return block
    }

    function createElement(key) {
        var element = uifactory[ui[key]](key, options.ui[key])
        sanitizeElement(element, key)

        return element
    }

    function sanitizeBlock(block, key) {
        var classes = [
            options.classes.blockClass,
            options.classes.blockClass + "-" + key,
            options.classes.blockClass + "-type-" + ui[key]
        ]

        helpers.nodeAddClasses(block, classes)
        block.dataset.fsjsBlock = key
    }

    function sanitizeElement(element, key) {
        uifactory[ui[key]](key, options.ui[key], element)
    }

    function sanitizeLabel(label, key) {
        var text = label.querySelector("." + options.classes.labelTextClass),
            value = label.querySelector("." + options.classes.labelValueClass),
            unit = label.querySelector("." + options.classes.labelUnitClass)

        if (text && text.textContent === "") {
            text.textContent = opt.label
        }

        if (value && value.textContent === "") {
            // If set in already set in DOM the above validate will have set it
            value.textContent = uielement.value
        }

        if (unit && unit.textContent === "") {
            // If set in already set in DOM the above validate will have set it
            unit.textContent = uielement.dataset.unit
        }
    }

    /**
     * Init a UI element with values (update DOM to options)
     * @param node node 
     * @param object opt 
     * @return boolean
     */
    function initBlock(key) {
        // TODO set values if passed in and different on node
        var block = getBlock(key),
            element = getElement(key, block),
            type = ui[key],
            opt = options.ui[key]

        if (type === "slider") {
            element.addEventListener("change", onChange)
            element.val = opt.init
            setInputCss(keyToCss[key], opt.init + opt.unit)
        } else if (type === "dropdown") {
            element.addEventListener("change", onChange)
            // TODO init values to tester
        } else if (type === "buttongroup") {
            var buttons = element.querySelectorAll("[data-choice]")

            if (buttons.length > 0) {
                for (var b = 0; b < buttons.length; b++) {
                    buttons[b].addEventListener("click", onClick)
                }
            }

            // TODO init values to tester
        } else if (type === "checkboxes") {
            var checkboxes = element.querySelectorAll("[data-feature]")
            if (checkboxes.length > 0) {
                for (var c = 0; c < checkboxes.length; c++) {
                    checkboxes[c].addEventListener("change", onCheck)
                }
            }

            // TODO init values to tester
        }

        return true
    }

    function getElement(key, node) {
        if (typeof(node) === "undefined") {
            node = root
        }
        var element = root.querySelector("[data-fsjs='" + key + "']")

        return helpers.isNode(element) ? element : false
    }

    function getBlock(key, node) {
        if (typeof(node) === "undefined") {
            node = root
        }
        var block = root.querySelector("[data-fsjs-block='" + key + "']")

        return helpers.isNode(block) ? block : false
    }

    /**
     * Catch-all UI element event listener firing a scoped CustomEvent based
     * on the element’s property
     * @param {*} e 
     */
    function onChange(e) {
        var property = e.target.dataset.fsjs

        sendEvent(property)
    }

    function onCheck() {
        // Currently this is only used for opentype checkboxes
        var property = "opentype"

        sendEvent(property)
    }

    /**
     * Currently only reacting to buttongroup nested buttons’ clicks
     * @param {*} e 
     */
    function onClick(e) {
        var parent = e.currentTarget.parentNode,
            property = parent.dataset.fsjs,
            // customEvent = new CustomEvent("fontsampler.on" + property + "clicked"),
            buttons = parent.querySelectorAll("[data-choice]")

        if (property in ui && ui[property] === "buttongroup") {
            for (var b = 0; b < buttons.length; b++) {
                helpers.nodeRemoveClass(buttons[b], options.classes.buttonSelected)
            }
            helpers.nodeAddClass(e.currentTarget, options.classes.buttonSelected)

            sendEvent(property)
        }
    }

    function sendEvent(type) {
        root.dispatchEvent(new CustomEvent("fontsampler.on" + type + "changed"))
    }

    function onKey(event) {
        if (event.type === "keypress") {
            // for keypress events immediately block pressing enter for line break
            if (event.keyCode === 13) {
                event.preventDefault()
                return false;
            }
        } else {
            // allow other events, filter any html with $.text() and replace linebreaks
            // TODO fix paste event from setting the caret to the front of the non-input non-textarea
            var text = blocks.tester.textContent,
                hasLinebreaks = text.indexOf("\n")

            if (-1 !== hasLinebreaks) {
                blocks.tester.innerHTML(text.replace('/\n/gi', ''));
                selection.setCaret(blocks.tester, blocks.tester.textContent.length, 0);
            }
        }
    }

    /**
     * Get a UI element value
     * @param {*} property 
     */
    function getValue(property) {
        var element = getElement(property)

        if (element) {
            return element.value
        } else {
            return false
        }
    }

    /**
     * Get a UI element value with CSS unit
     * @param {*} property 
     */
    function getCssValue(property) {
        var element = getElement(property)

        return element ? element.value + element.dataset.unit : ""
    }

    function getOpentype() {
        if (!blocks.opentype) {
            return false
        }

        var features = blocks.opentype.querySelectorAll("[data-feature]")

        if (features) {
            var re = {}

            for (var f = 0; f < features.length; f++) {
                var input = features[f]
                re[input.dataset.feature] = input.checked
            }

            return re
        }
    }

    function getButtongroupValue(key) {
        var element = getElement(key),
            selected

        if (element) {
            selected = element.querySelector("." + options.classes.buttonSelected)
        }

        if (selected) {
            return selected.dataset.choice
        } else {
            return ""
        }
    }

    function getCssAttrForKey(key) {
        if (key in keyToCss) {
            return keyToCss[key]
        }

        return false
    }

    function getKeyForCssAttr(attr) {
        for (var key in keyToCss) {
            if (keyToCss.hasOwnProperty(key)) {
                if (keyToCss[key] === attr) {
                    return key
                }
            }
        }

        return false
    }

    /**
     * Set the tester’s text
     * @param {*} attr 
     * @param {*} val 
     */
    function setInputCss(attr, val) {
        blocks.tester.style[attr] = val
    }

    function setInputAttr(attr, val) {
        blocks.tester.setAttribute(attr, val)
    }

    function setInputOpentype(features) {
        var parsed = [],
            val
        for (var key in features) {
            if (features.hasOwnProperty(key)) {
                parsed.push('"' + key + '" ' + (features[key] ? "1" : "0"))
            }
        }
        val = parsed.join(",")

        blocks.tester.style["font-feature-settings"] = val
    }

    function setInputText(text) {
        if (text && blocks.tester) {
            blocks.tester.textContent = text
        }
    }

    function setStatusClass(classString, status) {
        if (status === true) {
            helpers.nodeAddClass(root, classString)
        } else if (status === false) {
            helpers.nodeRemoveClass(root, classString)
        }
    }

    return {
        init: init,
        getValue: getValue,
        getCssValue: getCssValue,
        getButtongroupValue: getButtongroupValue,
        getOpentype: getOpentype,
        getCssAttrForKey: getCssAttrForKey,
        getKeyForCssAttr: getKeyForCssAttr,
        setInputCss: setInputCss,
        setInputAttr: setInputAttr,
        setInputOpentype: setInputOpentype,
        setInputText: setInputText,
        setStatusClass: setStatusClass
    }
}
module.exports = Interface