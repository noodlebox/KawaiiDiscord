import $ from "jquery";

// Emote data
import EmoteSet from "./emoteset";

// Smutbase emotes, now with more rolling than ever!
export const sfmlabEmotes = new EmoteSet();
sfmlabEmotes.template = "https://smutba.se/media/emoji/{0}";
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
    $.ajax("https://smutba.se/emoji/json/", {
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
            self.getRollTable.cache = new Map();
            console.info("KawaiiDiscord:", "Smutbase emotes loaded:", loaded, "skipped:", skipped);
            callbacks.success(self);
        },
        error: function (xhr, textStatus, errorThrown) {
            console.warn("KawaiiDiscord:", "Smutbase emotes failed to load:", textStatus, "error:", errorThrown);
            callbacks.error(self);
        }
    });
};
