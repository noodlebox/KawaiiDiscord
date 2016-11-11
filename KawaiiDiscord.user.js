// ==UserScript==
// @name         KawaiiDiscord
// @namespace    https://files.noodlebox.moe/
// @downloadURL  https://files.noodlebox.moe/userscripts/KawaiiDiscord.user.js
// @version      0.7.4
// @description  Break SFMLab Chat (now for Discord!)
// @author       noodlebox
// @require      https://code.jquery.com/jquery-3.1.1.min.js
// @match        *://discordapp.com/channels/*
// @match        *://discordapp.com/invite/*
// @match        *://canary.discordapp.com/channels/*
// @match        *://canary.discordapp.com/invite/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function ($) {
    "use strict";

    // Emote data
    var EmoteSet = function () {
        this.emoteMap = new Map();
        this.rollTables = new Map();
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
        if (this.rolls && emoteName.endsWith("#")) {
            var prefix = emoteName.slice(0, -1);
            var table = this.rollTables.get(prefix);
            if (table === undefined) {
                return undefined;
            }
            if (seed === undefined || seed === 0) {
                emoteName = this.rollDefault;
            } else {
                emoteName = table[seed % table.length];
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
    EmoteSet.prototype.search = function (query) {
        const score = function (name, query) {
            name = name.toLowerCase();
            query = query.toLowerCase();
            const d = name.length - query.length;
            const i = name.indexOf(query);
            if (i === -1) {
                return 0;
            }
            return 1 + (i+1)*(d-i+2);
        };
        return [...this.emoteMap.keys()]
            .map(e => [e, score(e, query)])
            .filter(e => e[1] !== 0);
    };

    function getCompletionsStandard(emoteSets, text) {
        const match = text.match(/(^|\s):(\w{2,})$/);
        if (match === null) {
            return {completions: [], matchText: null, matchStart: -1};
        }

        const completions = emoteSets
            .filter(s => s.emoteStyle === EmoteSet.emoteStyle.STANDARD)
            .map(s => s.search(match[2]).map(e => [[":"+e[0]+":", s.createEmote.bind(s, e[0])], e[1]]))
            .reduce((a,b) => a.concat(b), []);
        const matchText = ":"+match[2], matchStart = match.index + match[1].length;

        return {completions, matchText, matchStart};
    }

    function getCompletionsTwitch(emoteSets, text) {
        const match = text.match(/(^|\s)(\w{3,})$/);
        if (match === null) {
            return {completions: [], matchText: null, matchStart: -1};
        }

        const completions = emoteSets
            .filter(s => s.emoteStyle === EmoteSet.emoteStyle.TWITCH)
            .map(s => s.search(match[2]).map(e => [[e[0], s.createEmote.bind(s, e[0])], e[1]]))
            .reduce((a,b) => a.concat(b), []);
        const matchText = match[2], matchStart = match.index + match[1].length;

        return {completions, matchText, matchStart};
    }

    function getCompletions(emoteSets, text, sorted=true) {
        let {completions, matchText, matchStart} = getCompletionsStandard(emoteSets, text);
        if (matchStart === -1) {
            ({completions, matchText, matchStart} = getCompletionsTwitch(emoteSets, text));
        }

        if (sorted) {
            const compare = new Intl.Collator(undefined, {
                usage: "sort",
                sensitivity: "base",
                numeric: true,
            }).compare;

            completions.sort((a,b) => ((a[1]===b[1]) ? compare(a[0],b[0]) : (a[1]-b[1])));
        }
        completions = completions.map(e => e[0]);

        return {completions, matchText, matchStart};
    }

    // Set up event handlers
    function startTabComplete(emoteSets) {
        // Cached information about an element's possible completions
        const matchCache = new WeakMap();

        // Show possible completions
        function renderCompletions(force=true) {
            /* jshint validthis: true */
            const channelTextarea = $(this).closest(".channel-textarea");
            const oldAutocomplete = channelTextarea.children(".kawaii-autocomplete");

            const cached = matchCache.get(this);

            if (cached === undefined) {
                oldAutocomplete.remove();
                return;
            }

            const {completions, matchText, selectedIndex} = cached;

            if (completions.length === 0) {
                oldAutocomplete.remove();
                return;
            }

            if (!force && oldAutocomplete.length !== 0) {
                return;
            }

            const firstIndex = Math.max(0, Math.min(selectedIndex-2, completions.length-10));
            const matchList = completions.slice(firstIndex, firstIndex+10);

            const autocomplete = $("<div>", {
                "class": "channel-textarea-autocomplete kawaii-autocomplete",
                css: {display: "block"},
            });
            const autocompleteInner = $("<div>", {"class": "channel-textarea-autocomplete-inner"})
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
                        insertSelectedCompletion.call(this);
                    });
                    return li;
                }))
                .appendTo(autocompleteInner);

            oldAutocomplete.remove();

            channelTextarea
                .append(autocomplete);
        }

        function destroyCompletions() {
            /* jshint validthis: true */
            matchCache.delete(this);
            renderCompletions.call(this, true);
        }

        // Insert selected completion at cursor position
        function insertSelectedCompletion() {
            /* jshint validthis: true */
            const cached = matchCache.get(this);

            if (cached === undefined) {
                return;
            }

            const {completions, matchStart, selectedIndex} = cached;

            const left = this.value.slice(0, matchStart) + completions[selectedIndex][0] + " ";
            const right = this.value.slice(this.selectionEnd);

            this.value = left + right;
            this.selectionStart = this.selectionEnd = left.length;

            destroyCompletions.call(this);
        }

        // Check for matches (overrides TextareaAutosize's onClick, onKeyPress, onKeyUp, maybeShowAutocomplete)
        function checkCompletions(e) {
            /* jshint validthis: true */
            let cached = matchCache.get(this);
            const {candidateText: lastText} = cached || {};
            const candidateText = this.value.slice(0, this.selectionEnd);

            if (lastText !== candidateText) {
                const {completions, matchText, matchStart} = getCompletions(emoteSets, candidateText);
                cached = {candidateText, completions, matchText, matchStart, selectedIndex: 0};
                matchCache.set(this, cached);
            }

            const {completions, matchText, matchStart} = cached;

            // If an emote match is impossible, don't override default behavior.
            // This allows other completion types (like usernames or channels) to work as usual.
            if (matchStart === -1) {
                destroyCompletions.call(this);
                return;
            }

            // Don't override enter when there are no actual completions.
            // This allows message sending to work as usual.
            if (e.which === 13 && (completions.length === 0 || !matchText.startsWith(":"))) {
                return;
            }

            // For any other key, always override, even when there are no actual completions.
            // This prevents Discord's emoji autocompletion from kicking in intermittently.
            e.stopPropagation();

            renderCompletions.call(this, lastText !== candidateText);
        }

        // Browse or insert matches (overrides ChannelTextArea's onKeyDown)
        function browseCompletions(e) {
            /* jshint validthis: true */
            const cached = matchCache.get(this);

            if (cached === undefined) {
                return;
            }

            const {completions, matchText, selectedIndex} = cached;

            if (completions.length === 0) {
                return;
            }

            switch (e.which) {
                // Enter
                case 13:
                    if (!matchText.startsWith(":")) {
                        break;
                    }
                    /* falls through */
                // Tab
                case 9:
                    // Prevent Discord's default behavior (send message)
                    e.stopPropagation();
                    // Prevent adding a tab or line break to text
                    e.preventDefault();

                    insertSelectedCompletion.call(this);
                    break;

                // Up
                case 38:

                    // Prevent Discord's default behavior (edit)
                    e.stopPropagation();
                    // Prevent cursor movement
                    e.preventDefault();

                    cached.selectedIndex = (selectedIndex - 1 + completions.length) % completions.length;
                    renderCompletions.call(this, true);
                    break;

                // Down
                case 40:

                    // Prevent Discord's default behavior
                    e.stopPropagation();
                    // Prevent cursor movement
                    e.preventDefault();

                    cached.selectedIndex = (selectedIndex + 1) % completions.length;
                    renderCompletions.call(this, true);
                    break;
            }
        }

        // Check for matches
        $(".app").on({
            "keyup.kawaii-complete keypress.kawaii-complete click.kawaii-complete": checkCompletions,
            "keydown.kawaii-complete": browseCompletions,
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
                    if (emoticon.emoticon_set !== 0 && emoteFilter(emoticon.code)) {
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
                    // Build roll tables
                    var prefix = /^(.*\D)?\d*$/.exec(fixName)[1];
                    if (prefix !== undefined) {
                        var table = self.rollTables.get(prefix);
                        if (table === undefined) {
                            table = [];
                            self.rollTables.set(prefix, table);
                        }
                        table.push(fixName);
                    }
                });
                // Original data may come in unsorted, so sort here to ensure consistency
                self.rollTables.forEach(function(v) {v.sort();});
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
    function getInternalProps(e) {
        try {
            var reactInternal = e[Object.keys(e).filter(k => k.startsWith("__reactInternalInstance"))[0]];
            return reactInternal._currentElement._owner._instance.props;
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
            observer.observe(target, { childList:true, subtree:true });
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
})(jQuery.noConflict(true));

// vim: et:ts=4:sw=4:sts=4
