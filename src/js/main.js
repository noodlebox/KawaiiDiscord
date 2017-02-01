import $ from "jquery";

// Emote data
import EmoteSet from "./emoteset";

// Tab completion
import Completion from "./completion";

// ReactJS reversing
import {getOwnerInstance} from "./reverse";

// Mutation helpers
import {mutationFind, mutationFindRemoved} from "./mutationhelpers";

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
    messages.parseEmotes([smutbaseEmotes, twitchEmotes, twitchSubEmotes])
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

import {twitchEmotes, twitchSubEmotes} from "./emoteset/twitch";
import {smutbaseEmotes} from "./emoteset/smutbase";

export default function KawaiiDiscord() {}

KawaiiDiscord.prototype.load = function () {};

KawaiiDiscord.prototype.unload = function () {};

KawaiiDiscord.prototype.start = function () {
    // Load the emote sets if necessary, and parse the document as they load
    twitchEmotes.load().then(parseEmoteSet);
    // Hold off on loading this set by default until we add a settings panel
    //twitchSubEmotes.load().then(parseEmoteSet);
    smutbaseEmotes.load().then(parseEmoteSet);

    Completion.start([smutbaseEmotes, twitchEmotes, twitchSubEmotes]);

    startObserver(chat_observer);
};

KawaiiDiscord.prototype.stop = function () {
    stopObserver(chat_observer);

    Completion.stop();

    // Swap every emote back to its original text
    $(".kawaii-parseemotes").each(function() {
        var emote = $(this);
        emote.replaceWith(document.createTextNode(emote.attr("alt")));
    });
};

KawaiiDiscord.prototype.getSettingsPanel = function () {
    return "";
};

// vim: et:ts=4:sw=4:sts=4
