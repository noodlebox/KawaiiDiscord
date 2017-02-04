import $ from "jquery";
import _ from "lodash";

import EmoteSet from "./emoteset";

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
        .map(s => s.search(match[5], options).map(e => [[match[2]+e[0]+match[2], s.createEmote.bind(s, e[0])], e[1]]))
        .reduce((a,b) => a.concat(b), [])
        .sort(emoteComparator)
        .map(e => e[0]);

    const matchText = match[2]+match[3], matchStart = match.index + match[1].length;

    return {completions, matchText, matchStart};
}

const shouldCompleteStandard = completeStandardRegex.test.bind(completeStandardRegex);

const shouldCompleteTwitch = completeTwitchRegex.test.bind(completeTwitchRegex);

const shouldComplete = completeAnyRegex.test.bind(completeAnyRegex);

const Completion = {};

export default Completion;

// Set up event handlers
Completion.start = function (emoteSets) {
    // Cached information about possible completions
    // Conflicts should be avoidable, as this is cleared on focus loss
    let cached = {};

    let textarea;

    const windowSize = 10, preScroll = 2;

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
            .on("wheel.kawaii-complete", e => scrollCompletions(e, {locked: true}))
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
};

// Tear down event handlers and clean up
Completion.stop = function () {
    $(".app").off(".kawaii-complete", ".channel-textarea textarea");
};
