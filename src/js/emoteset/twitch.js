import $ from "jquery";

// Emote data
import EmoteSet from "./emoteset";

// Filter function for "Twitch-style" emotes, to avoid collisions with common words
// Check if at least 3 word characters, and has at least one capital letter
// Based on current FFZ naming requirements (older FFZ emotes may not satisfy these requirements)
// See: https://www.frankerfacez.com/emoticons/submit
function emoteFilter(name) {
    return (/^\w{3,}$/.test(name) && /[A-Z]/.test(name));
}

// Global Twitch emotes (emoteset 0), filtered by emoteFilter
export const twitchEmotes = new EmoteSet();
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
export const twitchSubEmotes = new EmoteSet();
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
