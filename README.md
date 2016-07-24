# KawaiiDiscord
A set of scripts for bringing some SFMLab chat features back to Discord.
Also, a few features from BetterDiscord, ported to the web client.

## Files

**KawaiiDiscord.user.js (for the web client)**

A userscript, last tested in Chrome 52. You will most likely need a userscript manager:
- [Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo?hl=en) (Chrome)
- [GreaseMonkey](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/) (Firefox)

**KawaiiDiscord.plugin.js (for the standalone client)**

A plugin for BetterDiscord, last tested with Discord 0.0.292 for Windows. The code is mostly adapted from the userscript, but refactored to work properly as a plugin.
Although BetterDiscord already supports Twitch emotes, this plugin parses them much more reliably.

## Features so far
- SFMLab emotes
- Twitch emotes
- Support for "mikeroll" style emotes, e.g. :mike#: randomly selects from [:mike:, :mike2:, ..., :mike124:]
- Loads emote lists at startup
- Auto-play GIFs, without needing to hover *(userscript only)*
- Fancy Discord-style tooltips for emotes

## TODO
- Periodically re-check for new emotes while running
- Settings panel (for managing emote sets, other preferences)
- Add emotes to emoji picker
- Custom theme support
