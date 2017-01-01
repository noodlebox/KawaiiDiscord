// ==UserScript==
// @name         KawaiiDiscord
// @namespace    https://files.noodlebox.moe/
// @downloadURL  https://files.noodlebox.moe/userscripts/KawaiiDiscord.user.js
// @version      0.8.4
// @description  Break SFMLab Chat (now for Discord!)
// @author       noodlebox
// @require      https://code.jquery.com/jquery-3.1.1.min.js
// @require      https://cdn.jsdelivr.net/lodash/4.17.2/lodash.min.js
// @match        *://*.discordapp.com/channels/*
// @match        *://*.discordapp.com/invite/*
// @match        *://*.discordapp.com/login
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function ($, _) {
    "use strict";

    // Emote data
    var EmoteSet = function () {
        this.emoteMap = new Map();
        this.template = "";
        this.caseSensitive = true;
        this.rolls = false;
        this.emoteStyle = EmoteSet.emoteStyle.STANDARD;
    };
    // emoteStyle enum
    EmoteSet.emoteStyle = {
        STANDARD: 0, // Surrounded by ":"
        TWITCH: 1, // Composed of "word characters" (\w)
    };
    // template field names enum
    EmoteSet.templateField = {
        PATH: 0, // The unique path component for this emote name
        SIZE: 1, // emote size, usually a single digit between 1 and 4
    };
    EmoteSet.prototype.load = $.noop;
    EmoteSet.prototype.getUrl = function (emoteName, seed) {
        if (!this.caseSensitive) {
            emoteName = emoteName.toLowerCase();
        }
        if (this.rolls) {
            const options = {
                start: !emoteName.startsWith("*"),
                end: !emoteName.endsWith("*") && !emoteName.endsWith("#"),
                numeric: emoteName.endsWith("#"),
            };
            if (!options.start || !options.end) {
                const startPos = options.start ? 0 : 1;
                const endPos = options.end ? emoteName.length : -1;
                const query = emoteName.slice(startPos, endPos);
                var table = this.search(query, options).sort();
                if (table.length === 0) {
                    return undefined;
                }
                if (seed === undefined || seed === 0) {
                    emoteName = this.rollDefault;
                } else {
                    emoteName = table[seed % table.length][0];
                }
            }
        }
        var path = this.emoteMap.get(emoteName);
        if (path === undefined) {
            return undefined;
        }
        return this.template.replace(/{(\d+)}/g, function (match, field) {
            switch (Number(field)) {
                case EmoteSet.templateField.PATH:
                    return path;
                case EmoteSet.templateField.SIZE:
                    return "1";
                default:
                    return match;
            }
        });
    };
    // Create and return an emote element, or undefined if no match found
    EmoteSet.prototype.createEmote = function (emoteName, seed) {
        var emoteURL = this.getUrl(emoteName, seed);
        if (emoteURL === undefined) {
            return undefined;
        }
        if (this.emoteStyle === EmoteSet.emoteStyle.STANDARD) {
            emoteName = ":"+emoteName+":";
        }
        // TODO: Apply special style to rolled emotes
        var emote = $("<img>", {
            src: emoteURL,
            draggable: "false",
            alt: emoteName,
            title: emoteName,
            class: "emoji kawaii-parseemotes",
        });
        return emote;
    };
    EmoteSet.prototype.search = function (query, {start=false, end=false, numeric=false} = {}) {
        const prefix = start ? "^" : "";
        const suffix = end ? "$" : numeric ? "\\d*$" : "";
        const queryExp = new RegExp(prefix + _.escapeRegExp(query) + suffix, "i");

        const score = function (name) {
            const d = name.length - query.length;
            const res = queryExp.exec(name);
            if (res === null) {
                return 0;
            }
            const i = res.index;
            return 1 + (i+1)*(d-i+2);
        };
        return [...this.emoteMap.keys()]
            .map(e => [e, score(e)])
            .filter(e => e[1] !== 0);
    };

    // Regex breakdown:
    // $1 - /(^|\s)/ - Starting from the beginning of the string, or following any whitespace
    //    - /(?!.{0,2}$)/ - not shorter than 3 characters
    // $2 - /(:?)/ - the initial colon in standard emotes
    // $3 - /(([*])?(\w+)([*#])?)/ - emote text ($5), optionally preceded ($4) or followed ($6) by wildcards
    const completeAnyRegex = /(^|\s)(?!.{0,2}$)(:?)(([*])?(\w+)([*#])?)$/;
    const completeStandardRegex = /(^|\s)(?!.{0,2}$):(([*])?(\w+)([*#])?)$/;
    const completeTwitchRegex = /(^|\s)(?!.{0,2}$)(([*])?(\w+)([*#])?)$/;

    const emoteComparator = (function () {
        const compare = new Intl.Collator(undefined, {
            usage: "sort",
            sensitivity: "base",
            numeric: true,
        }).compare;

        return (a,b) => ((a[1]===b[1]) ? compare(a[0],b[0]) : (a[1]-b[1]));
    })();

    function getCompletions(emoteSets, text) {
        const match = completeAnyRegex.exec(text);
        if (match === null) {
            return {completions: [], matchText: null, matchStart: -1};
        }
        // If emote begins with a colon, use "standard" sets; otherwise, use "twitch" sets
        const emoteStyle = (match[2] === ":") ? EmoteSet.emoteStyle.STANDARD : EmoteSet.emoteStyle.TWITCH;

        // If this is a "roll", only use sets allowing them and search based on wildcards
        // otherwise, search for matches normally
        const rolling = match[4] !== undefined || match[6] !== undefined;

        // Prepare search options
        const options = {
            start: rolling && match[4] === undefined,
            end: rolling && match[6] === undefined,
            numeric: rolling && match[6] === "#",
        };

        const completions = emoteSets
            .filter(s => s.emoteStyle === emoteStyle)
            .filter(s => s.rolls || !rolling)
            .map(s => s.search(match[5], options).map(e => [[":"+e[0]+":", s.createEmote.bind(s, e[0])], e[1]]))
            .reduce((a,b) => a.concat(b), [])
            .sort(emoteComparator)
            .map(e => e[0]);

        const matchText = match[2]+match[3], matchStart = match.index + match[1].length;

        return {completions, matchText, matchStart};
    }

    // Set up event handlers
    function startTabComplete(emoteSets) {
        // Cached information about possible completions
        // Conflicts should be avoidable, as this is cleared on focus loss
        let cached = {};

        let textarea;

        const windowSize = 10, preScroll = 2;

        const shouldCompleteStandard = completeStandardRegex.test.bind(completeStandardRegex);

        const shouldCompleteTwitch = completeTwitchRegex.test.bind(completeTwitchRegex);

        const shouldComplete = completeAnyRegex.test.bind(completeAnyRegex);

        // Show possible completions
        let renderCompletions = _.debounce(function () {
            const channelTextarea = $(textarea).closest(".channel-textarea");
            const oldAutocomplete = channelTextarea.children(".kawaii-autocomplete");

            const candidateText = textarea.value.slice(0, textarea.selectionEnd);
            if (!shouldComplete(candidateText) || !prepareCompletions()) {
                oldAutocomplete.remove();
                return;
            }

            const {completions, matchText, selectedIndex, windowOffset: firstIndex} = cached;

            const matchList = completions.slice(firstIndex, firstIndex+windowSize);

            const autocomplete = $("<div>", {
                "class": "channel-textarea-autocomplete kawaii-autocomplete",
                css: {display: "block"},
            });
            const autocompleteInner = $("<div>", {"class": "channel-textarea-autocomplete-inner"})
                .on("wheel.kawaii-complete", _.partial(scrollCompletions, _, {locked: true}))
                .appendTo(autocomplete);
            $("<header>")
                .append($("<div>", {text: "Emotes matching "}).append($("<strong>", {text: matchText})))
                .appendTo(autocompleteInner);
            $("<ul>")
                .append(matchList.map((e,i) => {
                    let li = $("<li>", {text: e[0]}).prepend(e[1]());
                    if (i+firstIndex === selectedIndex) {
                        li.addClass("active");
                    }
                    li.on("mouseenter.kawaii-complete", e => {
                        cached.selectedIndex = i+firstIndex;
                        li.siblings(".active").removeClass("active");
                        li.addClass("active");
                    }).on("mousedown.kawaii-complete", e => {
                        cached.selectedIndex = i+firstIndex;
                        insertSelectedCompletion();
                        // Prevent loss of focus
                        e.preventDefault();
                    });
                    return li;
                }))
                .appendTo(autocompleteInner);

            oldAutocomplete.remove();

            channelTextarea
                .append(autocomplete);
        }, 250);

        // Scroll through the "window" of completions
        function scrollWindow(delta, {locked=false, clamped=false} = {}) {
            const {completions, selectedIndex: prevSel, windowOffset} = cached;

            if (completions === undefined || completions.length === 0) {
                return;
            }

            // Change selected index
            const num = completions.length;
            let sel = prevSel + delta;
            if (clamped) {
                sel = _.clamp(sel, 0, num-1);
            } else {
                sel = (sel % num) + (sel<0 ? num : 0);
            }
            cached.selectedIndex = sel;

            // Clamp window position to bounds based on new selected index
            const boundLower = _.clamp(sel + preScroll - (windowSize-1), 0, num-windowSize);
            const boundUpper = _.clamp(sel - preScroll, 0, num-windowSize);
            cached.windowOffset = _.clamp(windowOffset + (locked ? delta : 0), boundLower, boundUpper);

            // Render immediately
            renderCompletions();
            renderCompletions.flush();
        }

        function prepareCompletions() {
            const candidateText = textarea.value.slice(0, textarea.selectionEnd);
            const {candidateText: lastText} = cached;

            if (lastText !== candidateText) {
                const {completions, matchText, matchStart} = getCompletions(emoteSets, candidateText);
                cached = {candidateText, completions, matchText, matchStart, selectedIndex: 0, windowOffset: 0};
            }

            const {completions} = cached;
            return (completions !== undefined && completions.length !== 0);
        }

        function destroyCompletions() {
            const channelTextarea = $(textarea).closest(".channel-textarea");
            const oldAutocomplete = channelTextarea.children(".kawaii-autocomplete");
            oldAutocomplete.remove();
            cached = {};
            renderCompletions.cancel();
        }

        // Insert selected completion at cursor position
        function insertSelectedCompletion() {
            const {completions, matchStart, selectedIndex} = cached;

            if (completions === undefined) {
                return;
            }

            const left = textarea.value.slice(0, matchStart) + completions[selectedIndex][0] + " ";
            const right = textarea.value.slice(textarea.selectionEnd);

            textarea.value = left + right;
            textarea.selectionStart = textarea.selectionEnd = left.length;

            destroyCompletions();
        }

        // Check for matches (overrides TextareaAutosize's onClick, onKeyPress, onKeyUp, maybeShowAutocomplete)
        function checkCompletions(e) {
            /* jshint validthis: true */
            textarea = this;

            const candidateText = textarea.value.slice(0, textarea.selectionEnd);
            const {candidateText: lastText} = cached;

            // If an emote match is impossible, don't override default behavior.
            // This allows other completion types (like usernames or channels) to work as usual.
            if (!shouldComplete(candidateText)) {
                destroyCompletions();
                return;
            }

            // Don't override enter when there are no actual completions.
            // This allows message sending to work as usual.
            if (e.which === 13) {
                // Only potentially override enter for standard-style emotes
                if (!shouldCompleteStandard(candidateText) || !prepareCompletions()) {
                    return;
                }
            }

            // For any other key, always override, even when there are no actual completions.
            // This prevents Discord's emoji autocompletion from kicking in intermittently.
            e.stopPropagation();

            if (lastText !== candidateText) {
                renderCompletions();
            }
        }

        // Browse or insert matches (overrides ChannelTextArea's onKeyDown)
        function browseCompletions(e) {
            /* jshint validthis: true */
            textarea = this;

            const candidateText = textarea.value.slice(0, textarea.selectionEnd);
            if (!shouldComplete(candidateText)) {
                return;
            }

            let delta = 0, options;

            switch (e.which) {
                // Enter
                case 13:
                    if (!shouldCompleteStandard(candidateText)) {
                        break;
                    }
                    /* falls through */
                // Tab
                case 9:

                    if (!prepareCompletions()) {
                        break;
                    }

                    // Prevent Discord's default behavior (send message)
                    e.stopPropagation();
                    // Prevent adding a tab or line break to text
                    e.preventDefault();

                    insertSelectedCompletion();
                    break;

                // Up
                case 38:
                    delta = -1;
                    break;

                // Down
                case 40:
                    delta = 1;
                    break;

                // Page Up
                case 33:
                    delta = -windowSize;
                    options = {locked: true, clamped: true};
                    break;

                // Page Down
                case 34:
                    delta = windowSize;
                    options = {locked: true, clamped: true};
                    break;
            }

            if (delta !== 0 && prepareCompletions()) {
                // Prevent Discord's default behavior
                e.stopPropagation();
                // Prevent cursor movement
                e.preventDefault();

                scrollWindow(delta, options);
            }
        }

        // Scroll matches
        function scrollCompletions(e, options) {
            /* jshint validthis: true */
            const delta = Math.sign(e.originalEvent.deltaY);
            scrollWindow(delta, options);
        }

        // Check for matches
        $(".app").on({
            "keyup.kawaii-complete keypress.kawaii-complete click.kawaii-complete": checkCompletions,
            "keydown.kawaii-complete": browseCompletions,
            "wheel.kawaii-complete": scrollCompletions,
            "blur.kawaii-complete": destroyCompletions,
        }, ".channel-textarea textarea");
    }

    // Tear down event handlers and clean up
    function stopTabComplete() {
        $(".app").off(".kawaii-complete", ".channel-textarea textarea");
    }

    // Filter function for "Twitch-style" emotes, to avoid collisions with common words
    // Check if at least 3 word characters, and has at least one capital letter
    // Based on current FFZ naming requirements (older FFZ emotes may not satisfy these requirements)
    // See: https://www.frankerfacez.com/emoticons/submit
    function emoteFilter(name) {
        return (/^\w{3,}$/.test(name) && /[A-Z]/.test(name));
    }

    // Global Twitch emotes (emoteset 0), filtered by emoteFilter
    var twitchEmotes = new EmoteSet();
    twitchEmotes.template = "https://static-cdn.jtvnw.net/emoticons/v1/{0}/{1}.0";
    twitchEmotes.emoteStyle = EmoteSet.emoteStyle.TWITCH;
    twitchEmotes.load = function (callbacks) {
        callbacks = $.extend({
            success: $.noop,
            error: $.noop,
        }, callbacks);
        var self = this;
        // See: https://github.com/justintv/Twitch-API/blob/master/v3_resources/chat.md#get-chatemoticons
        $.ajax("https://api.twitch.tv/kraken/chat/emoticon_images?emotesets=0", {
            accepts: {json: "application/vnd.twitchtv.v3+json"},
            headers: {'Client-ID': 'a7pwjx1l6tr0ygjrzafhznzd4zgg9md'},
            dataType: "json",
            jsonp: false,
            cache: true,
            success: function (data) {
                var loaded = 0;
                var skipped = 0;
                data.emoticon_sets[0].forEach(function (emoticon) {
                    if (emoteFilter(emoticon.code)) {
                        self.emoteMap.set(emoticon.code, emoticon.id);
                        loaded++;
                    } else {
                        skipped++;
                    }
                });
                console.info("KawaiiDiscord:", "Twitch global emotes loaded:", loaded, "skipped:", skipped);
                callbacks.success(self);
            },
            error: function (xhr, textStatus, errorThrown) {
                console.warn("KawaiiDiscord:", "Twitch global emotes failed to load:", textStatus, "error:", errorThrown);
                callbacks.error(self);
            }
        });
    };

    // Twitch subscriber emotes, filtered by emoteFilter
    var twitchSubEmotes = new EmoteSet();
    twitchSubEmotes.template = "https://static-cdn.jtvnw.net/emoticons/v1/{0}/{1}.0";
    twitchSubEmotes.emoteStyle = EmoteSet.emoteStyle.TWITCH;
    twitchSubEmotes.load = function (callbacks) {
        callbacks = $.extend({
            success: $.noop,
            error: $.noop,
        }, callbacks);
        var self = this;
        // See: https://github.com/justintv/Twitch-API/blob/master/v3_resources/chat.md#get-chatemoticons
        $.ajax("https://api.twitch.tv/kraken/chat/emoticon_images", {
            accepts: {json: "application/vnd.twitchtv.v3+json"},
            headers: {'Client-ID': 'a7pwjx1l6tr0ygjrzafhznzd4zgg9md'},
            dataType: "json",
            jsonp: false,
            cache: true,
            success: function (data) {
                var loaded = 0;
                var skipped = 0;
                data.emoticons.forEach(function (emoticon) {
                    if (emoticon.emoticon_set !== null && emoteFilter(emoticon.code)) {
                        self.emoteMap.set(emoticon.code, emoticon.id);
                        loaded++;
                    } else {
                        skipped++;
                    }
                });
                console.info("KawaiiDiscord:", "Twitch subscriber emotes loaded:", loaded, "skipped:", skipped);
                callbacks.success(self);
            },
            error: function (xhr, textStatus, errorThrown) {
                console.warn("KawaiiDiscord:", "Twitch subscriber emotes failed to load:", textStatus, "error:", errorThrown);
                callbacks.error(self);
            }
        });
    };

    // SFMLab emotes, now with more rolling than ever!
    var sfmlabEmotes = new EmoteSet();
    sfmlabEmotes.template = "https://sfmlab.com/static/emoji/img/{0}";
    sfmlabEmotes.caseSensitive = false;
    sfmlabEmotes.rolls = true;
    sfmlabEmotes.rollDefault = "mikeroll";
    sfmlabEmotes.emoteStyle = EmoteSet.emoteStyle.STANDARD;
    sfmlabEmotes.load = function (callbacks) {
        callbacks = $.extend({
            success: $.noop,
            error: $.noop,
        }, callbacks);
        var self = this;
        $.ajax("https://sfmlab.com/emoji_json/", {
            dataType: "json",
            jsonp: false,
            cache: true,
            success: function (data) {
                var loaded = 0;
                var skipped = 0;
                self.template = data.template;
                data.emotes.forEach(function (emote) {
                    var fixName = emote.name.toLowerCase();
                    self.emoteMap.set(fixName, emote.url);
                    loaded++;
                });
                console.info("KawaiiDiscord:", "SFMLab emotes loaded:", loaded, "skipped:", skipped);
                callbacks.success(self);
            },
            error: function (xhr, textStatus, errorThrown) {
                console.warn("KawaiiDiscord:", "Twitch subscriber emotes failed to load:", textStatus, "error:", errorThrown);
                callbacks.error(self);
            }
        });
    };

    // This is super hackish, and will likely break as Discord's internal API changes
    // Anything using this or what it returns should be prepared to catch some exceptions
    const getInternalInstance = e => e[Object.keys(e).find(k => k.startsWith("__reactInternalInstance"))];

    function getOwnerInstance(e, {include, exclude=["Popout", "Tooltip", "Scroller", "BackgroundFlash"]} = {}) {
        if (e === undefined) {
            return undefined;
        }

        // Set up filter; if no include filter is given, match all except those in exclude
        const excluding = include === undefined;
        const filter = excluding ? exclude : include;

        // Get displayName of the React class associated with this element
        // Based on getName(), but only check for an explicit displayName
        function getDisplayName(owner) {
            const type = owner._currentElement.type;
            const constructor = owner._instance && owner._instance.constructor;
            return type.displayName || constructor && constructor.displayName || null;
        }
        // Check class name against filters
        function classFilter(owner) {
            const name = getDisplayName(owner);
            return (name !== null && !!(filter.includes(name) ^ excluding));
        }

        // Walk up the hierarchy until a proper React object is found
        for (let prev, curr=getInternalInstance(e); !_.isNil(curr); prev=curr, curr=curr._hostParent) {
            // Before checking its parent, try to find a React object for prev among renderedChildren
            // This finds React objects which don't have a direct counterpart in the DOM hierarchy
            // e.g. Message, ChannelMember, ...
            if (prev !== undefined && !_.isNil(curr._renderedChildren)) {
                /* jshint loopfunc: true */
                let owner = Object.values(curr._renderedChildren)
                    .find(v => !_.isNil(v._instance) && v.getHostNode() === prev.getHostNode());
                if (!_.isNil(owner) && classFilter(owner)) {
                    return owner._instance;
                }
            }

            if (_.isNil(curr._currentElement)) {
                continue;
            }

            // Get a React object if one corresponds to this DOM element
            // e.g. .user-popout -> UserPopout, ...
            let owner = curr._currentElement._owner;
            if (!_.isNil(owner) && classFilter(owner)) {
                return owner._instance;
            }
        }

        return null;
    }

    function getInternalProps(e) {
        if (e === undefined) {
            return undefined;
        }

        try {
            return getOwnerInstance(e).props;
        } catch (err) {
            return undefined;
        }
    }

    // Get a consistent, but unpredictable index from the message snowflake ID
    // See: https://github.com/twitter/snowflake/tree/snowflake-2010#solution
    function getMessageSeed(e) {
        try {
            // Shift (roughly) 22 bits (10^3 ~ 2^10)
            // All numbers in JS are 64-bit floats, so this is necessary to avoid a huge loss of precision
            return Number(getInternalProps(e).message.id.slice(0, -6)) >>> 2;
        } catch (err) {
            // Something (not surprisingly) broke, but this isn't critical enough to completely bail over
            console.error("getMessageSeed:", e, err);
            return 0;
        }
    }

    // jQuery Plugins

    // Get or set the scroll distance from the bottom of an element
    // Usage identical to scrollTop()
    $.fn.scrollBottom = function (val) {
        var elem = this[0];
        if (val === undefined) {
            if (elem === undefined) {
                return undefined;
            }
            return elem.scrollHeight - (this.scrollTop() + this.height());
        }
        if (elem === undefined) {
            return this;
        }
        return this.scrollTop(elem.scrollHeight - (val + this.height()));
    };

    // Get the set of text nodes contained within a set of elements
    $.fn.textNodes = function () {
        return this.map(function () {
            const textNodes = [];
            let textNodeWalker, currentNode;

            if ($(this).find("code").length > 0) {
                // If there are any code blocks, rejecting that whole subtree is a bit faster
                textNodeWalker = document.createTreeWalker(this, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
                    acceptNode: function (node) {
                        if (node.nodeType === Node.TEXT_NODE) {
                            return NodeFilter.FILTER_ACCEPT;
                        }
                        if (node.nodeName.toLowerCase() === "code") {
                            return NodeFilter.FILTER_REJECT;
                        }
                        return NodeFilter.FILTER_SKIP;
                    }
                });
            } else {
                textNodeWalker = document.createTreeWalker(this, NodeFilter.SHOW_TEXT);
            }

            while ((currentNode = textNodeWalker.nextNode()) !== null) {
                textNodes.push(currentNode);
            }
            return textNodes;
        });
    };


    // Parse for standard emotes in message text
    $.fn.parseEmotesStandard = function (emoteSets) {
        if (emoteSets === undefined || emoteSets.length === 0) {
            return this;
        }

        this.textNodes().each(function () {
            var sub = [];
            // separate out potential emotes
            // all standard emotes are composed of characters in [a-zA-Z0-9_], i.e. \w between two colons, :
            // use a regex with a capture group, so that we can preserve separators
            var words = this.data.split(/(:[\w#*]+:)/g);
            // non-emoteable words, for building a new text node if necessary
            var nonEmote = [];
            // whether the text in this node has been modified
            var modified = false;

            var seed = 0;
            var message = $(this).closest(".message").not(".message-sending");
            // Don't look up the useless id for messages being sent
            if (message.length !== 0) {
                // Get a seed for rolls
                seed = getMessageSeed(message[0]);
            }

            for (var i = 0; i < words.length; i += 2) {
                // words[i] is a separator
                // words[i+1] is our potential emote, or undefined

                // Keep the separator
                nonEmote.push(words[i]);
                if (words[i+1] === undefined) {
                    break;
                }

                var emote;
                for (var set of emoteSets) {
                    emote = set.createEmote(/^:([^:]+):$/.exec(words[i+1])[1], seed);
                    if (emote !== undefined) {
                        break;
                    }
                }
                if (emote !== undefined) {
                    modified = true;
                    // Create a new text node from any previous text
                    sub.push(document.createTextNode(nonEmote.join("")));
                    // Clear out stored words
                    nonEmote = [];
                    // Add the emote element
                    sub.push(emote);
                } else {
                    // Unrecognized as emote, keep the word
                    nonEmote.push(words[i+1]);
                }
            }
            // If no emotes were found, leave this text node unchanged
            if (modified) {
                // Replace this node's contents with remaining text
                this.data = nonEmote.join("");
            }
            $(this).before(sub);
        });

        return this;
    };

    // Parse for Twitch-style emotes in message text
    $.fn.parseEmotesTwitch = function (emoteSets) {
        if (emoteSets === undefined || emoteSets.length === 0) {
            return this;
        }

        // Find and replace Twitch-style emotes
        // This requires picking apart text nodes more carefully
        this.textNodes().each(function () {
            var sub = [];
            // separate out potential emotes
            // all twitch emotes (that we care about) are composed of characters in [a-zA-Z0-9_], i.e. \w
            // use a regex with a capture group, so that we can preserve separators
            var words = this.data.split(/(\W+)/g);
            // non-emoteable words, for building a new text node if necessary
            var nonEmote = [];
            // whether the text in this node has been modified
            var modified = false;
            for (var i = 0; i < words.length; i += 2) {
                // words[i] is our potential emote
                // words[i+1] is a separator, or undefined
                var emote;
                for (var set of emoteSets) {
                    emote = set.createEmote(words[i]);
                    if (emote !== undefined) {
                        break;
                    }
                }
                if (emote !== undefined) {
                    modified = true;
                    // Create a new text node from any previous text
                    sub.push(document.createTextNode(nonEmote.join("")));
                    // Clear out stored words
                    nonEmote = [];
                    // Add the emote element
                    sub.push(emote);
                } else {
                    // Unrecognized as emote, keep the word
                    nonEmote.push(words[i]);
                }
                // Keep the separator
                nonEmote.push(words[i+1]);
            }
            // If no emotes were found, leave this text node unchanged
            if (modified) {
                // Replace this node's contents with remaining text
                this.data = nonEmote.join("");
            }
            $(this).before(sub);
        });

        return this;
    };

    // Parse emotes (of any style) in message text
    $.fn.parseEmotes = function (emoteSets) {
        if (emoteSets === undefined || emoteSets.length === 0) {
            return this;
        }

        var standardSets = [];
        var twitchSets = [];
        for (var set of emoteSets) {
            if (set.emoteStyle === EmoteSet.emoteStyle.STANDARD) {
                standardSets.push(set);
            } else if (set.emoteStyle === EmoteSet.emoteStyle.TWITCH) {
                twitchSets.push(set);
            }
        }

        // Process messages for emote replacements
        this.parseEmotesStandard(standardSets).parseEmotesTwitch(twitchSets);

        // Properly jumboify emotes/emoji in messages with no other text
        this.not(".topic-expandable").has(".emoji").each(function () {
            // Get the "edited" text, if any, regardless of how it's styled or localized
            var edited = $(this).find(".edited").text();
            // Get the remaining message text
            var text = this.textContent.replace(edited, "").trim();
            if (text.length === 0) {
                $(this).find(".emoji").addClass("jumboable");
            } else {
                $(this).find(".emoji").removeClass("jumboable");
            }
        });

        return this;
    };

    // Replace title text with fancy tooltips
    $.fn.fancyTooltip = function () {
        return this.filter("[title]").each(function () {
            var title = $(this).attr("title");
            $(this).addClass("kawaii-fancytooltip").removeAttr("title");
            $(this).on("mouseover.fancyTooltip", function () {
                // Create and insert tooltip
                var tooltip = $("<div>").append(title).addClass("tooltip tooltip-top tooltip-normal");
                $(".tooltips").append(tooltip);

                // Position the tooltip
                var position = $(this).offset();
                position.top -= 30;
                position.left += $(this).width()/2 - tooltip.width()/2 - 10;
                tooltip.offset(position);

                // Set a handler to destroy the tooltip
                $(this).on("mouseout.fancyTooltip", function () {
                    // remove this handler
                    $(this).off("mouseout.fancyTooltip");
                    tooltip.remove();
                });
            });
        });
    };

    // Helper function for finding all elements matching selector affected by a mutation
    function mutationFind(mutation, selector) {
        var target = $(mutation.target), addedNodes = $(mutation.addedNodes);
        var mutated = target.add(addedNodes).filter(selector);
        var descendants = addedNodes.find(selector);
        var ancestors = target.parents(selector);
        return mutated.add(descendants).add(ancestors);
    }

    // Helper function for finding all elements matching selector removed by a mutation
    function mutationFindRemoved(mutation, selector) {
        var removedNodes = $(mutation.removedNodes);
        var mutated = removedNodes.filter(selector);
        var descendants = removedNodes.find(selector);
        return mutated.add(descendants);
    }

    // Attach observer to start triggering mutations
    function startObserver(observer) {
        // Get main app area and popouts
        const selector = [
            ".theme-dark",
            ".theme-light",
            ".theme-dark+span",
            ".theme-light+span",
        ].join(",");
        for (let target of document.querySelectorAll(selector)) {
            observer.observe(target, { childList:true, subtree:true, characterData:true });
        }
    }

    // Detach observer to stop triggering mutations
    function stopObserver(observer) {
        observer.disconnect();
    }

    function processMutation(mutation, observer) {
        // Get the set of messages and/or topic area affected by this mutation
        const selector = [
            ".markup",
            ".message-content",
            ".topic-expandable",
            ".markdown-modal.selectable",
        ].join(",");
        const messages = mutationFind(mutation, selector)
            .not(":has(.message-content)");

        // Ignore changes made here
        stopObserver(observer);

        // Figure out whether we're scrolled to the bottom
        const messagesContainer = $(".messages");
        const atBottom = messagesContainer.scrollBottom() < 0.5;

        // Process messages
        messages.parseEmotes([sfmlabEmotes, twitchEmotes, twitchSubEmotes])
            .find(".kawaii-parseemotes").fancyTooltip();

        // Clean up any remaining tooltips
        mutationFindRemoved(mutation, ".kawaii-fancytooltip")
            .trigger("mouseout.fancyTooltip");

        // Ensure we're still scrolled to the bottom if necessary
        if (atBottom) {
            messagesContainer.scrollBottom(0);
        }

        // Resume observer
        startObserver(observer);
    }

    // Watch for new chat messages
    const chat_observer = new MutationObserver(function (mutations, observer) {
        // Aggregate mutations
        const totalMutation = {
            target: [],
            addedNodes: [],
            removedNodes: [],
        };
        for (let mutation of mutations) {
            totalMutation.target.push(mutation.target);
            for (let node of mutation.addedNodes) {
                totalMutation.addedNodes.push(node);
            }
            for (let node of mutation.removedNodes) {
                totalMutation.removedNodes.push(node);
            }
        }

        processMutation(totalMutation, observer);
    });

    function parseEmoteSet() {
        processMutation({addedNodes: [document]}, chat_observer);
    }

    twitchEmotes.load({success: parseEmoteSet});
    //twitchSubEmotes.load({success: parseEmoteSet});
    sfmlabEmotes.load({success: parseEmoteSet});

    startTabComplete([sfmlabEmotes, twitchEmotes, twitchSubEmotes]);

    startObserver(chat_observer);
})(jQuery.noConflict(true), _.noConflict());

// vim: et:ts=4:sw=4:sts=4
