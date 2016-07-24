// ==UserScript==
// @name         KawaiiDiscord
// @namespace    https://files.noodlebox.moe/
// @downloadURL  https://files.noodlebox.moe/userscripts/KawaiiDiscord.user.js
// @version      0.5.0
// @description  Break SFMLab Chat (now for Discord!)
// @author       noodlebox
// @require      https://code.jquery.com/jquery-3.1.0.min.js
// @match        *://discordapp.com/channels/*
// @match        *://discordapp.com/invite/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function ($) {
    "use strict";

    // Set this to true for giant emotes.
    var __ICantLiveWithoutGiantEmotes__ = false;
    // But, editing the script isn't the best way to do this.
    // Create a CSS rule in your theme like this instead:
    //
    // .emoji.jumboable {
    //     height: 64px;
    //     width: 64px;
    // }
    //
    // Or, just wait for a settings panel to be added.


    // Emote data
    var EmoteSet = function () {
        this.emoteMap = new Map();
        this.rollTables = new Map();
        this.urlStart = "";
        this.urlEnd = "";
        this.caseSensitive = true;
        this.rolls = false;
        this.emoteStyle = EmoteSet.emoteStyle.STANDARD;
    };
    // emoteStyle enum
    EmoteSet.emoteStyle = {
        STANDARD: 0, // Surrounded by ":"
        TWITCH: 1, // Composed of "word characters" (\w)
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
        return this.urlStart + path + this.urlEnd;
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
            style: "width: auto;", // Some emojis (Twitch) are not square
        }).addClass("emoji jumboable kawaii-parseemotes");
        if (__ICantLiveWithoutGiantEmotes__) {
            emote.attr("style", "height: 64px; width: 64px;");
        }
        return emote;
    };

    // Global Twitch emotes (emoteset 0), excluding those using non-word characters
    var twitchEmotes = new EmoteSet();
    twitchEmotes.urlStart = "https://static-cdn.jtvnw.net/emoticons/v1/";
    twitchEmotes.urlEnd = "/1.0";
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
            dataType: "json",
            jsonp: false,
            cache: true,
            success: function (data) {
                var loaded = 0;
                var skipped = 0;
                data.emoticon_sets[0].forEach(function (emoticon) {
                    if (/^\w+$/.test(emoticon.code)) {
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

    // Twitch subscriber emotes, excluding those using non-word characters
    var twitchSubEmotes = new EmoteSet();
    twitchSubEmotes.urlStart = "https://static-cdn.jtvnw.net/emoticons/v1/";
    twitchSubEmotes.urlEnd = "/1.0";
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
            dataType: "json",
            jsonp: false,
            cache: true,
            success: function (data) {
                var loaded = 0;
                var skipped = 0;
                data.emoticons.forEach(function (emoticon) {
                    if (emoticon.emoticon_set !== 0 && /^\w+$/.test(emoticon.code)) {
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
    sfmlabEmotes.urlStart = "https://sfmlab.com/static/emoji/img/";
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
        // FIXME: https://sfmlab.com/emoji_json/ needs header: Access-Control-Allow-Origin: *
        $.ajax("https://files.noodlebox.moe/emoji.json", {
            dataType: "json",
            jsonp: false,
            cache: true,
            success: function (data) {
                var loaded = 0;
                var skipped = 0;
                for (var name in data) {
                    var fixName = name.toLowerCase();
                    var fixUrl = /[^/]*$/.exec(data[name])[0];
                    self.emoteMap.set(fixName, fixUrl);
                    loaded++;
                    // Build roll tables
                    for (var i = 0; i <= fixName.length; i++) {
                        var prefix = name.slice(0, i);
                        var table = self.rollTables.get(prefix);
                        if (table === undefined) {
                            table = [];
                            self.rollTables.set(prefix, table);
                        }
                        table.push(fixName);
                    }
                }
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
        var reactInternal = e[Object.keys(e).filter(function(k) {return k && k.startsWith("__reactInternalInstance");})];
        return reactInternal._currentElement._owner._instance.props;
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
        return this.contents().filter(function () { return this.nodeType === Node.TEXT_NODE; });
    };

    // Replace GIF previews with actual image
    $.fn.autoGif = function () {
        return this.filter(".image:has(canvas)").each(function () {
            var canvas = $(this).children("canvas").first();
            var src = canvas.attr("src");
            if(src !== undefined) {
                $(this).replaceWith($("<img>", {
                    src: canvas.attr("src"),
                    width: canvas.attr("width"),
                    height: canvas.attr("height"),
                }).addClass("image kawaii-autogif"));
            }
        });
    };

    // Parse for standard emotes in message text, returning the new emotes
    $.fn.parseEmotesStandard = function (emoteSets) {
        // Build a list of new emotes
        var emotes = $();

        if (emoteSets === undefined || emoteSets.length === 0) {
            return emotes;
        }

        // Find and replace :emote:-style emotes
        // Takes advantage of Discord's parsing of "potential" emotes
        this.find("span").not(".edited, .highlight").textNodes().each(function () {
            var res = /^:([^:]*):$/.exec(this.data);
            if (res === null) {
                // Somehow didn't match, but this generally shouldn't happen
                return;
            }
            var seed = 0;
            if (res[1].endsWith("#")) {
                var message = $(this).closest(".message").not(".message-sending");
                // Don't look up the useless id for messages being sent
                if (message.length !== 0) {
                    // Get a seed for rolls
                    seed = getMessageSeed(message[0]);
                    console.debug("seed:", seed, res[1]);
                }
            }

            var emote;
            for (var set of emoteSets) {
                emote = set.createEmote(res[1], seed);
                if (emote !== undefined) {
                    break;
                }
            }
            if (emote !== undefined) {
                // Swap in the emote element
                $(this).replaceWith(emote);
                emotes = emotes.add(emote);
            }
        });

        return emotes;
    };

    // Parse for Twitch-style emotes in message text, returning the new emotes
    $.fn.parseEmotesTwitch = function (emoteSets) {
        // Build a list of new emotes
        var emotes = $();

        if (emoteSets === undefined || emoteSets.length === 0) {
            return emotes;
        }

        // Find and replace Twitch-style emotes
        // This requires picking apart text nodes more carefully
        this.add(this.find(":not(span, code)")).textNodes().each(function () {
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
                    var text = nonEmote.join("");
                    if (text.length > 0) {
                        $(this).before(document.createTextNode(text));
                    }
                    // Clear out stored words
                    nonEmote = [];
                    // Add the emote element
                    $(this).before(emote);
                    emotes = emotes.add(emote);
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
        });

        return emotes;
    };

    // Parse emotes (of any style) in message text, returning the new emotes
    $.fn.parseEmotes = function (emoteSets) {
        if (emoteSets === undefined || emoteSets.length === 0) {
            return $();
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

        return this.parseEmotesStandard(standardSets).add(this.parseEmotesTwitch(twitchSets));
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
    var mutationFind = function (mutation, selector) {
        var target = $(mutation.target), addedNodes = $(mutation.addedNodes);
        var mutated = target.add(addedNodes).filter(selector);
        var descendants = addedNodes.find(selector);
        var ancestors = target.parents(selector);
        return mutated.add(descendants).add(ancestors);
    };

    // Helper function for finding all elements matching selector removed by a mutation
    var mutationFindRemoved = function (mutation, selector) {
        var removedNodes = $(mutation.removedNodes);
        var mutated = removedNodes.filter(selector);
        var descendants = removedNodes.find(selector);
        return mutated.add(descendants);
    };

    // Watch for new chat messages
    var chat_observer = new MutationObserver(function (mutations, observer) {
        // Figure out whether we're scrolled to the bottom
        var messagesContainer = $(".messages");
        var atBottom = messagesContainer.scrollBottom() < 0.5;

        mutations.forEach(function (mutation) {
            // Get the set of messages affected by this mutation
            var messages = mutationFind(mutation, ".markup, .message-content").not(":has(.message-content)");
            // When a line is edited, Discord may stuff the new contents inside one of our emotes
            messages.find(".kawaii-parseemotes").contents().unwrap();
            // Process messages
            messages.parseEmotes([sfmlabEmotes, twitchEmotes]).fancyTooltip();
            mutationFind(mutation, ".image").autoGif();

            // Clean up any remaining tooltips
            mutationFindRemoved(mutation, ".kawaii-fancytooltip").trigger("mouseout.fancyTooltip");
        });

        // Ensure we're still scrolled to the bottom if necessary
        if (atBottom) {
            messagesContainer.scrollBottom(0);
        }
    });

    var parseEmoteSet = function (set) {
        var messages = $(".markup, .message-content").not(":has(.message-content)");
        messages.parseEmotes([set]).fancyTooltip();
    };

    twitchEmotes.load({success: parseEmoteSet});
    //twitchSubEmotes.load({success: parseEmoteSet});
    sfmlabEmotes.load({success: parseEmoteSet});

    chat_observer.observe(document, { childList:true, subtree:true });

    // For console debugging
    window.jq = $;
})(jQuery.noConflict(true));
