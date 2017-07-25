import $ from "jquery";

// Emote data
import EmoteSet from "./emoteset";

// Cult of the Party Parrot emotes
// http://cultofthepartyparrot.com/
export const partyParrotEmotes = new EmoteSet({
    label: "Party Parrot emotes",
    template: "https://gitcdn.xyz/repo/jmhobbs/cultofthepartyparrot.com/master/parrots/{0}",
    caseSensitive: false,
    emoteStyle: EmoteSet.emoteStyle.STANDARD,
    loader() {
        return new Promise((resolve, reject) => {
            $.ajax("https://gitcdn.xyz/repo/jmhobbs/cultofthepartyparrot.com/master/parrots.json", {dataType: "json", jsonp: false, cache: true})
                .done(data => {
                    const newData = {loaded: 0, skipped: 0};
                    newData.emoteMap = new Map();
                    data.forEach(emote => {
                        let name, path;
                        // Prefer HD versions if available
                        if (emote.hd !== undefined) {
                            // Strip "hd/" and ".gif"
                            name = emote.hd.slice(3, -4);
                            path = emote.hd;
                        } else {
                            // Strip ".gif"
                            name = emote.gif.slice(0, -4);
                            path = emote.gif;
                        }
                        const fixName = name.toLowerCase();
                        newData.emoteMap.set(fixName, new EmoteSet.Emote({
                            name: name,
                            path: path,
                            emoteSet: this,
                        }));
                        newData.loaded++;
                    });
                    newData.getRollTable = _.memoize(EmoteSet.prototype.getRollTable);
                    resolve(newData);
                })
                .fail((xhr, textStatus, errorThrown) => {
                    reject(new Error(`${textStatus}, error: ${errorThrown}`));
                });
        });
    },
});
