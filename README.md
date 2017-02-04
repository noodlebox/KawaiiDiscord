# KawaiiDiscord
Add huge sets of external emotes to Discord.

This is intended for communities wanting more than 50 custom emotes or support for animated emotes. It probably isn't useful to you in its current state unless you're a member of the community these emote sets are from. It currently gets emote data from a few hardcoded locations, but could be modified for other communities with their own emote data sources. Support for more flexible user configuration is a planned feature.

## Features so far
- Smutbase emotes
- Twitch emotes
- "mikeroll" style emotes, e.g. :mike#: randomly selects from [:mike:, :mike2:, ..., :mike147:]
- Wildcard emotes, e.g. :mimi*: randomly selects from [:mimisleepy:, :mimiuneasy:, ..., :mimiangry:]
- Loads emote lists at startup
- Fancy Discord-style tooltips for emotes
- Scrollable tab-completion menu for both emote styles (overrides default completion behavior for emoji)

## Installation

**for the web client**

- Install [Tampermonkey](https://tampermonkey.net) for whichever browser you use.
- Head to the [release](https://github.com/noodlebox/KawaiiDiscord/releases/latest) page and grab `KawaiiDiscord.user.js` from the list of Downloads.
- Click "Install" when you see the installation prompt, then reload your Discord tab.

**for the desktop client**

- Install [BetterDiscord](https://betterdiscord.net/home/).
- Head to the [release](https://github.com/noodlebox/KawaiiDiscord/releases/latest) page and grab `KawaiiDiscord.plugin.js` from the list of Downloads.
- Save to BetterDiscord's plugin directory, restart Discord, then enable the KawaiiDiscord plugin.

## Building it yourself

Both the userscript and BD plugin can be built using gulp.
```
npm install
gulp
```
