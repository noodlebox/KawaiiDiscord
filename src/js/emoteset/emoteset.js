import $ from "jquery";
import _ from "lodash";

// Emote data
export default function EmoteSet() {
    this.emoteMap = new Map();
    this.template = "";
    this.caseSensitive = true;
    this.rolls = false;
    this.emoteStyle = EmoteSet.emoteStyle.STANDARD;
    this.getRollTable = _.memoize(this.getRollTable);
}
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
const rollRegex = /^([*])?(\w*)([*#])?$/;
EmoteSet.prototype.getUrl = function (emoteName, seed) {
    if (!this.caseSensitive) {
        emoteName = emoteName.toLowerCase();
    }
    if (this.rolls) {
        const match = rollRegex.exec(emoteName);
        if (match === null) {
            return undefined;
        }
        if (match[1] !== undefined || match[3] !== undefined) {
            const table = this.getRollTable(emoteName);
            if (table.length === 0) {
                return undefined;
            }
            if (seed === undefined || seed === 0) {
                emoteName = this.rollDefault;
            } else {
                emoteName = table[seed % table.length];
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
EmoteSet.prototype.getRollTable = function (emoteName) {
    const match = rollRegex.exec(emoteName);
    const options = {
        start: match[1] === undefined,
        end: match[3] === undefined,
        numeric: match[3] === "#",
    };
    return this.search(match[2], options)
        .map(e => e[0])
        .sort();
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


